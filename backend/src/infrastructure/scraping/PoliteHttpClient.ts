import axios, { type AxiosInstance } from 'axios';
import { ALLOW_ALL, parseRobotsTxt, type RobotsRules } from './robotsTxt.js';

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`robots.txt does not allow ${url}`);
    this.name = 'RobotsDisallowedError';
  }
}

export interface PoliteHttpOptions {
  /** Name the sites see in their logs and match in robots.txt. */
  readonly productToken: string;
  readonly userAgent: string;
  /** Minimum time between two requests to the same host (Crawl-delay may ask for more). */
  readonly minDelayMs: number;
  readonly timeoutMs: number;
}

const ROBOTS_CACHE_MS = 24 * 60 * 60 * 1000;
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * HTTP client for scraping: checks robots.txt before every URL (cached 24 h)
 * and spaces the requests to each host. Shared by all scrapers (Singleton in the container).
 */
export class PoliteHttpClient {
  private readonly http: AxiosInstance;
  private readonly robots = new Map<string, { rules: RobotsRules; expiresAt: number }>();
  private readonly nextRequestAt = new Map<string, number>();

  constructor(private readonly options: PoliteHttpOptions) {
    this.http = axios.create({
      timeout: options.timeoutMs,
      headers: { 'User-Agent': options.userAgent },
      maxRedirects: 3,
    });
  }

  async getText(url: string): Promise<string> {
    return this.get<string>(url, 'text');
  }

  async getJson<T>(url: string): Promise<T> {
    return this.get<T>(url, 'json');
  }

  private async get<T>(url: string, responseType: 'text' | 'json'): Promise<T> {
    const rules = await this.rulesFor(new URL(url).origin);
    if (!rules.isAllowed(url)) throw new RobotsDisallowedError(url);
    await this.waitTurn(new URL(url).host, rules.crawlDelaySeconds);
    const { data } = await this.http.get<T>(url, { responseType });
    return data;
  }

  private async rulesFor(origin: string): Promise<RobotsRules> {
    const cached = this.robots.get(origin);
    if (cached && cached.expiresAt > Date.now()) return cached.rules;

    await this.waitTurn(new URL(origin).host);
    const response = await this.http.get<string>(`${origin}/robots.txt`, {
      responseType: 'text',
      validateStatus: () => true,
    });
    let rules: RobotsRules;
    if (response.status >= 200 && response.status < 300) {
      rules = parseRobotsTxt(String(response.data), this.options.productToken);
    } else if (response.status >= 400 && response.status < 500) {
      rules = ALLOW_ALL; // RFC 9309: no robots.txt means no restrictions.
    } else {
      // RFC 9309: if robots.txt cannot be read, assume everything is disallowed.
      throw new Error(`robots.txt of ${origin} answered ${response.status}; skipping the site`);
    }
    this.robots.set(origin, { rules, expiresAt: Date.now() + ROBOTS_CACHE_MS });
    return rules;
  }

  /** Reserves the next free slot for the host and waits for it. */
  private async waitTurn(host: string, crawlDelaySeconds = 0): Promise<void> {
    const gap = Math.max(this.options.minDelayMs, crawlDelaySeconds * 1000);
    const now = Date.now();
    const slot = Math.max(now, this.nextRequestAt.get(host) ?? 0);
    this.nextRequestAt.set(host, slot + gap);
    if (slot > now) await sleep(slot - now);
  }
}
