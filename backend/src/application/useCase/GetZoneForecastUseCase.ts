import { NotFoundError } from '../../domain/error/DomainErrors.js';
import type {
  ForecastFallbackReason,
  ForecastHorizon,
  ForecastHours,
  OpenMeteoDay,
  RiskModelParams,
  ZoneForecast,
} from '../../domain/model/RiskForecast.js';
import type { Zone } from '../../domain/model/Zone.js';
import type { WeatherForecastProvider } from '../../domain/port/DataSources.js';
import type {
  DailyWeatherRepository,
  HotspotDetectionRepository,
  ZoneRepository,
} from '../../domain/port/Repositories.js';
import {
  FEATURE_WINDOW_DAYS,
  MissingForecastDataError,
  addDays,
  buildFeatures,
  countHotspotsByDay,
  localDate,
} from '../../domain/service/forecastFeatures.js';
import { predictRisk } from '../../domain/service/riskForecastModel.js';
import type { ZoneRiskCalculator } from '../service/ZoneRiskCalculator.js';
import { LOCAL_UTC_OFFSET_HOURS } from './IngestDailyWeatherUseCase.js';

/** Days the model is run for: the end of today, tomorrow and the day after (24, 48 and 72 h). */
const HORIZON_DAYS = 3;

/** Why the model could not run; the answer is then the current score. */
class ForecastFallback extends Error {
  constructor(
    readonly reason: ForecastFallbackReason,
    message: string,
  ) {
    super(message);
  }
}

/**
 * 72 h forecast of a zone with the ML model. Each horizon runs the model at the end of one day
 * (today, tomorrow, the day after) with the stored weather of the past days plus the Open-Meteo
 * forecast: the probability of a hotspot <= 25 km in the 72 h after that day. Only observed
 * hotspots are counted (none is assumed for the coming days). When data is missing or something
 * fails, it answers the current weighted score and says why: nothing is made up.
 */
export class GetZoneForecastUseCase {
  constructor(
    private readonly zoneRepository: ZoneRepository,
    private readonly riskCalculator: ZoneRiskCalculator,
    private readonly dailyWeatherRepository: DailyWeatherRepository,
    private readonly detectionRepository: HotspotDetectionRepository,
    private readonly forecastProvider: WeatherForecastProvider,
    private readonly model: RiskModelParams,
  ) {}

  async execute(zoneId: string, now: Date = new Date()): Promise<ZoneForecast> {
    const zone = await this.zoneRepository.findById(zoneId);
    if (!zone) throw new NotFoundError(`Zone ${zoneId} not found`);
    const generatedAt = now.toISOString();
    try {
      const horizons = await this.horizons(zone, now);
      return { zoneId, source: 'model', modelVersion: this.model.version, generatedAt, horizons };
    } catch (error) {
      const reason = fallbackReason(error);
      console.warn(`[forecast:${zoneId}] fallback (${reason}): ${error instanceof Error ? error.message : String(error)}`);
      const { assessment } = await this.riskCalculator.calculate(zone, now);
      return { zoneId, source: 'fallback', reason, generatedAt, current: { score: assessment.score, level: assessment.level } };
    }
  }

  private async horizons(zone: Zone, now: Date): Promise<ForecastHorizon[]> {
    const today = localDate(now.toISOString(), LOCAL_UTC_OFFSET_HOURS);
    const firstDay = addDays(today, -(FEATURE_WINDOW_DAYS - 1));
    const lastDay = addDays(today, HORIZON_DAYS - 1);
    const days = Array.from({ length: FEATURE_WINDOW_DAYS + HORIZON_DAYS - 1 }, (_, i) => addDays(firstDay, i));

    const [past, completeDays, detections] = await Promise.all([
      this.dailyWeatherRepository.findRange(zone.id, firstDay, addDays(today, -1)),
      this.detectionRepository.findCompleteDays(firstDay),
      this.detectionRepository.findSince(`${addDays(firstDay, -1)}T00:00:00Z`),
    ]);

    let coming: OpenMeteoDay[];
    try {
      coming = await this.forecastProvider.fetchForecast(zone, today, lastDay);
    } catch (error) {
      throw new ForecastFallback('weather_unavailable', error instanceof Error ? error.message : String(error));
    }
    if (coming.length !== HORIZON_DAYS || coming[0]?.date !== today) {
      throw new ForecastFallback('weather_unavailable', `Open-Meteo forecast has ${coming.length} days from ${coming[0]?.date}`);
    }

    const weather = [...past, ...coming];
    const missingWeather = days.filter((day, i) => weather[i]?.date !== day);
    if (missingWeather.length > 0) {
      throw new MissingForecastDataError('weather', `No weather for ${missingWeather.length} day(s), first ${missingWeather[0]}`);
    }
    const complete = new Set(completeDays);
    const missingHotspots = days.filter((day) => day < today && !complete.has(day));
    if (missingHotspots.length > 0) {
      throw new MissingForecastDataError('hotspots', `FIRMS days not loaded: ${missingHotspots.length}, first ${missingHotspots[0]}`);
    }

    // Coming days have no observed hotspots: they count 0 (no hotspot is made up).
    const counts = countHotspotsByDay(detections, zone, days, this.model);
    return Array.from({ length: HORIZON_DAYS }, (_, k) => {
      const window = (values: readonly number[]) => values.slice(k, k + FEATURE_WINDOW_DAYS);
      const baseDate = days[k + FEATURE_WINDOW_DAYS - 1] ?? today;
      const features = buildFeatures(
        {
          zoneId: zone.id,
          date: baseDate,
          weather: weather.slice(k, k + FEATURE_WINDOW_DAYS),
          hotspotsZone: window(counts.zone),
          hotspotsRing: window(counts.ring),
        },
        this.model,
      );
      return { hours: ((k + 1) * 24) as ForecastHours, baseDate, ...predictRisk(features, this.model) };
    });
  }
}

function fallbackReason(error: unknown): ForecastFallbackReason {
  if (error instanceof ForecastFallback) return error.reason;
  if (error instanceof MissingForecastDataError) {
    return error.kind === 'weather' ? 'weather_history_incomplete' : 'hotspot_history_incomplete';
  }
  return 'model_error';
}
