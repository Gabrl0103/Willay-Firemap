"""Builds the daily zone x day dataset with the 72 h fire-activity label.

    python -m willay_ml.dataset

Row = (zone, local day d). The prediction is made at the end of day d, so:
- weather columns (NASA POWER, power.py) are those of day d; features.py only uses days <= d;
- label_r{R} = 1 if at least one VIIRS hotspot is detected within R km of the zone's municipal seat
  on days d+1, d+2 or d+3 (local dates, America/Bogota). The hotspots of day d are NOT in the label.

Hotspots used for the label: VIIRS SNPP + NOAA-20 (what the backend ingests), without detections
flagged by FIRMS as volcanoes, other static land sources or offshore (type 1/2/3, archive only).
Near-real-time rows have no type, so they are dropped when they fall within STATIC_SOURCE_KM of a
detection the archive flagged as static (Galeras, Cumbal, Azufral... and industrial sources).
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

from .config import (
    DATASET_START,
    HORIZON_DAYS,
    HOTSPOT_HISTORY_START,
    PROCESSED_DIR,
    RADIUS_KM,
    SENSITIVITY_RADII_KM,
)
from .firms import HOTSPOTS_PARQUET, VIIRS_SOURCES, covered_days
from .geo import distance_matrix_km, within_km_of_any
from .power import POWER_PARQUET
from .zones import load_zones

DATASET_PARQUET = PROCESSED_DIR / "dataset_daily.parquet"
# Hotspots per zone and local day for every radius, from 2014-12 (inputs of the phase 2 features).
COUNTS_PARQUET = PROCESSED_DIR / "hotspot_counts_daily.parquet"
STATIC_TYPES = (1, 2, 3)
# NOAA-20 data starts here; before it only SNPP exists.
NOAA20_START = pd.Timestamp("2018-04-01")
STATIC_SOURCE_KM = 1.0


def label_hotspots(hotspots: pd.DataFrame) -> pd.DataFrame:
    """VIIRS vegetation-fire candidates used for labels and hotspot counts."""
    viirs = hotspots[hotspots["sensor"].isin(VIIRS_SOURCES)]
    static = viirs[viirs["type"].isin(STATIC_TYPES)]
    archive = viirs[viirs["processing"] == "SP"]
    keep_archive = archive[~archive["type"].isin(STATIC_TYPES)]
    near_real_time = viirs[viirs["processing"] == "NRT"]
    near_static = within_km_of_any(
        near_real_time[["latitude", "longitude"]].to_numpy(),
        static[["latitude", "longitude"]].to_numpy(),
        STATIC_SOURCE_KM,
    )
    return pd.concat([keep_archive, near_real_time[~near_static]], ignore_index=True)


def daily_counts(
    zones: pd.DataFrame, hotspots: pd.DataFrame, radius_km: float, days: pd.DatetimeIndex
) -> pd.DataFrame:
    """Hotspots within radius_km of each zone per local day (zones x days, zeros included)."""
    distances = distance_matrix_km(
        zones[["latitude", "longitude"]].to_numpy(), hotspots[["latitude", "longitude"]].to_numpy()
    )
    zone_index, hotspot_index = np.nonzero(distances <= radius_km)
    near = pd.DataFrame(
        {
            "zone_id": zones["id"].to_numpy()[zone_index],
            "date": hotspots["local_date"].to_numpy()[hotspot_index],
        }
    )
    counts = near.groupby(["zone_id", "date"]).size()
    full = pd.MultiIndex.from_product([zones["id"], days], names=["zone_id", "date"])
    return counts.reindex(full, fill_value=0).rename("count").reset_index()


def future_any(counts: pd.Series, zone_ids: pd.Series, horizon: int) -> pd.Series:
    """1 if any of the next `horizon` days (d+1..d+horizon) has a count > 0; NaN when unknown.

    `counts` must be sorted by zone and date, with one row per day.
    """
    grouped = counts.groupby(zone_ids)
    future = sum(grouped.shift(-step) for step in range(1, horizon + 1))
    return (future > 0).astype("Int8").where(future.notna())


def missing_hotspot_days(days: pd.DatetimeIndex) -> pd.DatetimeIndex:
    """Days without a downloaded chunk for a sensor that should have data (would look like 0)."""
    snpp = covered_days("viirs_snpp")
    noaa20 = covered_days("viirs_noaa20")
    # Local day d spans UTC days d and d+1 (UTC-5): both must be covered.
    missing = days[~days.isin(snpp) | ~(days + pd.Timedelta(days=1)).isin(snpp)]
    recent = days[days >= NOAA20_START]
    missing_noaa20 = recent[~recent.isin(noaa20) | ~(recent + pd.Timedelta(days=1)).isin(noaa20)]
    return missing.union(missing_noaa20)


def build(today: date | None = None) -> pd.DataFrame:
    zones = load_zones().sort_values("id").reset_index(drop=True)
    hotspots = pd.read_parquet(HOTSPOTS_PARQUET)
    weather = pd.read_parquet(POWER_PARQUET)

    # Last day whose hotspots are complete: yesterday (local). Labels need HORIZON_DAYS after d.
    today = today or date.today()
    last_hotspot_day = pd.Timestamp(today - timedelta(days=1))
    days = pd.date_range(pd.Timestamp(HOTSPOT_HISTORY_START), last_hotspot_day)

    labeled = label_hotspots(hotspots)
    # The last local day also needs the next UTC day, which is today: drop it from the check.
    missing = missing_hotspot_days(days[:-1])
    if len(missing):
        print(f"Warning: {len(missing)} days without FIRMS chunks ({missing.min():%Y-%m-%d}.."
              f"{missing.max():%Y-%m-%d}); their labels are left empty. Run willay_ml.firms.")
    dataset = None
    for radius in sorted(set(SENSITIVITY_RADII_KM) | {RADIUS_KM}):
        counts = daily_counts(zones, labeled, radius, days)
        counts["count"] = counts["count"].astype(float)
        counts.loc[counts["date"].isin(missing), "count"] = np.nan
        counts[f"label_r{radius}"] = future_any(counts["count"], counts["zone_id"], HORIZON_DAYS)
        counts = counts.rename(columns={"count": f"hotspots_today_r{radius}"})
        dataset = counts if dataset is None else dataset.merge(counts, on=["zone_id", "date"])

    counts_columns = [c for c in dataset.columns if c.startswith("hotspots_today_r")]
    dataset[["zone_id", "date", *counts_columns]].to_parquet(COUNTS_PARQUET, index=False)

    # Rows: every zone x day from DATASET_START with a known label. Weather is NaN where missing.
    dataset = dataset.merge(weather, on=["zone_id", "date"], how="left")
    last_weather_day = weather["date"].max()
    dataset = dataset[
        (dataset["date"] >= pd.Timestamp(DATASET_START)) & (dataset["date"] <= last_weather_day)
    ]
    dataset = dataset[dataset[f"label_r{RADIUS_KM}"].notna()].reset_index(drop=True)
    DATASET_PARQUET.parent.mkdir(parents=True, exist_ok=True)
    dataset.to_parquet(DATASET_PARQUET, index=False)
    print(f"{len(dataset)} zone-days -> {DATASET_PARQUET}")
    return dataset


if __name__ == "__main__":
    build()
