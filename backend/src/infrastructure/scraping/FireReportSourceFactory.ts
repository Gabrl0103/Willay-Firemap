import type { FireReportSource } from '../../domain/port/DataSources.js';
import { NewsFireReportSource, type NewsSiteConfig } from './NewsFireReportSource.js';
import { PoliteHttpClient } from './PoliteHttpClient.js';
import { UngrdFireReportSource } from './UngrdFireReportSource.js';

/**
 * News sites checked against their robots.txt on 2026-09-30:
 * - Diario del Sur: "User-agent: *" -> Allow: / (it only blocks AI crawlers by name).
 *   The list URLs are not verified yet (see docs/REQUIREMENTS.md, section 12).
 * - HSB Noticias: the domain did not resolve, so it is left out.
 */
const NEWS_SITES: readonly NewsSiteConfig[] = [
  {
    name: 'diario-del-sur',
    listUrls: ['https://diariodelsur.com.co/', 'https://diariodelsur.com.co/?s=incendio'],
    maxArticlesPerRun: 15,
  },
];

/** Factory: builds every fire source with one shared, rate-limited HTTP client. */
export function createFireReportSources(): FireReportSource[] {
  const http = new PoliteHttpClient({
    productToken: 'WillayBot',
    userAgent: 'WillayBot/0.1 (academic project: wildfire risk in Narino, Colombia)',
    minDelayMs: 5_000,
    timeoutMs: 20_000,
  });
  return [new UngrdFireReportSource(http), ...NEWS_SITES.map((site) => new NewsFireReportSource(site, http))];
}
