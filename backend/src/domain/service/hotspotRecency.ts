const DAY_MS = 24 * 60 * 60 * 1000;

/** Days of NASA FIRMS detections the ingestion keeps (FIRMS area API day range, UTC days up to today). */
export const HOTSPOT_WINDOW_DAYS = 5;
/** Detections up to this age count fully: the 2-day window the model used before (v0.19). */
export const HOTSPOT_FULL_WEIGHT_DAYS = 2;

/** Age in days of a detection (negative when the clock of the source is ahead). NaN for a bad date. */
export function hotspotAgeDays(detectedAt: string, now: Date): number {
  return (now.getTime() - Date.parse(detectedAt)) / DAY_MS;
}

/**
 * How much a hotspot counts for the 24-72 h risk: 1 while it is at most 2 days old, then less and
 * less until 0 at 5 days. So widening the window from 2 to 5 days keeps the factor the same for
 * recent fires, and older ones only add a little.
 */
export function hotspotWeight(detectedAt: string, now: Date): number {
  const age = hotspotAgeDays(detectedAt, now);
  if (Number.isNaN(age) || age >= HOTSPOT_WINDOW_DAYS) return 0;
  if (age <= HOTSPOT_FULL_WEIGHT_DAYS) return 1;
  return (HOTSPOT_WINDOW_DAYS - age) / (HOTSPOT_WINDOW_DAYS - HOTSPOT_FULL_WEIGHT_DAYS);
}
