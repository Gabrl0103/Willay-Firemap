import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RiskModelParams } from '../src/domain/model/RiskForecast.js';
import { predictRisk } from '../src/domain/service/riskForecastModel.js';
import { RISK_MODEL } from '../src/infrastructure/ml/riskModel.js';
import cases from './fixtures/risk-model-cases.json' with { type: 'json' };

/** sklearn and JavaScript do the same float operations in a different order. */
const TOLERANCE = 1e-9;

describe('predictRisk (exported logistic regression)', () => {
  it('loads the exported model the fixtures were made with', () => {
    assert.equal(RISK_MODEL.version, cases.modelVersion);
    assert.equal(RISK_MODEL.features.length, 25);
  });

  for (const row of cases.predict) {
    it(`matches sklearn for ${row.zoneId} on ${row.date} (p = ${row.probability.toFixed(3)})`, () => {
      const result = predictRisk(row.features, RISK_MODEL);
      assert.ok(Math.abs(result.probability - row.probability) < TOLERANCE, `${result.probability} vs ${row.probability}`);
    });
  }

  it('turns the probability into a 0-100 score with the current level thresholds', () => {
    const lowest = cases.predict[0]!;
    const highest = cases.predict[cases.predict.length - 1]!;
    const low = predictRisk(lowest.features, RISK_MODEL);
    const high = predictRisk(highest.features, RISK_MODEL);
    assert.equal(low.score, Math.round(low.probability * 100));
    assert.equal(low.level, 'low');
    assert.ok(high.score >= 75);
    assert.equal(high.level, 'extreme');
  });

  it('rises with recent hotspots around the zone, all else equal', () => {
    const base = cases.predict[6]!.features;
    const quiet = predictRisk({ ...base, hotspots_ring_30d: 0, hotspots_zone_30d: 0 }, RISK_MODEL);
    const busy = predictRisk({ ...base, hotspots_ring_30d: 40, hotspots_zone_30d: 20 }, RISK_MODEL);
    assert.ok(busy.probability > quiet.probability);
  });

  it('refuses a missing or non-finite feature', () => {
    const { rain_1d_mm: _dropped, ...withoutRain } = cases.predict[0]!.features;
    assert.throws(() => predictRisk(withoutRain, RISK_MODEL), /rain_1d_mm/);
    assert.throws(() => predictRisk({ ...cases.predict[0]!.features, dry_days: NaN }, RISK_MODEL), /dry_days/);
  });

  it('refuses parameters that do not match the feature list', () => {
    const broken: RiskModelParams = { ...RISK_MODEL, mean: RISK_MODEL.mean.slice(1) };
    assert.throws(() => predictRisk(cases.predict[0]!.features, broken), /do not match/);
  });
});
