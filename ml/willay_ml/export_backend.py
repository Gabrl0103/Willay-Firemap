"""Phase 4: exports the logistic regression to JSON so the backend runs it without Python.

    python -m willay_ml.export_backend
      -> backend/src/infrastructure/ml/risk-model-1.0.0.json   (what the backend loads)
      -> backend/test/fixtures/risk-model-cases.json           (sklearn answers for the backend tests)

The model is LogColumns (log1p of the counts) -> StandardScaler -> LogisticRegression -> Platt, so it
is a handful of numbers. Production weather comes from Open-Meteo, but the model was trained on NASA
POWER, so the JSON also carries a linear map Open-Meteo -> POWER per variable, fitted on the 2024
Open-Meteo history only (the test years stay untouched). Surface soil wetness has no daily
Open-Meteo equivalent: it is fixed at its training mean, so it adds nothing to the score.

Note: POWER's EVPTRNS is an energy flux in MJ/m2/day, although the feature is called
evapotranspiration_mm, and water_balance_30d_mm subtracts it from rain in mm. The trained model uses
it that way, so the backend must reproduce it as is (fix planned for v1.1).
"""

from __future__ import annotations

import __main__
import hashlib
import json

import numpy as np
import pandas as pd
import joblib

from .config import LOCAL_UTC_OFFSET_HOURS, PROCESSED_DIR, RADIUS_KM, REPO_DIR, WEATHER_RAW_DIR
from .dataset import COUNTS_PARQUET, STATIC_SOURCE_KM, STATIC_TYPES
from .features import (
    DRY_DAY_MM,
    FEATURE_COLUMNS,
    FEATURES_PARQUET,
    RING_RADIUS_KM,
    WEATHER_FEATURES,
    hotspot_features,
    season_features,
    weather_features,
)
from .firms import HOTSPOTS_PARQUET, VIIRS_SOURCES
from .metrics import evaluate
from .power import POWER_PARQUET
from .train import LABEL, MODEL_VERSION, MODELS_DIR, VALIDATION_END, LogColumns
from .weather import locations_to_frame

# joblib pickled LogColumns from `python -m willay_ml.train`, i.e. as __main__.LogColumns.
__main__.LogColumns = LogColumns

MODEL_JOBLIB = MODELS_DIR / "logistic_regression.joblib"
METADATA_JSON = MODELS_DIR / "metadata.json"
BACKEND_JSON = REPO_DIR / "backend" / "src" / "infrastructure" / "ml" / f"risk-model-{MODEL_VERSION}.json"
CASES_JSON = REPO_DIR / "backend" / "test" / "fixtures" / "risk-model-cases.json"
MAPPING_FIT_YEAR = 2024
# FIRMS near-real-time products the hotspot features count (same satellites as the training).
FIRMS_NRT_SOURCES = ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT"]

# POWER column the model expects <- Open-Meteo daily variable (native unit), with physical bounds.
WEATHER_MAP = {
    "precipitation_mm": ("precipitation_sum", "mm", "mm/day", 0, None),
    "temperature_mean_c": ("temperature_2m_mean", "C at 2 m", "C at 2 m", None, None),
    "temperature_max_c": ("temperature_2m_max", "C at 2 m", "C at 2 m", None, None),
    "temperature_min_c": ("temperature_2m_min", "C at 2 m", "C at 2 m", None, None),
    "humidity_mean_pct": ("relative_humidity_2m_mean", "% at 2 m", "% at 2 m", 0, 100),
    "wind_max_ms": ("wind_speed_10m_max", "km/h at 10 m", "m/s at 2 m", 0, None),
    "wind_mean_ms": ("wind_speed_10m_mean", "km/h at 10 m", "m/s at 2 m", 0, None),
    "evapotranspiration_mm": ("et0_fao_evapotranspiration", "mm (reference ET0)", "MJ/m2/day (actual)", 0, None),
}
SOIL_WETNESS = "surface_soil_wetness"


def load_model() -> dict:
    bundle = joblib.load(MODEL_JOBLIB)
    log, scaler, logistic = (step for _, step in bundle["model"].steps)
    if list(bundle["features"]) != FEATURE_COLUMNS:
        raise SystemExit("The saved model does not use FEATURE_COLUMNS in order: retrain it.")
    return {
        "pipeline": bundle["model"],
        "calibrator": bundle["calibrator"],
        "log_features": [FEATURE_COLUMNS[i] for i in log.indexes],
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
        "coefficients": logistic.coef_[0].tolist(),
        "intercept": float(logistic.intercept_[0]),
        "platt": {
            "slope": float(bundle["calibrator"].coef_[0][0]),
            "intercept": float(bundle["calibrator"].intercept_[0]),
        },
    }


