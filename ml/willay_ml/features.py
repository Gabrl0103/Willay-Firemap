"""Phase 2: features per zone and day d, using only data of days <= d (no leakage).

    python -m willay_ml.features     # -> data/processed/features_daily.parquet

Every window ends on day d (inclusive): the prediction is made at the end of day d, when the
weather of day d and the hotspots detected that day are known. Labels look at d+1..d+3.

Feature groups:
- weather (NASA POWER): rain sums 3/7/14/30 days, consecutive dry days (< 1 mm), temperature and its
  7-day trend, daily range, wind, evapotranspiration, 30-day water balance, humidity, soil wetness;
- hotspots (VIIRS): in the zone (<= 25 km) and in the ring around it (25-50 km, the neighbouring
  municipalities) during the last 1, 7 and 30 days;
- season: day of year as sine/cosine;
- zone propensity: days per year with a hotspot <= 25 km in 2015-2018, before the first dataset day
  (and before the training rows), so it never sees the validation/test years.

The same functions must be ported to the backend in phase 4 (FEATURE_COLUMNS is the contract).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .config import PROCESSED_DIR, RADIUS_KM
from .dataset import COUNTS_PARQUET, DATASET_PARQUET
from .power import POWER_PARQUET

FEATURES_PARQUET = PROCESSED_DIR / "features_daily.parquet"
DRY_DAY_MM = 1.0  # same threshold as the backend (OpenMeteoWeatherProvider.ts)
RING_RADIUS_KM = 50
PROPENSITY_START = pd.Timestamp("2015-01-01")
PROPENSITY_END = pd.Timestamp("2018-12-31")

WEATHER_FEATURES = [
    "rain_1d_mm",
    "rain_3d_mm",
    "rain_7d_mm",
    "rain_14d_mm",
    "rain_30d_mm",
    "dry_days",
    "temperature_mean_c",
    "temperature_max_c",
    "temperature_range_c",
    "temperature_trend_7d_c",
    "humidity_mean_pct",
    "humidity_7d_pct",
    "wind_max_ms",
    "wind_7d_ms",
    "evapotranspiration_mm",
    "water_balance_30d_mm",
    "surface_soil_wetness",
]
HOTSPOT_FEATURES = [
    "hotspots_zone_1d",
    "hotspots_zone_7d",
    "hotspots_zone_30d",
    "hotspots_ring_7d",
    "hotspots_ring_30d",
]
SEASON_FEATURES = ["day_of_year_sin", "day_of_year_cos"]
ZONE_FEATURES = ["zone_hotspot_days_per_year"]
FEATURE_COLUMNS = WEATHER_FEATURES + HOTSPOT_FEATURES + SEASON_FEATURES + ZONE_FEATURES


def consecutive_dry_days(rain_mm: pd.Series) -> pd.Series:
    """Dry days in a row ending on each day (0 if that day rained). NaN rain breaks the streak."""
    dry = (rain_mm < DRY_DAY_MM).astype(int)
    streak_id = (dry == 0).cumsum()
    return dry.groupby(streak_id).cumsum().astype(float).where(rain_mm.notna())


def weather_features(weather: pd.DataFrame) -> pd.DataFrame:
    """weather: one row per zone and day (NASA POWER columns). Windows end on the row's day."""
    weather = weather.sort_values(["zone_id", "date"]).reset_index(drop=True)
    by_zone = weather.groupby("zone_id", sort=False)

    def rolling(column: str, days: int, how: str) -> pd.Series:
        result = by_zone[column].rolling(days, min_periods=days).agg(how)
        return result.reset_index(level=0, drop=True)

    out = weather[["zone_id", "date"]].copy()
    out["rain_1d_mm"] = weather["precipitation_mm"]
    for days in (3, 7, 14, 30):
        out[f"rain_{days}d_mm"] = rolling("precipitation_mm", days, "sum")
    out["dry_days"] = by_zone["precipitation_mm"].transform(consecutive_dry_days)
    out["temperature_mean_c"] = weather["temperature_mean_c"]
    out["temperature_max_c"] = weather["temperature_max_c"]
    out["temperature_range_c"] = weather["temperature_max_c"] - weather["temperature_min_c"]
    mean_7d = rolling("temperature_mean_c", 7, "mean")
    # Last 7 days minus the 7 days before them.
    out["temperature_trend_7d_c"] = mean_7d - mean_7d.groupby(weather["zone_id"]).shift(7)
    out["humidity_mean_pct"] = weather["humidity_mean_pct"]
    out["humidity_7d_pct"] = rolling("humidity_mean_pct", 7, "mean")
    out["wind_max_ms"] = weather["wind_max_ms"]
    out["wind_7d_ms"] = rolling("wind_mean_ms", 7, "mean")
    out["evapotranspiration_mm"] = weather["evapotranspiration_mm"]
    out["water_balance_30d_mm"] = out["rain_30d_mm"] - rolling("evapotranspiration_mm", 30, "sum")
    out["surface_soil_wetness"] = weather["surface_soil_wetness"]
    return out


