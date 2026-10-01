import type { ZoneRiskSummary } from '../model/risk';

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export function distanceKm(latA: number, lonA: number, latB: number, lonB: number): number {
  const dLat = toRadians(latB - latA);
  const dLon = toRadians(lonB - lonA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

export function nearestZone(
  zones: readonly ZoneRiskSummary[],
  latitude: number,
  longitude: number,
): ZoneRiskSummary | undefined {
  let best: ZoneRiskSummary | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const zone of zones) {
    const distance = distanceKm(latitude, longitude, zone.latitude, zone.longitude);
    if (distance < bestDistance) {
      best = zone;
      bestDistance = distance;
    }
  }
  return best;
}
