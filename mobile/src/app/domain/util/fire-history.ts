import type { FireEvent, FireSource } from '../model/risk';
import { formatDateMedium } from './format';

const SOURCE_NAMES: Record<FireSource, string> = { ungrd: 'UNGRD', news: 'noticias locales' };

const yearOf = (event: FireEvent): number => Number(event.date.slice(0, 4));

/** First day of the fire records: FIRE_RECORD_START in the backend (the UNGRD data starts on 2019-01-02). */
export const RECORD_START = '2019-01-01';
const RECORD_START_YEAR = Number(RECORD_START.slice(0, 4));
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

/** Newest first. Dates are ISO (YYYY-MM-DD), so text order is date order. */
export function sortByDateDesc(events: readonly FireEvent[]): FireEvent[] {
  return [...events].sort((a, b) => b.date.localeCompare(a.date));
}

/** A burned area is known only when it is a positive number. */
export function hasHectares(hectares: number | null | undefined): hectares is number {
  return typeof hectares === 'number' && Number.isFinite(hectares) && hectares > 0;
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

/** Local calendar day of a date, as ISO (YYYY-MM-DD). */
export function toIsoDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Period the records cover, from the start of the data to today: { from: "1 ene 2019", to: "6 oct 2026" }. */
export function recordPeriod(now: Date): { from: string; to: string } {
  return { from: formatDateMedium(RECORD_START), to: formatDateMedium(toIsoDate(now)) };
}

export interface YearCount {
  readonly year: number;
  readonly count: number;
}

/**
 * Fires per calendar year from the start of the records to the current year. Years without
 * fires are kept at 0, so the chart has no gaps.
 */
export function countsByYear(events: readonly FireEvent[], now: Date): YearCount[] {
  const counts = new Map<number, number>();
  for (const event of events) counts.set(yearOf(event), (counts.get(yearOf(event)) ?? 0) + 1);
  const first = Math.min(RECORD_START_YEAR, ...counts.keys());
  const last = Math.max(now.getFullYear(), ...counts.keys());
  return Array.from({ length: last - first + 1 }, (_, i) => ({ year: first + i, count: counts.get(first + i) ?? 0 }));
}

/** Year with the most fires (the most recent one on a tie), or null when there are none. */
export function peakYear(counts: readonly YearCount[]): YearCount | null {
  return counts.reduce<YearCount | null>((peak, c) => (c.count > 0 && c.count >= (peak?.count ?? 0) ? c : peak), null);
}

/**
 * Fires per year since the start of the records: fires in the period / years elapsed until now.
 * Same formula as the backend uses for the history factor (backend/src/domain/service/fireFrequency.ts),
 * so the zone sheet and the history page agree with the score.
 */
export function averagePerYear(events: readonly FireEvent[], now: Date): number {
  const start = Date.parse(`${RECORD_START}T00:00:00Z`);
  const end = now.getTime();
  const years = (end - start) / YEAR_MS;
  if (!(years > 0)) return 0;
  const count = events.filter((event) => {
    const time = Date.parse(`${event.date.slice(0, 10)}T00:00:00Z`);
    return time >= start && time <= end;
  }).length;
  return count / years;
}

/** "Aminda, Cumbitara" -> { name: "Aminda", municipality: "Cumbitara" }; "Pasto" has no locality. */
export function splitPlace(place: string): { name: string; municipality: string | null } {
  const comma = place.lastIndexOf(',');
  if (comma < 0) return { name: place.trim(), municipality: null };
  return { name: place.slice(0, comma).trim(), municipality: place.slice(comma + 1).trim() || null };
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
