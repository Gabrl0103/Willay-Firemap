import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildContainer } from '../src/infrastructure/config/container.js';
import { findMentionedZone, findZoneByName } from '../src/domain/service/zoneMatching.js';
import { NARINO_MUNICIPALITIES } from '../src/infrastructure/persistence/narinoMunicipalities.js';
import { zones } from '../src/infrastructure/persistence/seedData.js';
import { findArticleZone } from '../src/infrastructure/scraping/NewsFireReportSource.js';

/** Ids of the first 12 zones: stored weather and fire events point to them. */
const LEGACY_IDS = [
  'pasto', 'ipiales', 'tumaco', 'tuquerres', 'la-cruz', 'samaniego',
  'sandona', 'chachagui', 'tangua', 'yacuanquer', 'guachucal', 'barbacoas',
];

/** How the UNGRD dataset (datos.gov.co wwkg-r6te) writes the municipalities of Nariño. */
const UNGRD_NAMES = [
  'ALBAN', 'ALDANA', 'ANCUYA', 'ARBOLEDA', 'BARBACOAS', 'BELEN', 'BUESACO', 'CHACHAGUI', 'COLON', 'CONSACA',
  'CORDOBA', 'CUASPUD', 'CUMBAL', 'CUMBITARA', 'EL CHARCO', 'EL CONTADERO', 'EL PEÑOL', 'EL ROSARIO',
  'EL TABLON DE GOMEZ', 'EL TAMBO', 'FUNES', 'GUACHUCAL', 'GUAITARILLA', 'GUALMATAN', 'ILES', 'IMUES', 'IPIALES',
  'LA CRUZ', 'LA FLORIDA', 'LA LLANADA', 'LA TOLA', 'LA UNION', 'LEIVA', 'LINARES', 'LOS ANDES', 'MAGUI PAYAN',
  'MALLAMA', 'MOSQUERA', 'NARIÑO', 'OLAYA HERRERA', 'OSPINA', 'PASTO', 'POLICARPA', 'POTOSI', 'PROVIDENCIA',
  'PUERRES', 'PUPIALES', 'RICAURTE', 'ROBERTO PAYAN', 'SAMANIEGO', 'SAN ANDRES DE TUMACO', 'SAN BERNARDO',
  'SAN LORENZO', 'SAN PABLO', 'SANDONA', 'SANTA BARBARA', 'SANTACRUZ', 'SAPUYES', 'TAMINANGO', 'TANGUA',
  'TUQUERRES', 'YACUANQUER',
];

describe('municipalities of Nariño (DIVIPOLA)', () => {
  it('has the 64 municipalities, each with its own id and DANE code', () => {
    assert.equal(NARINO_MUNICIPALITIES.length, 64);
    assert.equal(new Set(NARINO_MUNICIPALITIES.map((m) => m.id)).size, 64);
    assert.equal(new Set(NARINO_MUNICIPALITIES.map((m) => m.divipola)).size, 64);
    for (const m of NARINO_MUNICIPALITIES) {
      assert.match(m.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, m.id);
      assert.ok(m.divipola > 52000 && m.divipola < 53000, `${m.id}: ${m.divipola}`);
      // Bounding box of the department.
      assert.ok(m.latitude > 0.3 && m.latitude < 3 && m.longitude > -79.1 && m.longitude < -76.7, m.id);
    }
  });

  it('keeps the ids the first 12 zones had', () => {
    const ids = new Set(NARINO_MUNICIPALITIES.map((m) => m.id));
    for (const id of LEGACY_IDS) assert.ok(ids.has(id), id);
    assert.equal(NARINO_MUNICIPALITIES.find((m) => m.divipola === 52835)?.id, 'tumaco');
  });

  it('is what the in-memory API serves: 64 zones', async () => {
    assert.equal(zones.length, 64);
    const container = buildContainer({ port: 0, ingestionEnabled: false });
    // Only the 12 zones with test weather have a risk; the rest wait for the weather ingestion.
    assert.equal((await container.getZonesRisk.execute()).length, 12);
  });
});

describe('municipality names -> zone', () => {
  it('maps every UNGRD spelling, without accents', () => {
    const missing = UNGRD_NAMES.filter((name) => !findZoneByName(name, zones));
    assert.deepEqual(missing, []);
    assert.equal(findZoneByName('SAN ANDRES DE TUMACO', zones)?.id, 'tumaco');
    assert.equal(findZoneByName('MAGUI PAYAN', zones)?.id, 'magui');
    assert.equal(findZoneByName('el contadero', zones)?.id, 'contadero');
  });

  it('finds every official name in a text, with and without accents', () => {
    for (const m of NARINO_MUNICIPALITIES) {
      if (m.id === 'narino') continue; // the department's name, see below
      const plain = m.name.normalize('NFD').replace(/[̀-ͯ]/g, '');
      assert.equal(findMentionedZone(`Incendio forestal en ${m.name} esta tarde`, zones)?.id, m.id, m.name);
      assert.equal(findMentionedZone(`Incendio forestal en ${plain} esta tarde`, zones)?.id, m.id, plain);
    }
  });

  it('uses aliases and prefers the longest name', () => {
    assert.equal(findMentionedZone('Incendio en Santa Bárbara de Iscuandé', zones)?.id, 'santa-barbara');
    assert.equal(findMentionedZone('PMU en Santacruz de Guachavés', zones)?.id, 'santacruz');
    assert.equal(findMentionedZone('Incendio entre Los Andes Sotomayor y Cumbitara', zones)?.id, 'los-andes');
    assert.equal(findMentionedZone('Bomberos de Tumaco', zones)?.id, 'tumaco');
  });

  it('reads "Nariño" as the department unless the text says "municipio de Nariño"', () => {
    assert.equal(findMentionedZone('Gobernación de Nariño atiende incendio', zones), undefined);
    assert.equal(findArticleZone('Incendio forestal en una vereda', 'ocurrió en el municipio de Nariño', zones)?.id, 'narino');
    assert.equal(findArticleZone('Gobernación de Nariño: incendio forestal', 'en el municipio de Cumbitara', zones)?.id, 'cumbitara');
  });
});
