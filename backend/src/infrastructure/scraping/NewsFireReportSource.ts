import * as cheerio from 'cheerio';
import type { NewFireEvent } from '../../domain/model/FireEvent.js';
import type { Zone } from '../../domain/model/Zone.js';
import type { FireReportBatch, FireReportSource } from '../../domain/port/DataSources.js';
import { findMentionedZone, findZoneByName } from '../../domain/service/zoneMatching.js';
import type { PoliteHttpClient } from './PoliteHttpClient.js';

export interface NewsSiteConfig {
  readonly name: string;
  /** Pages with lists of articles (home, section, search). */
  readonly listUrls: readonly string[];
  /** Articles read per run, to keep the load on the site low. */
  readonly maxArticlesPerRun: number;
}

export interface NewsArticle {
  readonly title: string;
  /** ISO date-time as published by the site, if found. */
  readonly publishedAt?: string;
  readonly text: string;
}

const FIRE_WORD = /incendi/i;
/**
 * "incendio" in singular: the article reports one fire. Titles such as "medidas ante los incendios"
 * or "tres incendios activos" are bulletins whose towns and hectares do not belong to one event.
 */
const ONE_FIRE = /\bincendio\b/i;
/** Plural: kept only when the title also names a municipality ("PMU en Santacruz ... de los incendios"). */
const SOME_FIRES = /\bincendios\b/i;
/**
 * Wildfire vocabulary, to leave out house and vehicle fires. Whole words only: "esquema" is not
 * "quema" (a press release about burned houses got through that way).
 */
const VEGETATION_WORDS =
  /\b(?:forestal(?:es)?|cobertura vegetal|vegetaci[oó]n|bosques?|hect[aá]reas?|p[aá]ramos?|montes?|pastizal(?:es)?|rastrojos?|quemas?)\b/i;
/** Buildings: a fire that mentions them is urban unless it also names vegetation (STRONG_WILDFIRE_WORDS). */
const BUILDING_WORDS = /\b(?:viviendas?|casas?|local(?:es)?|bodegas?|establecimientos?)\b/i;
/** Words that only fit a wildfire ("hectáreas" does not: houses and crops are counted in hectares too). */
const STRONG_WILDFIRE_WORDS = /\b(?:forestal(?:es)?|bosques?|montes?|p[aá]ramos?|cobertura vegetal|quemas?)\b/i;

/** Links on a list page that look like fire news (same site only, without #fragment). */
export function extractFireArticleLinks(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const host = new URL(pageUrl).host;
  const links = new Set<string>();
  $('a[href]').each((_, element) => {
    const anchor = $(element);
    const href = anchor.attr('href') ?? '';
    if (!FIRE_WORD.test(anchor.text()) && !FIRE_WORD.test(href)) return;
    try {
      const url = new URL(href, pageUrl);
      url.hash = '';
      if (url.host === host && url.pathname !== '/') links.add(url.toString());
    } catch {
      // Malformed href: ignore it.
    }
  });
  return [...links];
}

/** Title, date and body of an article page, from standard meta tags with HTML fallbacks. */
export function parseArticle(html: string): NewsArticle {
  const $ = cheerio.load(html);
  const meta = (selector: string): string | undefined => $(selector).attr('content')?.trim() || undefined;

  const title = meta('meta[property="og:title"]') ?? ($('h1').first().text().trim() || $('title').text().trim());
  const publishedAt =
    meta('meta[property="article:published_time"]') ??
    ($('time[datetime]').first().attr('datetime') || undefined) ??
    /"datePublished"\s*:\s*"([^"]+)"/.exec(html)?.[1];

  const paragraphs = $('article p').length > 0 ? $('article p') : $('p');
  const body = paragraphs
    .map((_, element) => $(element).text().trim())
    .get()
    .join(' ');
  const description = meta('meta[name="description"]') ?? meta('meta[property="og:description"]') ?? '';
  return { title, publishedAt, text: `${description} ${body}`.replace(/\s+/g, ' ').trim() };
}

/** Spanish number: "1.200" -> 1200, "2,5" -> 2.5, "2.5" -> 2.5. */
function parseSpanishNumber(raw: string): number {
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) return Number(raw.replace(/\./g, '').replace(',', '.'));
  return Number(raw.replace(',', '.'));
}

