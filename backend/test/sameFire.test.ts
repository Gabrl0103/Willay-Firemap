import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { IngestFireEventsUseCase } from '../src/application/useCase/IngestFireEventsUseCase.js';
import type { NewFireEvent } from '../src/domain/model/FireEvent.js';
import type { FireReportSource } from '../src/domain/port/DataSources.js';
import { groupSameFires, mergeSameFire } from '../src/domain/service/sameFireGrouping.js';
import { InMemoryFireEventRepository, InMemoryZoneRepository } from '../src/infrastructure/persistence/InMemoryRepositories.js';
import { zones } from '../src/infrastructure/persistence/seedData.js';
import { articleToFireEvent, isWildfireArticle } from '../src/infrastructure/scraping/NewsFireReportSource.js';

const news = (zoneId: string, date: string, url: string, place = zoneId, hectares = 0): NewFireEvent => ({
  zoneId,
  place,
  date,
  hectares,
  source: 'news',
  sourceUrl: `https://n.test/${url}`,
});

/** The cerro Aminda fire as the Gobernación reported it (July 2026): seven articles, two zones. */
const AMINDA = [
  news('los-andes', '2026-07-14', 'coordina-acciones'),
  news('los-andes', '2026-07-14', 'respuesta-integral', 'Aminda, Los Andes', 400),
  news('cumbitara', '2026-07-18', 'inicia-operacion', 'Pisanda, Cumbitara'),
  news('cumbitara', '2026-07-18', 'control-parcial'),
  news('cumbitara', '2026-07-19', 'cuatro-dias', 'Pisanda, Cumbitara'),
  news('cumbitara', '2026-07-21', 'fase-final'),
  news('cumbitara', '2026-07-22', 'liquidado', 'Aminda, Cumbitara', 750),
];

describe('groupSameFires', () => {
  it('joins the news of a zone while each one is at most 3 days after the previous one', () => {
    const groups = groupSameFires(AMINDA);
    assert.deepEqual(
      groups.map((group) => [group[0]?.zoneId, group.length]),
      [
        ['los-andes', 2],
        ['cumbitara', 5],
      ],
    );
  });

  it('splits at 4 days and never mixes zones', () => {
    const groups = groupSameFires([
      news('pasto', '2026-08-01', 'a'),
      news('pasto', '2026-08-04', 'b'), // 3 days: same fire
      news('pasto', '2026-08-08', 'c'), // 4 days: another fire
      news('ipiales', '2026-08-02', 'd'),
    ]);
    assert.deepEqual(
      groups.map((group) => group.map((event) => event.sourceUrl?.slice(-1))),
      [['a', 'b'], ['c'], ['d']],
    );
  });
});

describe('mergeSameFire', () => {
  it('keeps the oldest article, the largest area and the other links as references', () => {
    const [, cumbitara] = groupSameFires(AMINDA);
    assert.deepEqual(mergeSameFire(cumbitara ?? []), {
      zoneId: 'cumbitara',
      place: 'Pisanda, Cumbitara',
      date: '2026-07-18',
      hectares: 750,
      source: 'news',
      sourceUrl: 'https://n.test/control-parcial', // same day as inicia-operacion: URL order
      relatedUrls: [
        'https://n.test/inicia-operacion',
        'https://n.test/cuatro-dias',
        'https://n.test/fase-final',
        'https://n.test/liquidado',
      ],
    });
  });
});

describe('IngestFireEventsUseCase groups news about the same fire', () => {
  const sourceOf = (events: NewFireEvent[]): FireReportSource => ({
    name: 'fake-news',
    fetchReports: async (_zones, known) => ({
      itemsRead: events.length,
      wildfireItems: events.length,
      events: events.filter((event) => !known.has(event.sourceUrl ?? '')),
    }),
  });

  it('stores one event per fire in a batch', async () => {
    const fireEvents = new InMemoryFireEventRepository([]);
    const ingest = new IngestFireEventsUseCase(new InMemoryZoneRepository(zones), [sourceOf(AMINDA)], fireEvents);
    const [result] = await ingest.execute();
    assert.equal(result?.found, 7);
    assert.equal(result?.grouped, 5);
    assert.equal(result?.inserted, 2);
    assert.deepEqual(
      (await fireEvents.findAll()).map((e) => [e.zoneId, e.place, e.date, e.hectares]),
      [
        ['los-andes', 'Aminda, Los Andes', '2026-07-14', 400],
        ['cumbitara', 'Pisanda, Cumbitara', '2026-07-18', 750],
      ],
    );
    // A second run reads the same feed: every link (main or reference) is known.
    const [again] = await ingest.execute();
    assert.equal(again?.found, 0);
    assert.equal((await fireEvents.findAll()).length, 2);
  });

  it('adds a later article to the stored fire, and an older one becomes the main article', async () => {
    const fireEvents = new InMemoryFireEventRepository([]);
    await fireEvents.saveMany([news('pasto', '2026-08-10', 'first', 'Pasto', 2)]);
    const later = news('pasto', '2026-08-12', 'later', 'Jongovito, Pasto', 6);
    const older = news('pasto', '2026-08-08', 'older');
    const ingest = new IngestFireEventsUseCase(new InMemoryZoneRepository(zones), [sourceOf([later, older])], fireEvents);

    const [result] = await ingest.execute();
    assert.equal(result?.grouped, 2);
    assert.equal(result?.inserted, 0);
    const [stored] = await fireEvents.findNewsEvents();
    assert.deepEqual(
      { ...stored, id: undefined },
      {
        id: undefined,
        zoneId: 'pasto',
        place: 'Jongovito, Pasto',
        date: '2026-08-08',
        hectares: 6,
        source: 'news',
        sourceUrl: 'https://n.test/older',
        relatedUrls: ['https://n.test/first', 'https://n.test/later'],
      },
    );
  });
});

