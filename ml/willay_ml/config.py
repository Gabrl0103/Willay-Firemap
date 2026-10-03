"""Paths, study area and periods shared by every script."""

from __future__ import annotations

import os
from datetime import date
from pathlib import Path

from dotenv import load_dotenv

ML_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = ML_DIR.parent
DATA_DIR = ML_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
FIRMS_RAW_DIR = RAW_DIR / "firms"
WEATHER_RAW_DIR = RAW_DIR / "open_meteo"
ZONES_CSV = DATA_DIR / "zones.csv"
MUNICIPALITIES_TS = (
    REPO_DIR / "backend" / "src" / "infrastructure" / "persistence" / "narinoMunicipalities.ts"
)

# Same bounding box as the backend (FirmsHotspotProvider.ts): west, south, east, north.
NARINO_BBOX = (-79.1, 0.35, -76.8, 2.7)

# Hotspot labels and counts use local dates (Colombia, UTC-5, no daylight saving time).
LOCAL_UTC_OFFSET_HOURS = -5

# First day of the dataset (VIIRS 375 m is used from 2015 on).
DATASET_START = date(2015, 1, 1)
# Weather starts earlier so 30-day features exist on the first dataset day.
WEATHER_LOOKBACK_DAYS = 30

# Label: at least one hotspot within RADIUS_KM of the zone in the next HORIZON_DAYS days.
HORIZON_DAYS = 3
RADIUS_KM = 25  # same radius as the current model (ZoneRiskCalculator.ts)
SENSITIVITY_RADII_KM = (10, 25, 50)


def load_env() -> None:
    """Loads ml/.env, then backend/.env (both git-ignored). Real environment variables win."""
    for env_file in (ML_DIR / ".env", REPO_DIR / "backend" / ".env"):
        if env_file.exists():
            load_dotenv(env_file, override=False)


def require_env(name: str) -> str:
    load_env()
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(
            f"Missing environment variable {name}. Set it in your shell or in ml/.env "
            "(never commit it)."
        )
    return value


def optional_env(name: str) -> str | None:
    load_env()
    value = os.environ.get(name, "").strip()
    return value or None
