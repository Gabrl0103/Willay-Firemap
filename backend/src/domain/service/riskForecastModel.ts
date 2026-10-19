import type { RiskFeatures, RiskModelParams, RiskPrediction } from '../model/RiskForecast.js';
import { levelFromScore } from '../model/RiskLevel.js';

const sigmoid = (value: number): number => 1 / (1 + Math.exp(-value));

/**
 * Probability of a hotspot <= 25 km in the next 72 h, from the exported logistic regression
 * (ml/willay_ml/train.py): log1p of the counts -> standardize -> linear score -> Platt calibration.
 * Pure: no I/O. Throws if a feature is missing or not a finite number.
 */
export function predictRisk(features: RiskFeatures, params: RiskModelParams): RiskPrediction {
  const { features: names, mean, scale, coefficients } = params;
  if (mean.length !== names.length || scale.length !== names.length || coefficients.length !== names.length) {
    throw new Error(`Risk model ${params.version}: parameters do not match its ${names.length} features`);
  }
  const logged = new Set(params.logFeatures);
  let raw = params.intercept;
  names.forEach((name, index) => {
    const value = features[name];
    if (value === undefined || !Number.isFinite(value)) throw new Error(`Feature ${name} is missing`);
    const input = logged.has(name) ? Math.log1p(Math.max(0, value)) : value;
    raw += (coefficients[index] ?? NaN) * ((input - (mean[index] ?? NaN)) / (scale[index] ?? NaN));
  });
  const probability = sigmoid(params.platt.slope * raw + params.platt.intercept);
  const score = Math.round(probability * 100);
  return { probability, score, level: levelFromScore(score) };
}