describe('isWildfireArticle', () => {
  it('rejects the Olaya Herrera (La Isla) urban fire', () => {
    const article = {
      title: '"Nariño Responde" llegó a Olaya Herrera para atender a familias afectadas por incendio',
      publishedAt: '2026-09-29T12:00:55-05:00',
      text:
        'Familias que perdieron sus viviendas en el incendio del sector La Isla, en el casco urbano de Bocas de ' +
        'Satinga, Municipio de Olaya Herrera. Son 15 viviendas destruidas. El esquema previsto incluye tejas de zinc.',
    };
    assert.equal(isWildfireArticle(article), false);
    assert.equal(articleToFireEvent(article, 'https://n.test/olaya', zones), undefined);
  });

  it('does not take "esquema" for "quema"', () => {
    assert.equal(isWildfireArticle({ title: 'Incendio en Pasto', text: 'Un nuevo esquema de atención.' }), false);
  });

  it('rejects fires of shops and warehouses that only mention hectares', () => {
    const article = { title: 'Incendio en una bodega de Ipiales', text: 'El local de media hectárea quedó en ruinas.' };
    assert.equal(isWildfireArticle(article), false);
  });

  it('accepts "incendios" in plural when the title names a municipality', () => {
    const article = {
      title: 'Gobernación de Nariño instaló PMU en Santacruz de Guachavés para coordinar la atención de uno de los incendios',
      publishedAt: '2026-08-18T10:00:00-05:00',
      text: 'El incendio forestal afecta cobertura vegetal en zona rural del municipio.',
    };
    const santacruz = { id: 'santacruz', name: 'Santacruz', latitude: 1.22, longitude: -77.68, aliases: ['Santacruz de Guachavés'] };
    assert.equal(isWildfireArticle(article, [...zones, santacruz]), true);
    assert.equal(articleToFireEvent(article, 'https://n.test/santacruz', [...zones, santacruz])?.zoneId, 'santacruz');
    // Without zones the plural is not enough.
    assert.equal(isWildfireArticle(article), false);
  });

  it('leaves the area unknown when a plural title quotes a department total', () => {
    const article = {
      title: 'Secretaría de Agricultura inicia atención y diagnóstico en Ancuya tras afectaciones por incendios de cobertura vegetal',
      publishedAt: '2026-08-28T09:00:00-05:00',
      text: 'Los reportes dan cuenta de 15 municipios, 1.485 hectáreas productivas afectadas.',
    };
    const ancuya = { id: 'ancuya', name: 'Ancuya', latitude: 1.26, longitude: -77.51 };
    const event = articleToFireEvent(article, 'https://n.test/ancuya', [...zones, ancuya]);
    assert.equal(event?.zoneId, 'ancuya');
    assert.equal(event?.hectares, 0);
  });

  it('still rejects plural bulletins that name no municipality', () => {
    const article = {
      title: 'Nariño mantiene atención simultánea en tres incendios forestales activos',
      text: 'Bosques afectados en varios municipios.',
    };
    assert.equal(isWildfireArticle(article, zones), false);
  });

  it('keeps a wildfire that also reached a house', () => {
    const article = {
      title: 'Incendio forestal en la vereda El Rosal',
      text: 'El fuego consumió 8 hectáreas de bosque y alcanzó una casa del municipio de Buesaco.',
    };
    assert.equal(isWildfireArticle(article), true);
    assert.equal(articleToFireEvent({ ...article, publishedAt: '2026-08-02' }, 'https://n.test/rosal', zones)?.zoneId, 'buesaco');
  });
});
