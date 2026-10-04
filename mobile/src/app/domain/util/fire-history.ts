import type { FireEvent, FireSource } from '../model/risk';
import { formatHectares } from './format';

/** Shown when a fire has no burned area (the sources write 0 or leave it out). */
export const NO_DATA = 'Sin dato';

const SOURCE_NAMES: Record<FireSource, string> = { ungrd: 'UNGRD', news: 'noticias locales' };

const yearOf = (event: FireEvent): number => Number(event.date.slice(0, 4));

/** Newest first. Dates are ISO (YYYY-MM-DD), so text order is date order. */
export function sortByDateDesc(events: readonly FireEvent[]): FireEvent[] {
  return [...events].sort((a, b) => b.date.localeCompare(a.date));
}

/** A burned area is known only when it is a positive number. */
export function hasHectares(hectares: number | null | undefined): hectares is number {
  return typeof hectares === 'number' && Number.isFinite(hectares) && hectares > 0;
}

/** Sum of the known burned areas ("12,5"), or "Sin dato" when no fire has one. */
export function totalHectaresLabel(events: readonly FireEvent[]): string {
  const known = events.map((event) => event.hectares).filter(hasHectares);
  return known.length > 0 ? formatHectares(known.reduce((sum, value) => sum + value, 0)) : NO_DATA;
}

/** 2019, 2022 -> "2019–2022"; 2026, 2026 -> "2026". */
function yearRange(from: number, to: number): string {
  return from === to ? `${from}` : `${from}–${to}`;
}

/** Invisible character that forbids a line break where it stands. */
export const WORD_JOINER = String.fromCharCode(0x2060);

/** Word joiner after the dash of "2023–2025", so a line never breaks inside a year range. */
export function keepYearRangesTogether(text: string): string {
  return text.replace(/(\d{4})–(\d{4})/g, `$1–${WORD_JOINER}$2`);
}

/** "a", "a y b", "a, b y c". */
function joinSpanish(items: readonly string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
}

/** Eyebrow of the history page: "Registros 2019–2026" from the dates of the events shown. */
export function recordsRangeLabel(events: readonly FireEvent[]): string {
  if (events.length === 0) return 'Sin registros';
  const years = events.map(yearOf);
  return `Registros ${yearRange(Math.min(...years), Math.max(...years))}`;
}

/**
 * Where the records come from and which years are empty, e.g.
 * "Fuentes: UNGRD (2019–2022) y noticias locales (2026). Sin datos de 2023–2025."
 * Sources are listed by their first year; a gap is a year between the first and the last record
 * without any fire. Empty string when there are no events.
 */
export function coverageNote(events: readonly FireEvent[]): string {
  if (events.length === 0) return '';
  const bySource = new Map<FireSource, { from: number; to: number }>();
  for (const event of events) {
    const year = yearOf(event);
    const range = bySource.get(event.source);
    bySource.set(event.source, range ? { from: Math.min(range.from, year), to: Math.max(range.to, year) } : { from: year, to: year });
  }
  const sources = [...bySource.entries()]
    .sort(([, a], [, b]) => a.from - b.from || a.to - b.to)
    .map(([source, { from, to }]) => `${SOURCE_NAMES[source]} (${yearRange(from, to)})`);

  const years = new Set(events.map(yearOf));
  const first = Math.min(...years);
  const last = Math.max(...years);
  const gaps: string[] = [];
  for (let year = first; year <= last; year++) {
    if (years.has(year)) continue;
    let end = year;
    while (end + 1 <= last && !years.has(end + 1)) end++;
    gaps.push(yearRange(year, end));
    year = end;
  }

  const note = `Fuentes: ${joinSpanish(sources)}.`;
  return gaps.length > 0 ? `${note} Sin datos de ${joinSpanish(gaps)}.` : note;
}