/** First "N hectáreas" in the text. ("ha" is skipped: it is also a common Spanish verb.) */
export function extractHectares(text: string): number | undefined {
  const match = /(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+[.,]\d+|\d+)\s*hect[aá]reas?\b/i.exec(text);
  if (!match?.[1]) return undefined;
  const value = parseSpanishNumber(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

/** "vereda El Motilón", "corregimiento de Jongovito", "sector La Cañada" -> the proper name. */
export function extractLocality(text: string): string | undefined {
  const match =
    /\b(?:[Vv]ereda|[Cc]orregimiento|[Ss]ector)\s+(?:de\s+)?(\p{Lu}\p{L}+(?:\s+(?:(?:de|del|la|las|los|el)\s+)?\p{Lu}\p{L}+){0,2})/u.exec(
      text,
    );
  return match?.[1];
}

/** "municipio de La Unión", "Distrito de Tumaco" (singular: "Municipios de A, B y C" is a list, not the place). */
const MUNICIPALITY_PHRASE =
  /\b(?:[Mm]unicipio|[Dd]istrito)\s+(?:de\s+|del\s+)?(\p{Lu}\p{L}+(?:\s+(?:(?:de|del|la|las|los|el)\s+)?\p{Lu}\p{L}+){0,3})/u;

/**
 * Municipality where the fire happened, if it is one of the zones: the zone named in the title,
 * otherwise the first "municipio de X" of the text. Other mentions are ignored on purpose:
 * department-wide bulletins list many towns (aid, equipment) that did not burn.
 */
export function findArticleZone(title: string, text: string, zones: readonly Zone[]): Zone | undefined {
  const inTitle = findMentionedZone(title, zones);
  if (inTitle) return inTitle;
  const municipality = MUNICIPALITY_PHRASE.exec(text)?.[1];
  if (!municipality) return undefined;
  return findZoneByName(municipality, zones) ?? findMentionedZone(municipality, zones);
}

/**
 * The title reports a fire ("incendio", or "incendios" next to the name of one of the zones) and the
 * article says it burned vegetation. Fires of houses, shops or warehouses are left out unless the
 * article also talks about forest, páramo or vegetation cover. Without zones only the singular counts.
 */
export function isWildfireArticle(article: NewsArticle, zones: readonly Zone[] = []): boolean {
  const fullText = `${article.title}. ${article.text}`;
  const titleReportsFire =
    ONE_FIRE.test(article.title) ||
    (SOME_FIRES.test(article.title) && findMentionedZone(article.title, zones) !== undefined);
  if (!titleReportsFire || !VEGETATION_WORDS.test(fullText)) return false;
  return !BUILDING_WORDS.test(fullText) || STRONG_WILDFIRE_WORDS.test(fullText);
}

/** Turns an article into a fire event, or undefined when it is not a wildfire in a known zone. */
export function articleToFireEvent(
  article: NewsArticle,
  url: string,
  zones: readonly Zone[],
): NewFireEvent | undefined {
  if (!isWildfireArticle(article, zones)) return undefined;
  const fullText = `${article.title}. ${article.text}`;

  const zone = findArticleZone(article.title, article.text, zones);
  const date = article.publishedAt?.slice(0, 10);
  if (!zone || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;

  const locality = extractLocality(fullText);
  return {
    zoneId: zone.id,
    place: locality && locality !== zone.name ? `${locality}, ${zone.name}` : zone.name,
    date,
    hectares: extractHectares(fullText) ?? 0,
    source: 'news',
    sourceUrl: url,
  };
}

/** Generic news scraper (axios + cheerio): list pages -> fire articles -> events. */
export class NewsFireReportSource implements FireReportSource {
  /** Cache: an article is read only once while the process lives. */
  private readonly visited = new Set<string>();

  constructor(
    private readonly site: NewsSiteConfig,
    private readonly http: PoliteHttpClient,
  ) {}

  get name(): string {
    return this.site.name;
  }

  async fetchReports(zones: readonly Zone[], knownSourceUrls: ReadonlySet<string>): Promise<FireReportBatch> {
    const links = new Set<string>();
    const listErrors: string[] = [];
    for (const listUrl of this.site.listUrls) {
      try {
        for (const link of extractFireArticleLinks(await this.http.getText(listUrl), listUrl)) links.add(link);
      } catch (error) {
        listErrors.push(`${listUrl}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (listErrors.length === this.site.listUrls.length) throw new Error(listErrors.join('; '));

    const pending = [...links]
      .filter((link) => !this.visited.has(link) && !knownSourceUrls.has(link))
      .slice(0, this.site.maxArticlesPerRun);
    let wildfireItems = 0;
    const events: NewFireEvent[] = [];
    for (const link of pending) {
      this.visited.add(link);
      try {
        const article = parseArticle(await this.http.getText(link));
        if (isWildfireArticle(article, zones)) wildfireItems++;
        const event = articleToFireEvent(article, link, zones);
        if (event) events.push(event);
      } catch (error) {
        console.warn(`[${this.name}] skipped ${link}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { itemsRead: pending.length, wildfireItems, events };
  }
}