def probabilities(model: dict, rows: pd.DataFrame) -> np.ndarray:
    raw = model["pipeline"].decision_function(rows[FEATURE_COLUMNS])
    return model["calibrator"].predict_proba(raw.reshape(-1, 1))[:, 1]


def load_open_meteo() -> pd.DataFrame:
    """Every cached Open-Meteo history file (ml/data/raw/open_meteo), one row per zone and day."""
    frames = []
    for path in sorted(WEATHER_RAW_DIR.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        frames.append(locations_to_frame(payload["zone_ids"], payload["locations"]))
    weather = pd.concat(frames, ignore_index=True)
    weather["date"] = pd.to_datetime(weather["date"])
    return weather.drop_duplicates(["zone_id", "date"], keep="last").reset_index(drop=True)


def fit_weather_map(open_meteo: pd.DataFrame, power: pd.DataFrame) -> dict:
    pairs = open_meteo.merge(power, on=["zone_id", "date"])
    fit = pairs[pairs["date"].dt.year == MAPPING_FIT_YEAR]
    mapping = {}
    for column, (source, unit_in, unit_out, low, high) in WEATHER_MAP.items():
        ok = fit[source].notna() & fit[column].notna()
        slope, intercept = np.polyfit(fit.loc[ok, source].astype(float), fit.loc[ok, column].astype(float), 1)
        mapping[column] = {
            "openMeteo": source,
            "unitIn": unit_in,
            "unitOut": unit_out,
            "slope": float(slope),
            "intercept": float(intercept),
            "min": low,
            "max": high,
            "fitRows": int(ok.sum()),
            "correlation": float(np.corrcoef(fit.loc[ok, source], fit.loc[ok, column])[0, 1]),
        }
    return mapping


def apply_weather_map(open_meteo: pd.DataFrame, mapping: dict, soil_wetness: float) -> pd.DataFrame:
    """Open-Meteo daily rows -> the POWER columns weather_features expects."""
    out = open_meteo[["zone_id", "date"]].copy()
    for column, rule in mapping.items():
        value = open_meteo[rule["openMeteo"]].astype(float) * rule["slope"] + rule["intercept"]
        out[column] = value.clip(lower=rule["min"], upper=rule["max"])
    out[SOIL_WETNESS] = soil_wetness
    return out


def static_sources() -> list[list[float]]:
    """Archive VIIRS detections FIRMS flags as volcano / static land / offshore (rounded like the training)."""
    hotspots = pd.read_parquet(HOTSPOTS_PARQUET)
    viirs = hotspots[hotspots["sensor"].isin(VIIRS_SOURCES)]
    points = viirs.loc[viirs["type"].isin(STATIC_TYPES), ["latitude", "longitude"]].to_numpy()
    unique = np.unique(np.round(points, 4), axis=0)
    return [[float(lat), float(lon)] for lat, lon in unique]


def file_sha256(path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def feature_cases(model: dict, mapped: pd.DataFrame, open_meteo: pd.DataFrame, counts: pd.DataFrame,
                  propensity: dict) -> list[dict]:
    """End-to-end cases: 30 days of Open-Meteo + hotspot counts -> 25 features -> probability."""
    cases = []
    for zone_id, day in (("el-rosario", "2025-09-15"), ("barbacoas", "2025-05-10"), ("pasto", "2026-08-20")):
        end = pd.Timestamp(day)
        start = end - pd.Timedelta(days=29)
        weather = mapped[(mapped["zone_id"] == zone_id) & mapped["date"].between(start, end)]
        raw = open_meteo[(open_meteo["zone_id"] == zone_id) & open_meteo["date"].between(start, end)]
        zone_counts = counts[(counts["zone_id"] == zone_id) & counts["date"].between(start, end)]
        if len(weather) != 30 or len(zone_counts) != 30:
            raise SystemExit(f"Missing data for the {zone_id} {day} case")
        features = weather_features(weather).merge(hotspot_features(zone_counts), on=["zone_id", "date"])
        row = features[features["date"] == end].copy()
        row["zone_hotspot_days_per_year"] = propensity[zone_id]
        row[["day_of_year_sin", "day_of_year_cos"]] = season_features(row["date"]).to_numpy()
        zone = zone_counts[f"hotspots_today_r{RADIUS_KM}"].astype(float)
        ring = zone_counts[f"hotspots_today_r{RING_RADIUS_KM}"].astype(float) - zone
        cases.append({
            "zoneId": zone_id,
            "date": day,
            "openMeteoDaily": {
                "date": raw["date"].dt.strftime("%Y-%m-%d").tolist(),
                **{rule[0]: raw[rule[0]].astype(float).tolist() for rule in WEATHER_MAP.values()},
            },
            "hotspotsZoneDaily": zone.tolist(),
            "hotspotsRingDaily": ring.tolist(),
            "features": {c: float(row[c].iloc[0]) for c in FEATURE_COLUMNS},
            "probability": float(probabilities(model, row)[0]),
        })
    return cases


def main() -> None:
    model = load_model()
    metadata = json.loads(METADATA_JSON.read_text(encoding="utf-8"))
    table = pd.read_parquet(FEATURES_PARQUET)
    test = table[table["date"] > VALIDATION_END].dropna(subset=[*FEATURE_COLUMNS, LABEL])
    soil_wetness = model["mean"][FEATURE_COLUMNS.index(SOIL_WETNESS)]

    open_meteo = load_open_meteo()
    mapping = fit_weather_map(open_meteo, pd.read_parquet(POWER_PARQUET))
    mapped = apply_weather_map(open_meteo, mapping, soil_wetness)
    propensity = table.groupby("zone_id")["zone_hotspot_days_per_year"].first().round(6).to_dict()

    # Test-period metrics with POWER (training source) and with mapped Open-Meteo weather.
    with_open_meteo = (
        test.drop(columns=WEATHER_FEATURES)
        .merge(weather_features(mapped), on=["zone_id", "date"])
        .dropna(subset=FEATURE_COLUMNS)
    )
    evaluation = {}
    for name, rows in (("power", test), ("openMeteoMapped", with_open_meteo)):
        result = evaluate(rows["date"], rows[LABEL].to_numpy(), probabilities(model, rows))
        evaluation[name] = {k: int(v) if k == "rows" else round(float(v), 4) for k, v in result.items()}

    export = {
        "version": MODEL_VERSION,
        "label": metadata["label"],
        "trainedAt": metadata["trained_at"],
        "trainedFromCommit": metadata["git_commit"],
        "sourceSha256": file_sha256(MODEL_JOBLIB),
        "features": FEATURE_COLUMNS,
        "logFeatures": model["log_features"],
        "mean": model["mean"],
        "scale": model["scale"],
        "coefficients": model["coefficients"],
        "intercept": model["intercept"],
        "platt": model["platt"],
        "weather": {
            "dryDayMm": DRY_DAY_MM,
            "mappingFitYear": MAPPING_FIT_YEAR,
            "openMeteoToPower": mapping,
            "surfaceSoilWetness": soil_wetness,
        },
        "hotspots": {
            "radiusKm": RADIUS_KM,
            "ringRadiusKm": RING_RADIUS_KM,
            "sources": FIRMS_NRT_SOURCES,
            "localUtcOffsetHours": LOCAL_UTC_OFFSET_HOURS,
            "staticSourceKm": STATIC_SOURCE_KM,
            "staticSources": static_sources(),
        },
        "zoneHotspotDaysPerYear": propensity,
        "evaluationTest": {"period": [str(test["date"].min().date()), str(test["date"].max().date())], **evaluation},
    }
    BACKEND_JSON.parent.mkdir(parents=True, exist_ok=True)
    BACKEND_JSON.write_text(json.dumps(export, indent=2) + "\n", encoding="utf-8")

    # Rows spread over the probability range, scored by sklearn (the backend must match them).
    scored = test.assign(probability=probabilities(model, test)).sort_values("probability")
    picks = scored.iloc[np.linspace(0, len(scored) - 1, 12).astype(int)]
    counts = pd.read_parquet(COUNTS_PARQUET)
    cases = {
        "modelVersion": MODEL_VERSION,
        "predict": [
            {
                "zoneId": row.zone_id,
                "date": f"{row.date:%Y-%m-%d}",
                "features": {c: float(getattr(row, c)) for c in FEATURE_COLUMNS},
                "probability": float(row.probability),
            }
            for row in picks.itertuples()
        ],
        "features": feature_cases(model, mapped, open_meteo, counts, propensity),
    }
    CASES_JSON.parent.mkdir(parents=True, exist_ok=True)
    CASES_JSON.write_text(json.dumps(cases, indent=2) + "\n", encoding="utf-8")
    print(f"{BACKEND_JSON}\n{CASES_JSON}")
    print(json.dumps(evaluation, indent=2))


if __name__ == "__main__":
    main()
