"""The current backend model (RiskScoringService.ts, weights 0.5/0.3/0.2) recomputed on history.

Historical inputs are the closest available to what the backend reads live:
- temperature, humidity: NASA POWER daily mean (the backend uses Open-Meteo's current hour);
- wind: NASA POWER daily maximum at 2 m in km/h (the backend uses current wind at 10 m);
- days without rain: consecutive days < 1 mm ending on day d;
- nearby hotspots: VIIRS hotspots <= 25 km on days d-1 and d (the backend ingests the last 2 days);
- fires per year: fire_event rows of the zone from 2019-01-01 to day d (fireFrequency.ts).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .config import RADIUS_KM

SCORE_WEIGHTS = {"dry_weather": 0.5, "nearby_hotspots": 0.3, "fire_history": 0.2}
FIRE_RECORD_START = pd.Timestamp("2019-01-01")
FIRES_PER_YEAR_FOR_MAX = 1.0
YEAR_DAYS = 365.25


def _percent(ratio) -> np.ndarray:
    return np.round(np.clip(ratio, 0, 1) * 100)


def weighted_score(temperature_c, humidity_pct, wind_kmh, days_without_rain,
                   nearby_hotspots, fires_per_year) -> np.ndarray:
    """Vectorized copy of RiskScoringService.assess: score 0-100."""
    temperature = (np.asarray(temperature_c) - 10) / (32 - 10)
    dryness = (80 - np.asarray(humidity_pct)) / (80 - 20)
    wind = np.asarray(wind_kmh) / 40
    no_rain = np.asarray(days_without_rain) / 14
    dry_weather = _percent(0.3 * temperature + 0.35 * dryness + 0.15 * wind + 0.2 * no_rain)
    hotspots = _percent(np.asarray(nearby_hotspots) / 3)
    history = _percent(np.asarray(fires_per_year) / FIRES_PER_YEAR_FOR_MAX)
    return np.round(
        dry_weather * SCORE_WEIGHTS["dry_weather"]
        + hotspots * SCORE_WEIGHTS["nearby_hotspots"]
        + history * SCORE_WEIGHTS["fire_history"]
    )


def fires_per_year_until(rows: pd.DataFrame, fire_events: pd.DataFrame) -> np.ndarray:
    """Fires of the zone between FIRE_RECORD_START and each row's day, per year elapsed."""
    events = fire_events[fire_events["event_date"] >= FIRE_RECORD_START]
    result = np.zeros(len(rows))
    years = ((rows["date"] - FIRE_RECORD_START).dt.days + 1) / YEAR_DAYS
    for zone_id, zone_events in events.groupby("zone_id"):
        mask = (rows["zone_id"] == zone_id).to_numpy()
        dates = np.sort(zone_events["event_date"].to_numpy())
        result[mask] = np.searchsorted(dates, rows.loc[mask, "date"].to_numpy(), side="right")
    return result / years.to_numpy()


def weighted_model_scores(rows: pd.DataFrame, weather: pd.DataFrame, counts: pd.DataFrame,
                          fire_events: pd.DataFrame) -> np.ndarray:
    """Scores for rows (zone_id, date, dry_days) using weather, hotspot counts and fire events."""
    counts = counts.sort_values(["zone_id", "date"])
    zone_counts = counts[f"hotspots_today_r{RADIUS_KM}"]
    counts = counts.assign(
        hotspots_2d=zone_counts.groupby(counts["zone_id"]).rolling(2, min_periods=2).sum()
        .reset_index(level=0, drop=True)
    )
    table = rows[["zone_id", "date", "dry_days"]].merge(
        weather[["zone_id", "date", "temperature_mean_c", "humidity_mean_pct", "wind_max_ms"]],
        on=["zone_id", "date"], how="left",
    ).merge(counts[["zone_id", "date", "hotspots_2d"]], on=["zone_id", "date"], how="left")
    return weighted_score(
        table["temperature_mean_c"],
        table["humidity_mean_pct"],
        table["wind_max_ms"] * 3.6,
        table["dry_days"],
        table["hotspots_2d"],
        fires_per_year_until(table, fire_events),
    )
