import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { IngestFireEventsUseCase } from '../src/application/useCase/IngestFireEventsUseCase.js';
import type { NewFireEvent } from '../src/domain/model/FireEvent.js';
import type { FireReportSource } from '../src/domain/port/DataSources.js';
import { InMemoryFireEventRepository, InMemoryZoneRepository } from '../src/infrastructure/persistence/InMemoryRepositories.js';
import { articleToFireEvent, findArticleZone } from '../src/infrastructure/scraping/NewsFireReportSource.js';
import type { PoliteHttpClient } from '../src/infrastructure/scraping/PoliteHttpClient.js';
import { parseRssItems, RssFireReportSource, toBogotaIso } from '../src/infrastructure/scraping/RssFireReportSource.js';

const zones = [
  { id: 'pasto', name: 'Pasto', latitude: 1.21, longitude: -77.28 },
  { id: 'la-cruz', name: 'La Cruz', latitude: 1.6, longitude: -76.97 },
  { id: 'chachagui', name: 'Chachagüí', latitude: 1.36, longitude: -77.28 },
];

const item = (link: string, title: string, pubDate: string, html: string): string => `
  <item>
    <title>${title}</title>
    <link>${link}</link>
    <pubDate>${pubDate}</pubDate>
    <category><![CDATA[Gestión del Riesgo de Desastre]]></category>
    <description><![CDATA[<p>Resumen [&#8230;]</p>]]></description>
    <content:encoded><![CDATA[${html}]]></content:encoded>
  </item>`;

/** Same shape as the WordPress search feed of narino.gov.co (RSS 2.0 with the whole post in content:encoded). */
const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>Buscó por el término incendio - Gobernación de Nariño</title>
  <link>https://narino.gov.co/</link>
  ${item(
    'https://gob.test/riesgo/incendio-forestal-en-la-vereda-el-pedregal/',
    'Bomberos controlaron incendio forestal en la vereda El Pedregal',
    'Thu, 23 Jul 2026 02:22:10 +0000',
    `<p class="wp-block-paragraph"><strong>La emergencia quedó extinguida</strong></p>
     <p class="wp-block-paragraph">Un incendio forestal en la vereda El Pedregal, del municipio de La Cruz, afectó
     12,5 hectáreas de cobertura vegetal. Apoyaron bomberos de Pasto y la Defensa Civil.</p>
     <figure class="wp-block-image"><img src="https://gob.test/foto.jpg" alt="Bombero"></figure>`,
  )}
  ${item(
    'https://gob.test/riesgo/incendio-forestal-en-cumbitara/',
    'Incendio forestal en el cerro Aminda quedó liquidado',
    'Wed, 22 Jul 2026 15:00:00 +0000',
    '<p>El incendio forestal en el municipio de Cumbitara consumió 750 hectáreas. El helicóptero partió desde Chachagüí.</p>',
  )}
  ${item(
    'https://gob.test/noticias/dotacion-organismos-de-socorro/',
    'Nariño dota a los organismos de socorro para responder ante incendios de cobertura vegetal',
    'Fri, 18 Sep 2026 23:13:51 +0000',
    '<p>Los equipos llegaron a los Municipios de Pasto, La Cruz y Cumbal para atender incendios forestales.</p>',
  )}
  ${item(
    'https://gob.test/noticias/incendio-en-vivienda-de-pasto/',
    'Incendio en una vivienda de Pasto',
    'Mon, 03 Aug 2026 14:00:00 +0000',
    '<p>Bomberos atendieron la emergencia en el barrio Lorenzo.</p>',
  )}
