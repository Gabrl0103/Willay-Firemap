const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Haversine distance in kilometers. */
export function distanceKm(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
): number {
  const dLat = toRadians(latB - latA);
  const dLon = toRadians(lonB - lonA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}
