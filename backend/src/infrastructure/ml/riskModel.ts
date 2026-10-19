import type { RiskModelParams } from '../../domain/model/RiskForecast.js';
import exported from './risk-model-1.0.0.json' with { type: 'json' };

/**
 * The ML model in use, exported from ml/ with `python -m willay_ml.export_backend` (no Python at
 * runtime). To change model: export a new risk-model-<version>.json and import it here.
 */
export const RISK_MODEL: RiskModelParams = exported as RiskModelParams;
