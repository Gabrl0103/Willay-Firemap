import { LOCALES, translate, type Language } from '../../i18n/translate';

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** Some browsers put a narrow no-break space before «PM»: a plain space reads (and tests) the same everywhere. */
const plainSpaces = (text: string): string => text.replace(/[  ]/g, ' ');

/** "2025-09-02" as a local date (no time zone shift: the records are days, not instants). */
function isoDate(iso: string): Date {
  const [year = 1970, month = 1, day = 1] = iso.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function shortMonth(date: Date, language: Language): string {
  return language === 'es'
    ? (MONTHS_ES[date.getMonth()] ?? '')
    : new Intl.DateTimeFormat(LOCALES.en, { month: 'short' }).format(date);
}

/** "2025-09-02" -> { day: "02", month: "sept" | "Sep", year: "2025" } (the day keeps its leading zero). */
export function dateParts(iso: string, language: Language = 'es'): { day: string; month: string; year: string } {
  const [year = '', , day = '1'] = iso.slice(0, 10).split('-');
  return { day, month: shortMonth(isoDate(iso), language), year };
}

/** "2026-09-18" -> "18 de sept de 2026" | "Sep 18, 2026" */
export function formatDateLong(iso: string, language: Language = 'es'): string {
  const date = isoDate(iso);
  return language === 'es'
    ? `${date.getDate()} de ${shortMonth(date, 'es')} de ${date.getFullYear()}`
    : new Intl.DateTimeFormat(LOCALES.en, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

/** "2019-01-01" -> "1 ene 2019" | "Jan 1, 2019" */
export function formatDateMedium(iso: string, language: Language = 'es'): string {
  const date = isoDate(iso);
  return language === 'es'
    ? `${date.getDate()} ${shortMonth(date, 'es')} ${date.getFullYear()}`
    : new Intl.DateTimeFormat(LOCALES.en, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

/** At most one decimal, none when it is whole: 3 -> "3", 1.5 -> "1,5" | "1.5". */
export function formatDecimal(value: number, language: Language = 'es'): string {
  return value.toLocaleString(LOCALES[language], { maximumFractionDigits: 1 });
}

/** Day of an update, relative to now (local time): "hoy" | "today", "ayer" | "yesterday", or "3 oct" | "Oct 3". */
export function formatUpdatedDay(date: Date, language: Language = 'es', now: Date = new Date()): string {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return translate(language, 'time.today');
  if (date.toDateString() === yesterday.toDateString()) return translate(language, 'time.yesterday');
  return language === 'es'
    ? `${date.getDate()} ${shortMonth(date, 'es')}`
    : new Intl.DateTimeFormat(LOCALES.en, { month: 'short', day: 'numeric' }).format(date);
}

/** Hour of the map's «Actualizado»: "05:07 p. m." | "05:07 PM". */
export function formatTime(date: Date, language: Language = 'es'): string {
  return plainSpaces(date.toLocaleTimeString(LOCALES[language], { hour: '2-digit', minute: '2-digit' }));
}

/** Local date and time, 12 h: "24 oct. 2026, 5:07 p. m." | "Oct 24, 2026, 5:07 PM" (what «Compartir» says). */
export function formatDateTime(date: Date, language: Language = 'es'): string {
  if (language === 'en') {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' };
    return plainSpaces(new Intl.DateTimeFormat(LOCALES.en, options).format(date));
  }
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = hours < 12 ? 'a. m.' : 'p. m.';
  return `${date.getDate()} ${shortMonth(date, 'es')}. ${date.getFullYear()}, ${hours % 12 || 12}:${minutes} ${period}`;
}

/** A 0–100 value as "70 %" | "70%" (Spanish keeps the space before the sign). */
export function formatPercent(value: number | string, language: Language = 'es'): string {
  return `${value}${language === 'es' ? ' %' : '%'}`;
}

/** "24 %" | "24%", or "<1 %" so a tiny probability does not read as zero. */
export function percentLabel(probability: number, language: Language = 'es'): string {
  const percent = Math.round(probability * 100);
  return formatPercent(percent < 1 ? '<1' : percent, language);
}

const HOUR_MS = 60 * 60 * 1000;

/** "hace 5 h" | "5 h ago", "hace 3 días" | "3 days ago" (hours under a day, so "ayer" is never ambiguous). */
export function formatTimeAgo(iso: string, language: Language = 'es', now: Date = new Date()): string {
  const hours = Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / HOUR_MS));
  if (hours < 1) return translate(language, 'time.lessThanHourAgo');
  if (hours < 24) return translate(language, 'time.hoursAgo', { count: hours });
  return translate(language, 'time.daysAgo', { count: Math.floor(hours / 24) });
}
