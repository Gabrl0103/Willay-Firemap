const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

function parts(iso: string): { day: string; month: string; year: string } {
  const [year = '', month = '1', day = '1'] = iso.slice(0, 10).split('-');
  return { day, month: MONTHS[Number(month) - 1] ?? '', year };
}

/** "2026-09-18" -> "18 de sept de 2026" */
export function formatDateLong(iso: string): string {
  const { day, month, year } = parts(iso);
  return `${Number(day)} de ${month} de ${year}`;
}

/** "2026-09-18" -> "18 sept" */
export function formatDateShort(iso: string): string {
  const { day, month } = parts(iso);
  return `${Number(day)} ${month}`;
}

/** 2.5 -> "2,5" */
export function formatHectares(value: number): string {
  return value.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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
