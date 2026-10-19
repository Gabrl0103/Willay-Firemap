import type { HotspotDetection } from '../model/Hotspot.js';
import type {
  OpenMeteoDay,
  PowerDailyColumn,
  RiskFeatures,
  RiskModelParams,
} from '../model/RiskForecast.js';
import type { Zone } from '../model/Zone.js';
import { distanceKm } from './geo.js';

/**
 * The 25 features of the ML model for one zone at the end of local day d, ported from
 * ml/willay_ml/features.py (FEATURE_COLUMNS is the contract). Every window ends on day d.
 */

/** Longest window of the features (30-day rain, water balance and hotspots). */
export const FEATURE_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Data the features need is missing: the forecast falls back to the current score. */
export class MissingForecastDataError extends Error {
  constructor(
    readonly kind: 'weather' | 'hotspots',
    message: string,
  ) {
    super(message);
    this.name = 'MissingForecastDataError';
  }
}

export interface FeatureInput {
  readonly zoneId: string;
  /** Local day d (YYYY-MM-DD). */
  readonly date: string;
  /** The FEATURE_WINDOW_DAYS days of weather ending on d, oldest first. */
  readonly weather: readonly OpenMeteoDay[];
  /** Hotspots per local day within radiusKm, same days as `weather`. */
  readonly hotspotsZone: readonly number[];
  /** Hotspots per local day between radiusKm and ringRadiusKm (the neighbouring municipalities). */
  readonly hotspotsRing: readonly number[];
}

