const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Average fires per year of a zone between `recordStart` and `now` (dates YYYY-MM-DD).
 * Uses the whole record instead of a recent window: the sources cover different years
 * (UNGRD 2019-2022, news since 2026), so a window would measure the data gaps, not the zone.
 */
export function firesPerYear(fireDates: readonly string[], recordStart: string, now: Date): number {
  const start = Date.parse(`${recordStart}T00:00:00Z`);
  const end = now.getTime();
  const years = (end - start) / YEAR_MS;
  if (!(years > 0)) return 0;
  const count = fireDates.filter((date) => {
    const time = Date.parse(`${date}T00:00:00Z`);
    return time >= start && time <= end;
  }).length;
  return count / years;
}
