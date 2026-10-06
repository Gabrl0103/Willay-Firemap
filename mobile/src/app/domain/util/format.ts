const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** "2025-09-02" -> { day: "02", month: "sept", year: "2025" } (the day keeps its leading zero). */
export function dateParts(iso: string): { day: string; month: string; year: string } {
  const [year = '', month = '1', day = '1'] = iso.slice(0, 10).split('-');
  return { day, month: MONTHS[Number(month) - 1] ?? '', year };
}

/** "2026-09-18" -> "18 de sept de 2026" */
export function formatDateLong(iso: string): string {
  const { day, month, year } = dateParts(iso);
  return `${Number(day)} de ${month} de ${year}`;
}

/** "2019-01-01" -> "1 ene 2019" */
export function formatDateMedium(iso: string): string {
  const { day, month, year } = dateParts(iso);
  return `${Number(day)} ${month} ${year}`;
}

/** At most one decimal, none when it is whole: 3 -> "3", 1.5 -> "1,5", 3.57 -> "3,6". */
export function formatDecimal(value: number): string {
  return value.toLocaleString('es-CO', { maximumFractionDigits: 1 });
}

/** Day of an update, relative to now (local time): "hoy", "ayer" or "3 oct". */
export function formatUpdatedDay(date: Date, now: Date = new Date()): string {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'hoy';
  if (date.toDateString() === yesterday.toDateString()) return 'ayer';
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

const HOUR_MS = 60 * 60 * 1000;

/** "hace 5 h", "hace 1 día", "hace 3 días" (hours under a day, so "ayer" is never ambiguous). */
export function formatTimeAgo(iso: string, now: Date = new Date()): string {
  const hours = Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / HOUR_MS));
  if (hours < 1) return 'hace menos de 1 h';
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}
