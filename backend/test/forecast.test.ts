import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';
import { ZoneRiskCalculator } from '../src/application/service/ZoneRiskCalculator.js';
import { GetZoneForecastUseCase } from '../src/application/useCase/GetZoneForecastUseCase.js';
import { NotFoundError } from '../src/domain/error/DomainErrors.js';
import type { DailyWeather } from '../src/domain/model/DailyWeather.js';
import type { RawDetection } from '../src/domain/model/Hotspot.js';
import { OPEN_METEO_DAILY_VARIABLES, type OpenMeteoDay, type ZoneForecast } from '../src/domain/model/RiskForecast.js';
import type { WeatherForecastProvider } from '../src/domain/port/DataSources.js';
import { addDays, buildFeatures, countHotspotsByDay } from '../src/domain/service/forecastFeatures.js';
import { RiskScoringService } from '../src/domain/service/RiskScoringService.js';
import { predictRisk } from '../src/domain/service/riskForecastModel.js';
import type { Container } from '../src/infrastructure/config/container.js';
import { RISK_MODEL } from '../src/infrastructure/ml/riskModel.js';
import {
  InMemoryDailyWeatherRepository,
  InMemoryFireEventRepository,
  InMemoryHotspotDetectionRepository,
  InMemoryHotspotRepository,
  InMemoryWeatherRepository,
  InMemoryZoneRepository,
} from '../src/infrastructure/persistence/InMemoryRepositories.js';
import { weatherSnapshots, zones } from '../src/infrastructure/persistence/seedData.js';
import { createApp } from '../src/presentation/http/app.js';
import cases from './fixtures/risk-model-cases.json' with { type: 'json' };

/** 10:00 in Colombia on 2026-10-18: "today" is 2026-10-18 local. */
const NOW = new Date('2026-10-18T15:00:00Z');
const TODAY = '2026-10-18';
const PASTO = zones.find((zone) => zone.id === 'pasto')!;

/** 32 real Open-Meteo days (a fixture case plus 2 more), moved so the last 3 are today..today+2. */
function weatherDays(): OpenMeteoDay[] {
  const daily = cases.features[2]!.openMeteoDaily;
  const values = (i: number): OpenMeteoDay => {
    const day: Record<string, string | number | null> = { date: addDays(TODAY, i - 29) };
    for (const variable of OPEN_METEO_DAILY_VARIABLES) day[variable] = daily[variable][i % 30] ?? null;
    return day as OpenMeteoDay;
  };
  return Array.from({ length: 32 }, (_, i) => values(i));
}

const past = (days: OpenMeteoDay[]): DailyWeather[] =>
  days.slice(0, 29).map((day) => ({ ...day, zoneId: 'pasto', source: 'archive' as const }));

/** UTC days before today that FIRMS has delivered. */
const completeDays = Array.from({ length: 29 }, (_, i) => addDays(TODAY, i - 29));

interface Setup {
  readonly history?: readonly DailyWeather[];
  readonly detections?: readonly RawDetection[];
  readonly complete?: readonly string[];
  readonly forecast?: WeatherForecastProvider['fetchForecast'];
}

function useCase(setup: Setup = {}) {
  const days = weatherDays();
  const calls: string[] = [];
  const forecast: WeatherForecastProvider = {
    fetchForecast:
      setup.forecast ??
      (async (zone, from, to) => {
        calls.push(`${zone.id} ${from}..${to}`);
        return days.slice(29);
      }),
  };
  const calculator = new ZoneRiskCalculator(
    new InMemoryWeatherRepository(weatherSnapshots),
    new InMemoryFireEventRepository([]),
    new InMemoryHotspotRepository([]),
    new RiskScoringService(),
  );
  const forecastUseCase = new GetZoneForecastUseCase(
    new InMemoryZoneRepository(zones),
    calculator,
    new InMemoryDailyWeatherRepository(setup.history ?? past(days)),
    new InMemoryHotspotDetectionRepository(setup.detections ?? [], setup.complete ?? completeDays),
    forecast,
    RISK_MODEL,
  );
  return { forecastUseCase, calculator, days, calls };
}

const near = (detectedAt: string, source = 'VIIRS_SNPP_NRT'): RawDetection => ({
  source,
  latitude: PASTO.latitude + 0.05,
  longitude: PASTO.longitude,
  detectedAt,
});

async function expectFallback(forecast: Promise<ZoneForecast>, reason: string): Promise<void> {
  const result = await forecast;
  assert.equal(result.source, 'fallback');
  if (result.source !== 'fallback') return;
  assert.equal(result.reason, reason);
  // The current weighted score of the zone, not a made-up value.
  const { calculator } = useCase();
  const { assessment } = await calculator.calculate(PASTO, NOW);
  assert.deepEqual(result.current, { score: assessment.score, level: assessment.level });
}

