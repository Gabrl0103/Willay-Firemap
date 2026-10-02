import type { Zone } from '../model/Zone.js';

const stripAccents = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '');
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "  CHACHAGÜÍ " -> "chachagui". */
export const normalizeName = (text: string): string =>
  stripAccents(text).toLowerCase().replace(/\s+/g, ' ').trim();

const namesOf = (zone: Zone): readonly string[] => [zone.name, ...(zone.aliases ?? [])];

/** The municipality of Nariño shares its name with the department, which is what free text means by it. */
const DEPARTMENT_NAME = 'narino';

/** Zone whose name or alias is the given one, ignoring case and accents (official datasets write "CHACHAGUI"). */
export function findZoneByName(name: string, zones: readonly Zone[]): Zone | undefined {
  const wanted = normalizeName(name);
  return zones.find((zone) => namesOf(zone).some((zoneName) => normalizeName(zoneName) === wanted));
}

/**
 * Zone mentioned first in a free text (news). Accent-insensitive but case-sensitive, so the city
 * "Pasto" is not confused with "pasto" (grass); "La Cruz Roja" does not count as the town La Cruz.
 * At the same position the longest name wins ("Santa Bárbara de Iscuandé" over "Santa Bárbara").
 * "Nariño" alone is skipped: it is the department; use findZoneByName for "municipio de Nariño".
 */
export function findMentionedZone(text: string, zones: readonly Zone[]): Zone | undefined {
  const plain = stripAccents(text);
  let first: { zone: Zone; index: number; length: number } | undefined;
  for (const zone of zones) {
    for (const name of namesOf(zone)) {
      if (normalizeName(name) === DEPARTMENT_NAME) continue;
      const match = new RegExp(`\\b${escapeRegExp(stripAccents(name))}\\b(?!\\s+Roja)`).exec(plain);
      if (!match) continue;
      if (!first || match.index < first.index || (match.index === first.index && name.length > first.length)) {
        first = { zone, index: match.index, length: name.length };
      }
    }
  }
  return first?.zone;
}
