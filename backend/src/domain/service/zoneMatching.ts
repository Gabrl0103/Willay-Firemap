import type { Zone } from '../model/Zone.js';

const stripAccents = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '');
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "  CHACHAGÜÍ " -> "chachagui". */
export const normalizeName = (text: string): string =>
  stripAccents(text).toLowerCase().replace(/\s+/g, ' ').trim();

/** Zone whose name is the given one, ignoring case and accents (official datasets write "CHACHAGUI"). */
export function findZoneByName(name: string, zones: readonly Zone[]): Zone | undefined {
  const wanted = normalizeName(name);
  return zones.find((zone) => normalizeName(zone.name) === wanted);
}

/**
 * Zone mentioned first in a free text (news). Accent-insensitive but case-sensitive, so the city
 * "Pasto" is not confused with "pasto" (grass); "La Cruz Roja" does not count as the town La Cruz.
 */
export function findMentionedZone(text: string, zones: readonly Zone[]): Zone | undefined {
  const plain = stripAccents(text);
  let first: { zone: Zone; index: number } | undefined;
  for (const zone of zones) {
    const pattern = new RegExp(`\\b${escapeRegExp(stripAccents(zone.name))}\\b(?!\\s+Roja)`);
    const match = pattern.exec(plain);
    if (match && (!first || match.index < first.index)) first = { zone, index: match.index };
  }
  return first?.zone;
}
