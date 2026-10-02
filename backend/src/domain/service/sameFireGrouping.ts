import type { NewFireEvent } from '../model/FireEvent.js';

/** Two news of the same zone at most this many days apart are about the same fire. */
export const SAME_FIRE_MAX_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (isoDate: string): number => Math.round(Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS);
const isStored = (event: NewFireEvent): boolean => 'id' in event;

/** Oldest first; on the same day a stored event first (it keeps its row), then by URL (stable order). */
function compareEvents(a: NewFireEvent, b: NewFireEvent): number {
  return (
    a.date.localeCompare(b.date) ||
    Number(isStored(b)) - Number(isStored(a)) ||
    (a.sourceUrl ?? '').localeCompare(b.sourceUrl ?? '')
  );
}

/**
 * Groups the events of each zone into fires: an event joins the group when it is at most
 * SAME_FIRE_MAX_DAYS after the previous event of that group. The chain is on purpose: a fire in
 * the news for nine days (an article every day or two) stays one fire. Each group is oldest first.
 */
export function groupSameFires<T extends NewFireEvent>(events: readonly T[]): T[][] {
  const byZone = new Map<string, T[]>();
  for (const event of events) byZone.set(event.zoneId, [...(byZone.get(event.zoneId) ?? []), event]);

  const groups: T[][] = [];
  for (const zoneEvents of byZone.values()) {
    let current: T[] = [];
    for (const event of [...zoneEvents].sort(compareEvents)) {
      const previous = current.at(-1);
      if (previous && dayNumber(event.date) - dayNumber(previous.date) > SAME_FIRE_MAX_DAYS) {
        groups.push(current);
        current = [];
      }
      current.push(event);
    }
    if (current.length > 0) groups.push(current);
  }
  return groups;
}

/** A place with a locality ("Aminda, Cumbitara") says more than the bare municipality ("Cumbitara"). */
const hasLocality = (event: NewFireEvent): boolean => event.place.includes(',');

/**
 * One event for a group (oldest first, as groupSameFires returns it): date and link of the oldest
 * article, the largest burned area reported (later articles give the final figure), the first
 * locality found, and the other links as references.
 */
export function mergeSameFire(group: readonly NewFireEvent[]): NewFireEvent {
  const [principal] = group;
  if (!principal) throw new Error('mergeSameFire needs at least one event');
  const urls = group.flatMap((event) => [event.sourceUrl, ...(event.relatedUrls ?? [])]);
  const relatedUrls = [...new Set(urls)].filter((url): url is string => !!url && url !== principal.sourceUrl);
  return {
    zoneId: principal.zoneId,
    place: hasLocality(principal) ? principal.place : (group.find(hasLocality)?.place ?? principal.place),
    date: principal.date,
    hectares: Math.max(...group.map((event) => event.hectares)),
    source: principal.source,
    sourceUrl: principal.sourceUrl,
    relatedUrls,
  };
}
