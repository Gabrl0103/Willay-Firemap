import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findMentionedZone, findZoneByName } from '../src/domain/service/zoneMatching.js';
import {
  articleToFireEvent,
  extractFireArticleLinks,
  extractHectares,
  extractLocality,
  parseArticle,
} from '../src/infrastructure/scraping/NewsFireReportSource.js';
import { parseRobotsTxt } from '../src/infrastructure/scraping/robotsTxt.js';
import { ungrdRowsToFireEvents } from '../src/infrastructure/scraping/UngrdFireReportSource.js';

const zones = [
  { id: 'pasto', name: 'Pasto', latitude: 1.21, longitude: -77.28 },
  { id: 'la-cruz', name: 'La Cruz', latitude: 1.6, longitude: -76.97 },
  { id: 'chachagui', name: 'Chachagüí', latitude: 1.36, longitude: -77.28 },
];

describe('parseRobotsTxt', () => {
  const robots = [
    'User-agent: ClaudeBot',
    'Disallow: /',
    '',
    'User-agent: *',
    'Crawl-delay: 1',
    'Disallow: /browse?*&q=',
    'Disallow: /private',
    'Allow: /private/open$',
  ].join('\n');

  it('applies the "*" group to an unlisted bot', () => {
    const rules = parseRobotsTxt(robots, 'WillayBot');
    assert.equal(rules.isAllowed('https://x.co/resource/data.json?$limit=5'), true);
    assert.equal(rules.isAllowed('https://x.co/browse?a=1&q=fire'), false);
    assert.equal(rules.isAllowed('https://x.co/private/page'), false);
    assert.equal(rules.isAllowed('https://x.co/private/open'), true);
    assert.equal(rules.crawlDelaySeconds, 1);
  });

  it('uses the group that names the bot', () => {
    assert.equal(parseRobotsTxt(robots, 'ClaudeBot').isAllowed('https://x.co/news'), false);
  });

  it('allows everything when the file is empty', () => {
    assert.equal(parseRobotsTxt('', 'WillayBot').isAllowed('https://x.co/anything'), true);
  });
});

describe('zone matching', () => {
  it('finds a zone by an upper-case name without accents', () => {
    assert.equal(findZoneByName('CHACHAGUI', zones)?.id, 'chachagui');
  });

  it('does not confuse grass ("pasto") or the Red Cross with a town', () => {
    assert.equal(findMentionedZone('El fuego consumió pasto seco; llegó la Cruz Roja', zones), undefined);
  });

  it('returns the zone mentioned first', () => {
    assert.equal(findMentionedZone('Incendio en La Cruz; bomberos de Pasto apoyan', zones)?.id, 'la-cruz');
  });
});

describe('news scraping', () => {
  it('extracts hectares in Spanish formats', () => {
    assert.equal(extractHectares('se quemaron 1.200 hectáreas'), 1200);
    assert.equal(extractHectares('afectó 2,5 hectáreas de bosque'), 2.5);
    assert.equal(extractHectares('el incendio de 2024 ha consumido el monte'), undefined);
  });

  it('extracts the locality', () => {
    assert.equal(extractLocality('Incendio en la vereda El Motilón del municipio'), 'El Motilón');
    assert.equal(extractLocality('en el corregimiento de Jongovito, Pasto'), 'Jongovito');
  });

  it('keeps only fire links of the same site', () => {
    const html =
      '<a href="/local/incendio-forestal-en-pasto">Incendio forestal en Pasto</a>' +
      '<a href="/deportes/partido">Partido</a>' +
      '<a href="https://other.com/incendio">Incendio</a>';
    assert.deepEqual(extractFireArticleLinks(html, 'https://news.co/'), ['https://news.co/local/incendio-forestal-en-pasto']);
  });

  it('turns a wildfire article into a fire event', () => {
    const html = `<html><head>
      <meta property="og:title" content="Incendio forestal en Chachagüí">
      <meta property="article:published_time" content="2026-08-14T10:00:00-05:00"></head>
      <body><article><p>El fuego afectó 3,5 hectáreas de cobertura vegetal en la vereda Pasizara.</p></article></body></html>`;
    const event = articleToFireEvent(parseArticle(html), 'https://news.co/a', zones);
    assert.deepEqual(event, {
      zoneId: 'chachagui',
      place: 'Pasizara, Chachagüí',
      date: '2026-08-14',
      hectares: 3.5,
      source: 'news',
      sourceUrl: 'https://news.co/a',
    });
  });

  it('ignores house fires', () => {
    const article = { title: 'Incendio en una vivienda de Pasto', publishedAt: '2026-08-14', text: 'Bomberos atendieron la emergencia.' };
    assert.equal(articleToFireEvent(article, 'https://news.co/b', zones), undefined);
  });
});

describe('ungrdRowsToFireEvents', () => {
  it('maps rows of known municipalities and skips the rest', () => {
    const events = ungrdRowsToFireEvents(
      [
        { fecha: '2019-01-05T00:00:00.000', municipio: 'LA CRUZ', hectareas: '4' },
        { fecha: '2019-01-06T00:00:00.000', municipio: 'CUMBAL', hectareas: '2' },
        { fecha: '2019-01-07T00:00:00.000', municipio: 'PASTO', hectareas: 'n/a' },
      ],
      zones,
    );
    assert.deepEqual(
      events.map((e) => [e.zoneId, e.place, e.date, e.hectares, e.source]),
      [
        ['la-cruz', 'La Cruz', '2019-01-05', 4, 'ungrd'],
        ['pasto', 'Pasto', '2019-01-07', 0, 'ungrd'],
      ],
    );
  });
});
