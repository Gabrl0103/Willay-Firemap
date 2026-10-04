import type { HotspotConfidence, HotspotDetection } from '../model/Hotspot.js';
import { distanceKm } from './geo.js';

/** Two detections from different satellites at most this far apart can be the same fire. */
export const SAME_HOTSPOT_MAX_KM = 1;
/** ...and at most this many hours apart (NOAA-20, NOAA-21 and SNPP pass within ~1-2 h). */
export const SAME_HOTSPOT_MAX_HOURS = 3;

const HOUR_MS = 60 * 60 * 1000;
const CONFIDENCE_RANK: Record<HotspotConfidence, number> = { low: 0, nominal: 1, high: 2 };

/** Same fire seen by two different satellites: at most 1 km and 3 hours apart. */
export function isSameHotspot(a: HotspotDetection, b: HotspotDetection): boolean {
  return (
    a.source !== b.source &&
    Math.abs(Date.parse(a.detectedAt) - Date.parse(b.detectedAt)) <= SAME_HOTSPOT_MAX_HOURS * HOUR_MS &&
    distanceKm(a.latitude, a.longitude, b.latitude, b.longitude) <= SAME_HOTSPOT_MAX_KM
  );
}

/**
 * Keeps one detection per fire seen by several satellites: the most confident one (ties: higher FRP,
 * then the earliest). Pixels of the same satellite are never merged: neighbouring pixels of one pass
 * are different parts of a fire, not duplicates. The result keeps the input order.
 */
export function dedupeAcrossSatellites(detections: readonly HotspotDetection[]): HotspotDetection[] {
  const best = [...detections].sort(
    (a, b) =>
      CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence] ||
      (b.frp ?? 0) - (a.frp ?? 0) ||
      Date.parse(a.detectedAt) - Date.parse(b.detectedAt),
  );
  const kept = new Set<HotspotDetection>();
  for (const detection of best) {
    if (![...kept].some((other) => isSameHotspot(other, detection))) kept.add(detection);
  }
  return detections.filter((detection) => kept.has(detection));
}
