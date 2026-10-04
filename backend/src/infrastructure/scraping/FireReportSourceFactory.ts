import type { FireReportSource } from '../../domain/port/DataSources.js';
import { NewsFireReportSource, type NewsSiteConfig } from './NewsFireReportSource.js';
import { PoliteHttpClient } from './PoliteHttpClient.js';
import { RssFireReportSource, type RssFeedConfig } from './RssFireReportSource.js';
import { UNGRD_DATASETS, UngrdFireReportSource } from './UngrdFireReportSource.js';

/**
 * Local news with an RSS feed. robots.txt checked on 2026-10-01:
 * - Gobernación de Nariño (narino.gov.co): "User-agent: *" -> Allow: /, Crawl-delay: 3.
 *   Its WordPress search feed returns whole press releases (the Gestión del Riesgo office reports
 *   every wildfire it attends), 10 per page. On 2026-10-04 it had 55 items (6 pages, back to
 *   2024-01); 8 pages leave room for new ones. The reader stops at the first empty page.
 */
const NEWS_FEEDS: readonly RssFeedConfig[] = [
  { name: 'gobernacion-narino', feedUrl: 'https://narino.gov.co/search/incendio/feed/rss2/', maxPages: 8 },
];

/**
 * News sites without a feed (list pages + one request per article). Empty for now:
 * - Diario del Sur gave 0 results (removed 2026-10-01).
 * - HSB Noticias resolves again and its robots.txt allows "*", but it blocks AI agents by name
 *   (Claude-User, ClaudeBot), so its HTML was not inspected and no list URL is verified.
 */
const NEWS_SITES: readonly NewsSiteConfig[] = [];

/** Factory: builds every fire source with one shared, rate-limited HTTP client. */
export function createFireReportSources(): FireReportSource[] {
  const http = new PoliteHttpClient({
    productToken: 'WillayBot',
    userAgent: 'WillayBot/0.1 (academic project: wildfire risk in Narino, Colombia)',
    minDelayMs: 5_000,
    timeoutMs: 20_000,
  });
  return [
    ...UNGRD_DATASETS.map((dataset) => new UngrdFireReportSource(dataset, http)),
    ...NEWS_FEEDS.map((feed) => new RssFireReportSource(feed, http)),
    ...NEWS_SITES.map((site) => new NewsFireReportSource(site, http)),
  ];
}