describe('GetZoneForecastUseCase', () => {
  it('runs the model at the end of today, tomorrow and the day after', async () => {
    const { forecastUseCase, calls } = useCase();
    const result = await forecastUseCase.execute('pasto', NOW);
    assert.equal(result.source, 'model');
    if (result.source !== 'model') return;
    assert.equal(result.modelVersion, RISK_MODEL.version);
    assert.deepEqual(calls, [`pasto ${TODAY}..2026-10-20`]);
    assert.deepEqual(
      result.horizons.map((h) => [h.hours, h.baseDate]),
      [[24, '2026-10-18'], [48, '2026-10-19'], [72, '2026-10-20']],
    );
    for (const horizon of result.horizons) {
      assert.ok(horizon.probability > 0 && horizon.probability < 1);
      assert.equal(horizon.score, Math.round(horizon.probability * 100));
    }
  });

  it('gives the 24 h row the same probability as the model on the last 30 days', async () => {
    const detections = [near('2026-10-17T18:00:00Z'), near('2026-10-10T18:00:00Z', 'VIIRS_NOAA20_NRT')];
    const { forecastUseCase, days } = useCase({ detections });
    const result = await forecastUseCase.execute('pasto', NOW);
    assert.equal(result.source, 'model');
    if (result.source !== 'model') return;
    const window = days.slice(0, 30).map((day) => day.date);
    const counts = countHotspotsByDay(detections, PASTO, window, RISK_MODEL);
    const features = buildFeatures(
      { zoneId: 'pasto', date: TODAY, weather: days.slice(0, 30), hotspotsZone: counts.zone, hotspotsRing: counts.ring },
      RISK_MODEL,
    );
    assert.equal(result.horizons[0]!.probability, predictRisk(features, RISK_MODEL).probability);
  });

  it('rises with hotspots observed near the zone', async () => {
    const quiet = await useCase().forecastUseCase.execute('pasto', NOW);
    const busy = await useCase({
      detections: Array.from({ length: 6 }, (_, i) => near(`2026-10-${String(10 + i).padStart(2, '0')}T18:00:00Z`)),
    }).forecastUseCase.execute('pasto', NOW);
    assert.ok(quiet.source === 'model' && busy.source === 'model');
    if (quiet.source !== 'model' || busy.source !== 'model') return;
    assert.ok(busy.horizons[0]!.probability > quiet.horizons[0]!.probability);
  });

  it('falls back to the current score when Open-Meteo fails', async () => {
    const { forecastUseCase } = useCase({
      forecast: async () => {
        throw new Error('timeout of 15000ms exceeded');
      },
    });
    await expectFallback(forecastUseCase.execute('pasto', NOW), 'weather_unavailable');
  });

  it('falls back when the forecast does not cover the 3 days', async () => {
    const days = weatherDays();
    const { forecastUseCase } = useCase({ forecast: async () => days.slice(29, 31) });
    await expectFallback(forecastUseCase.execute('pasto', NOW), 'weather_unavailable');
  });

  it('falls back when a past day of weather is missing', async () => {
    const history = past(weatherDays()).filter((day) => day.date !== '2026-10-01');
    await expectFallback(useCase({ history }).forecastUseCase.execute('pasto', NOW), 'weather_history_incomplete');
  });

  it('falls back when a FIRMS day was not loaded', async () => {
    const complete = completeDays.filter((day) => day !== '2026-10-05');
    await expectFallback(useCase({ complete }).forecastUseCase.execute('pasto', NOW), 'hotspot_history_incomplete');
  });

  it('falls back when a weather value is missing', async () => {
    const days = weatherDays();
    const forecast = async () => days.slice(29).map((day, i) => (i === 1 ? { ...day, relative_humidity_2m_mean: null } : day));
    await expectFallback(useCase({ forecast }).forecastUseCase.execute('pasto', NOW), 'weather_history_incomplete');
  });

  it('rejects an unknown zone', async () => {
    await assert.rejects(useCase().forecastUseCase.execute('atlantis', NOW), NotFoundError);
  });
});

describe('GET /api/zones/:id/forecast', () => {
  async function get(path: string, forecastUseCase: GetZoneForecastUseCase) {
    const container = { getZoneForecast: { execute: (id: string) => forecastUseCase.execute(id, NOW) } } as unknown as Container;
    const server = createApp(container).listen(0);
    await once(server, 'listening');
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      return { status: response.status, body: (await response.json()) as Record<string, unknown> };
    } finally {
      server.close();
    }
  }

  it('answers the 3 horizons with the probability rounded to 3 decimals', async () => {
    const { status, body } = await get('/api/zones/pasto/forecast', useCase().forecastUseCase);
    assert.equal(status, 200);
    assert.equal(body['source'], 'model');
    const horizons = body['horizons'] as Array<{ hours: number; probability: number; score: number; level: string }>;
    assert.deepEqual(horizons.map((h) => h.hours), [24, 48, 72]);
    for (const horizon of horizons) assert.equal(horizon.probability, Math.round(horizon.probability * 1000) / 1000);
  });

  it('answers the fallback with its reason and the current score', async () => {
    const { status, body } = await get('/api/zones/pasto/forecast', useCase({ complete: [] }).forecastUseCase);
    assert.equal(status, 200);
    assert.equal(body['source'], 'fallback');
    assert.equal(body['reason'], 'hotspot_history_incomplete');
    assert.equal(typeof (body['current'] as { score: number }).score, 'number');
    assert.equal(body['horizons'], undefined);
  });

  it('answers 404 for an unknown zone', async () => {
    const { status, body } = await get('/api/zones/atlantis/forecast', useCase().forecastUseCase);
    assert.equal(status, 404);
    assert.equal(body['error'], 'NOT_FOUND');
  });
});
