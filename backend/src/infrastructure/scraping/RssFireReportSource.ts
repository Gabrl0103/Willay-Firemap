import * as cheerio from 'cheerio';
import type { NewFireEvent } from '../../domain/model/FireEvent.js';
import type { Zone } from '../../domain/model/Zone.js';
import type { FireReportBatch, FireReportSource } from '../../domain/port/DataSources.js';
import { articleToFireEvent, isWildfireArticle, type NewsArticle } from './NewsFireReportSource.js';
import type { PoliteHttpClient } from './PoliteHttpClient.js';

export interface RssFeedConfig {
  readonly name: string;
  /** RSS 2.0 feed, e.g. a WordPress search feed: https://site/search/incendio/feed/rss2/ */
  readonly feedUrl: string;
  /** Feed pages read per run (WordPress: 10 items each, "?paged=N"). */
  readonly maxPages: number;
}

export interface FeedItem {
  readonly link: string;
  readonly article: NewsArticle;
}

/** Colombia is UTC-5 all year (no daylight saving time). */
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

/** RSS date ("Thu, 23 Jul 2026 02:22:10 +0000") -> Colombia time ("2026-07-22T21:22:10-05:00"). */
export function toBogotaIso(rssDate: string): string | undefined {
  const time = Date.parse(rssDate);
  if (Number.isNaN(time)) return undefined;
  return `${new Date(time + BOGOTA_OFFSET_MS).toISOString().slice(0, 19)}-05:00`;
}

const htmlToText = (html: string): string => cheerio.load(html).root().text().replace(/\s+/g, ' ').trim();

/** Items of an RSS 2.0 feed. The body comes from content:encoded (whole post) or else description (excerpt). */
export function parseRssItems(xml: string): FeedItem[] {
  const $ = cheerio.load(xml, { xml: true });
  const items: FeedItem[] = [];
  $('item').each((_, element) => {
    const children = $(element).children();
    // Filtered by name: "content:encoded" is not a valid CSS selector.
    const field = (tag: string): string =>
      children
        .filter((_, child) => child.name === tag)
        .first()
        .text()
        .trim();
    const link = field('link');
    const title = htmlToText(field('title'));
    if (!link || !title) return;
    items.push({
      link,
      article: {
        title,
        publishedAt: toBogotaIso(field('pubDate')),
        text: htmlToText(field('content:encoded') || field('description')),
      },
    });
  });
  return items;
}

/**
 * News from an RSS feed (axios + cheerio): one request returns ten whole articles, so the site
 * gets far fewer requests than when scraping list pages and then every article.
 */
export class RssFireReportSource implements FireReportSource {
  constructor(
    private readonly feed: RssFeedConfig,
    private readonly http: PoliteHttpClient,
  ) {}

  get name(): string {
    return this.feed.name;
  }

  async fetchReports(zones: readonly Zone[], knownSourceUrls: ReadonlySet<string>): Promise<FireReportBatch> {
    let itemsRead = 0;
    let wildfireItems = 0;
    const events: NewFireEvent[] = [];
    for (let page = 1; page <= this.feed.maxPages; page++) {
      const url = page === 1 ? this.feed.feedUrl : `${this.feed.feedUrl}?paged=${page}`;
      let xml: string;
      try {
        xml = await this.http.getText(url);
      } catch (error) {
        if (page === 1) throw error;
        break; // WordPress answers 404 after the last page.
      }
      const items = parseRssItems(xml);
      if (items.length === 0) break;
      itemsRead += items.length;
      for (const item of items) {
        if (isWildfireArticle(item.article, zones)) wildfireItems++;
        if (knownSourceUrls.has(item.link)) continue;
        const event = articleToFireEvent(item.article, item.link, zones);
        if (event) events.push(event);
      }
    }
    return { itemsRead, wildfireItems, events };
  }
}