def hotspot_features(counts: pd.DataFrame) -> pd.DataFrame:
    """counts: hotspots_today_r{R} per zone and day (NaN = no FIRMS data that day)."""
    counts = counts.sort_values(["zone_id", "date"]).reset_index(drop=True)
    zone = counts[f"hotspots_today_r{RADIUS_KM}"]
    ring = counts[f"hotspots_today_r{RING_RADIUS_KM}"] - zone
    out = counts[["zone_id", "date"]].copy()
    out["hotspots_zone_1d"] = zone
    for name, series in (("zone", zone), ("ring", ring)):
        grouped = series.groupby(counts["zone_id"], sort=False)
        for days in (7, 30):
            rolled = grouped.rolling(days, min_periods=days).sum().reset_index(level=0, drop=True)
            out[f"hotspots_{name}_{days}d"] = rolled
    return out


def zone_propensity(counts: pd.DataFrame) -> pd.DataFrame:
    """Days per year with at least one hotspot <= RADIUS_KM, in PROPENSITY_START..PROPENSITY_END."""
    period = counts[(counts["date"] >= PROPENSITY_START) & (counts["date"] <= PROPENSITY_END)]
    years = ((PROPENSITY_END - PROPENSITY_START).days + 1) / 365.25
    active = period[f"hotspots_today_r{RADIUS_KM}"] > 0
    rate = active.groupby(period["zone_id"]).sum() / years
    return rate.rename("zone_hotspot_days_per_year").reset_index()


def season_features(dates: pd.Series) -> pd.DataFrame:
    angle = 2 * np.pi * (dates.dt.dayofyear - 1) / 365.25
    return pd.DataFrame({"day_of_year_sin": np.sin(angle), "day_of_year_cos": np.cos(angle)})


def build_features(weather: pd.DataFrame, counts: pd.DataFrame) -> pd.DataFrame:
    """All features per zone and day (rows of weather that also have hotspot counts)."""
    features = weather_features(weather).merge(
        hotspot_features(counts), on=["zone_id", "date"], how="inner"
    )
    features = features.merge(zone_propensity(counts), on="zone_id", how="left")
    features[SEASON_FEATURES] = season_features(features["date"]).to_numpy()
    return features[["zone_id", "date", *FEATURE_COLUMNS]]


def build() -> pd.DataFrame:
    weather = pd.read_parquet(POWER_PARQUET)
    counts = pd.read_parquet(COUNTS_PARQUET)
    labels = pd.read_parquet(DATASET_PARQUET)
    label_columns = [c for c in labels.columns if c.startswith("label_r")]
    features = build_features(weather, counts)
    table = labels[["zone_id", "date", *label_columns]].merge(
        features, on=["zone_id", "date"], how="inner"
    )
    table.to_parquet(FEATURES_PARQUET, index=False)
    missing = table[FEATURE_COLUMNS].isna().sum()
    print(f"{len(table)} rows x {len(FEATURE_COLUMNS)} features -> {FEATURES_PARQUET}")
    print(f"Missing values: {missing[missing > 0].to_dict() or 'none'}")
    return table


if __name__ == "__main__":
    build()
