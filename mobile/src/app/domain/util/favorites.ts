import type { ZoneRiskSummary } from '../model/risk';

/** The favorite zones that still exist, in the order they were added; an id no zone has any more is skipped. */
export function favoriteZones(ids: readonly string[], zones: readonly ZoneRiskSummary[]): ZoneRiskSummary[] {
  const byId = new Map(zones.map((zone) => [zone.id, zone]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** The same zones with the favorites first; each group keeps its order. */
export function favoritesFirst(zones: readonly ZoneRiskSummary[], ids: readonly string[]): ZoneRiskSummary[] {
  const favorite = new Set(ids);
  return [...zones.filter((zone) => favorite.has(zone.id)), ...zones.filter((zone) => !favorite.has(zone.id))];
}
