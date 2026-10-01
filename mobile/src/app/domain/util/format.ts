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