</channel>
</rss>`;

describe('RSS news feed', () => {
  it('converts the RSS date to Colombia time (UTC-5)', () => {
    assert.equal(toBogotaIso('Thu, 23 Jul 2026 02:22:10 +0000'), '2026-07-22T21:22:10-05:00');
    assert.equal(toBogotaIso('not a date'), undefined);
  });

  it('reads title, link, date and the post text without HTML', () => {
    const [first] = parseRssItems(FEED);
    assert.equal(first?.link, 'https://gob.test/riesgo/incendio-forestal-en-la-vereda-el-pedregal/');
    assert.equal(first?.article.title, 'Bomberos controlaron incendio forestal en la vereda El Pedregal');
    assert.equal(first?.article.publishedAt, '2026-07-22T21:22:10-05:00');
    assert.match(first?.article.text ?? '', /^La emergencia quedó extinguida Un incendio forestal en la vereda El Pedregal/);
    assert.doesNotMatch(first?.article.text ?? '', /<p|wp-block/);
    assert.equal(parseRssItems(FEED).length, 4);
  });

  it('maps only wildfires of known zones, with locality, date and hectares', () => {
    const events = parseRssItems(FEED)
      .map((feedItem) => articleToFireEvent(feedItem.article, feedItem.link, zones))
      .filter((event) => event !== undefined);
    assert.deepEqual(events, [
      {
        zoneId: 'la-cruz',
        place: 'El Pedregal, La Cruz',
        date: '2026-07-22',
        hectares: 12.5,
        source: 'news',
        sourceUrl: 'https://gob.test/riesgo/incendio-forestal-en-la-vereda-el-pedregal/',
      },
    ]);
  });

  it('reads the pages of the feed, skips stored links and stops after the last page', async () => {
    const requested: string[] = [];
    const http = {
      async getText(url: string): Promise<string> {
        requested.push(url);
        if (url.endsWith('paged=2')) throw new Error('Request failed with status code 404');
        return FEED;
      },
    } as unknown as PoliteHttpClient;
    const source = new RssFireReportSource({ name: 'test-feed', feedUrl: 'https://gob.test/feed/', maxPages: 5 }, http);

    const batch = await source.fetchReports(zones, new Set());
    assert.deepEqual(requested, ['https://gob.test/feed/', 'https://gob.test/feed/?paged=2']);
    assert.equal(batch.itemsRead, 4);
    assert.equal(batch.wildfireItems, 2); // El Pedregal and Cumbitara; not the bulletin nor the house
    assert.equal(batch.events.length, 1);

    const again = await source.fetchReports(zones, new Set([batch.events[0]?.sourceUrl ?? '']));
    assert.equal(again.events.length, 0);
  });
});

describe('findArticleZone', () => {
  it('prefers the zone in the title', () => {
    assert.equal(findArticleZone('Incendio forestal en Chachagüí', 'en el municipio de La Cruz', zones)?.id, 'chachagui');
  });

  it('uses "municipio de X" from the text and ignores lists and other towns', () => {
    assert.equal(findArticleZone('Incendio en la Cordillera', 'llegó al Municipio de La Cruz desde Pasto', zones)?.id, 'la-cruz');
    assert.equal(findArticleZone('Incendio en el cerro', 'en el municipio de Cumbitara; apoyo desde Pasto', zones), undefined);
    assert.equal(findArticleZone('Incendio en el cerro', 'dotación a los Municipios de Pasto y La Cruz', zones), undefined);
  });
});

describe('IngestFireEventsUseCase', () => {
  const event = (place: string, sourceUrl: string, date = '2026-08-01'): NewFireEvent => ({
    zoneId: 'pasto',
    place,
    date,
    hectares: 1,
    source: 'news',
    sourceUrl,
  });

  it('stores each news page once (by source_url) and reports the counts', async () => {
    const fireEvents = new InMemoryFireEventRepository([]);
    const source: FireReportSource = {
      name: 'fake-news',
      fetchReports: async (_zones, known) => ({
        itemsRead: 10,
        wildfireItems: 3,
        events: [event('Jongovito, Pasto', 'https://n.test/a'), event('Pasto', 'https://n.test/a'), event('Obonuco, Pasto', 'https://n.test/b', '2026-08-20')].filter(
          (e) => !known.has(e.sourceUrl ?? ''),
        ),
      }),
    };
    const ingest = new IngestFireEventsUseCase(new InMemoryZoneRepository(zones), [source], fireEvents);

    assert.deepEqual(await ingest.execute(), [{ source: 'fake-news', read: 10, wildfires: 3, found: 2, grouped: 0, inserted: 2 }]);
    assert.deepEqual(await fireEvents.findSourceUrls('news'), new Set(['https://n.test/a', 'https://n.test/b']));
    assert.deepEqual(await ingest.execute(), [{ source: 'fake-news', read: 10, wildfires: 3, found: 0, grouped: 0, inserted: 0 }]);
    assert.equal((await fireEvents.findAll()).length, 2);
  });

  it('does not store the same news page again even if the fake source ignores the known URLs', async () => {
    const fireEvents = new InMemoryFireEventRepository([]);
    await fireEvents.saveMany([event('Pasto', 'https://n.test/a')]);
    assert.equal(await fireEvents.saveMany([event('Jongovito, Pasto', 'https://n.test/a')]), 0);
  });
});
