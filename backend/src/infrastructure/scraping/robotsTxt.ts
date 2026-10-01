/** Minimal robots.txt reader (RFC 9309) plus the non-standard Crawl-delay. */

export interface RobotsRules {
  isAllowed(url: string): boolean;
  /** Seconds between requests asked by the site, if any. */
  readonly crawlDelaySeconds?: number;
}

interface Rule {
  readonly allow: boolean;
  readonly pattern: string;
  readonly regex: RegExp;
}

interface Group {
  readonly agents: string[];
  readonly rules: Rule[];
  crawlDelay?: number;
}

/** "*" matches any sequence and a final "$" anchors the end; everything else is literal. */
function toRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

function parseGroups(content: string): Group[] {
  const groups: Group[] = [];
  let current: Group | undefined;
  let lastWasAgent = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;

    if ((key === 'allow' || key === 'disallow') && value) {
      current.rules.push({ allow: key === 'allow', pattern: value, regex: toRegex(value) });
    } else if (key === 'crawl-delay') {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) current.crawlDelay = seconds;
    }
  }
  return groups;
}

/** Rules that apply to `productToken` (e.g. "WillayBot"): its own groups, or the "*" groups. */
export function parseRobotsTxt(content: string, productToken: string): RobotsRules {
  const groups = parseGroups(content);
  const token = productToken.toLowerCase();
  const own = groups.filter((group) => group.agents.includes(token));
  const selected = own.length > 0 ? own : groups.filter((group) => group.agents.includes('*'));
  const rules = selected.flatMap((group) => group.rules);
  const delays = selected.map((group) => group.crawlDelay).filter((delay) => delay !== undefined);

  return {
    crawlDelaySeconds: delays.length > 0 ? Math.max(...delays) : undefined,
    isAllowed(url: string): boolean {
      const { pathname, search } = new URL(url);
      if (pathname === '/robots.txt') return true;
      const path = pathname + search;
      // The longest matching pattern wins; on a tie, Allow wins.
      let best: Rule | undefined;
      for (const rule of rules) {
        if (!rule.regex.test(path)) continue;
        if (
          !best ||
          rule.pattern.length > best.pattern.length ||
          (rule.pattern.length === best.pattern.length && rule.allow)
        ) {
          best = rule;
        }
      }
      return best?.allow ?? true;
    },
  };
}

/** Used when robots.txt does not exist (4xx): everything is allowed. */
export const ALLOW_ALL: RobotsRules = { isAllowed: () => true };