/** YYYY-MM-DD plus `days` (negative to go back). */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The local day (YYYY-MM-DD) of an ISO date-time, for a fixed UTC offset (Colombia: -5, no DST). */
export function localDate(isoDateTime: string, utcOffsetHours: number): string {
  return new Date(Date.parse(isoDateTime) + utcOffsetHours * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Open-Meteo day -> the NASA POWER values the model was trained on (linear map, then clipped). */
export function toPowerDay(day: OpenMeteoDay, params: RiskModelParams): Record<PowerDailyColumn, number> {
  const rules = params.weather.openMeteoToPower;
  const out = {} as Record<PowerDailyColumn, number>;
  for (const column of Object.keys(rules) as PowerDailyColumn[]) {
    const rule = rules[column];
    const value = day[rule.openMeteo];
    if (value === null || !Number.isFinite(value)) {
      throw new MissingForecastDataError('weather', `No ${rule.openMeteo} on ${day.date}`);
    }
    let mapped = rule.slope * value + rule.intercept;
    if (rule.min !== null) mapped = Math.max(rule.min, mapped);
    if (rule.max !== null) mapped = Math.min(rule.max, mapped);
    out[column] = mapped;
  }
  return out;
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);
const mean = (values: readonly number[]): number => sum(values) / values.length;
const last = (values: readonly number[], days: number): number[] => values.slice(values.length - days);

/** Dry days in a row (< dryDayMm) ending on the last day; 0 if that day rained. */
export function consecutiveDryDays(rainMm: readonly number[], dryDayMm: number): number {
  let days = 0;
  for (let i = rainMm.length - 1; i >= 0 && (rainMm[i] ?? Infinity) < dryDayMm; i--) days++;
  return days;
}

/** Day of the year as sine/cosine (1 January = angle 0), as pandas dayofyear. */
export function seasonFeatures(date: string): { day_of_year_sin: number; day_of_year_cos: number } {
  const time = Date.parse(`${date}T00:00:00Z`);
  const dayOfYear = Math.round((time - Date.UTC(new Date(time).getUTCFullYear(), 0, 1)) / DAY_MS) + 1;
  const angle = (2 * Math.PI * (dayOfYear - 1)) / 365.25;
  return { day_of_year_sin: Math.sin(angle), day_of_year_cos: Math.cos(angle) };
}

export function buildFeatures(input: FeatureInput, params: RiskModelParams): RiskFeatures {
  const { weather, hotspotsZone, hotspotsRing } = input;
  const lastDay = weather[weather.length - 1];
  if (weather.length !== FEATURE_WINDOW_DAYS || lastDay?.date !== input.date) {
    throw new MissingForecastDataError('weather', `Need ${FEATURE_WINDOW_DAYS} days of weather ending on ${input.date}`);
  }
  if (hotspotsZone.length !== FEATURE_WINDOW_DAYS || hotspotsRing.length !== FEATURE_WINDOW_DAYS) {
    throw new MissingForecastDataError('hotspots', `Need ${FEATURE_WINDOW_DAYS} days of hotspots ending on ${input.date}`);
  }
  const propensity = params.zoneHotspotDaysPerYear[input.zoneId];
  if (propensity === undefined) throw new Error(`The model has no propensity for zone ${input.zoneId}`);

  const days = weather.map((day) => toPowerDay(day, params));
  const series = (column: PowerDailyColumn): number[] => days.map((day) => day[column]);
  const rain = series('precipitation_mm');
  const temperature = series('temperature_mean_c');
  const humidity = series('humidity_mean_pct');
  const evapotranspiration = series('evapotranspiration_mm');
  const today = toPowerDay(lastDay, params);

  return {
    rain_1d_mm: today.precipitation_mm,
    rain_3d_mm: sum(last(rain, 3)),
    rain_7d_mm: sum(last(rain, 7)),
    rain_14d_mm: sum(last(rain, 14)),
    rain_30d_mm: sum(rain),
    dry_days: consecutiveDryDays(rain, params.weather.dryDayMm),
    temperature_mean_c: today.temperature_mean_c,
    temperature_max_c: today.temperature_max_c,
    temperature_range_c: today.temperature_max_c - today.temperature_min_c,
    // Last 7 days minus the 7 days before them.
    temperature_trend_7d_c: mean(last(temperature, 7)) - mean(temperature.slice(-14, -7)),
    humidity_mean_pct: today.humidity_mean_pct,
    humidity_7d_pct: mean(last(humidity, 7)),
    wind_max_ms: today.wind_max_ms,
    wind_7d_ms: mean(last(series('wind_mean_ms'), 7)),
    // Rain (mm) minus POWER's EVPTRNS (MJ/m2/day), exactly as the model was trained (fix planned in v1.1).
    evapotranspiration_mm: today.evapotranspiration_mm,
    water_balance_30d_mm: sum(rain) - sum(evapotranspiration),
    surface_soil_wetness: params.weather.surfaceSoilWetness,
    hotspots_zone_1d: hotspotsZone[hotspotsZone.length - 1] ?? 0,
    hotspots_zone_7d: sum(last(hotspotsZone, 7)),
    hotspots_zone_30d: sum(hotspotsZone),
    hotspots_ring_7d: sum(last(hotspotsRing, 7)),
    hotspots_ring_30d: sum(hotspotsRing),
    ...seasonFeatures(input.date),
    zone_hotspot_days_per_year: propensity,
  };
}

/** A detection the model can count: which satellite saw it, where and when. */
export type CountableDetection = Pick<HotspotDetection, 'source' | 'latitude' | 'longitude' | 'detectedAt'>;

/** Volcanoes and other static sources FIRMS flags: the training dropped detections this close to them. */
export function isStaticSource(latitude: number, longitude: number, params: RiskModelParams): boolean {
  return params.hotspots.staticSources.some(
    ([lat = NaN, lon = NaN]) => distanceKm(latitude, longitude, lat, lon) <= params.hotspots.staticSourceKm,
  );
}

/**
 * Detections per local day for each of `days`, within radiusKm of the zone and in the ring up to
 * ringRadiusKm. Like the training: only the model's satellites, raw detections (no merging between
 * satellites) and no static sources.
 */
export function countHotspotsByDay(
  detections: readonly CountableDetection[],
  zone: Pick<Zone, 'latitude' | 'longitude'>,
  days: readonly string[],
  params: RiskModelParams,
): { zone: number[]; ring: number[] } {
  const index = new Map(days.map((day, i) => [day, i]));
  const sources = new Set(params.hotspots.sources);
  const zoneCounts = days.map(() => 0);
  const ringCounts = days.map(() => 0);
  for (const detection of detections) {
    if (!sources.has(detection.source)) continue;
    const i = index.get(localDate(detection.detectedAt, params.hotspots.localUtcOffsetHours));
    if (i === undefined) continue;
    const distance = distanceKm(zone.latitude, zone.longitude, detection.latitude, detection.longitude);
    if (distance > params.hotspots.ringRadiusKm) continue;
    if (isStaticSource(detection.latitude, detection.longitude, params)) continue;
    if (distance <= params.hotspots.radiusKm) zoneCounts[i] = (zoneCounts[i] ?? 0) + 1;
    else ringCounts[i] = (ringCounts[i] ?? 0) + 1;
  }
  return { zone: zoneCounts, ring: ringCounts };
}
