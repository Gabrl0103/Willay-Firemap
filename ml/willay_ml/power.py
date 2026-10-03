"""Downloads daily historical weather from NASA POWER (daily point API, AG community, no key).

    python -m willay_ml.power              # download what is missing, then merge
    python -m willay_ml.power --merge-only

Replaces Open-Meteo (weather.py) as the training weather source: Open-Meteo counts one call per
location and 14 days, so the full history needed two days of free quota. POWER answers the whole
period of one point in one request (64 requests in total).

Limits (https://power.larc.nasa.gov/docs/services/api/): at most 20 parameters per point request;
no published request rate, but it answers 429 "Too Many Requests" and may block clients that keep
asking for the same location. So: one request per zone, sequential, a pause between requests,
exponential backoff on 429/5xx, and a per-zone cache in data/raw/nasa_power/.

Resolution: meteorology from MERRA-2 (0.5 x 0.625 degrees, ~55 x 70 km), precipitation corrected
with IMERG (0.1 degrees). Much coarser than Open-Meteo (ERA5-Land, ~11 km, elevation-corrected):
nearby municipalities share the same weather cell. Daily values in local solar time (LST).
MERRA-2 is about one month behind real time: the last days come as the fill value (-999 -> NaN).
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import date, timedelta

import numpy as np
import pandas as pd
import requests

from .config import DATASET_START, PROCESSED_DIR, RAW_DIR, WEATHER_LOOKBACK_DAYS
from .zones import load_zones

POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
COMMUNITY = "AG"
# POWER name -> dataset column.
PARAMETERS = {
    "PRECTOTCORR": "precipitation_mm",  # precipitation corrected (IMERG)
    "T2M": "temperature_mean_c",
    "T2M_MAX": "temperature_max_c",
    "T2M_MIN": "temperature_min_c",
    "RH2M": "humidity_mean_pct",
    "QV2M": "specific_humidity_g_kg",
    "WS2M": "wind_mean_ms",
    "WS2M_MAX": "wind_max_ms",
    "EVPTRNS": "evapotranspiration_mm",
    "GWETTOP": "surface_soil_wetness",
}
FILL_VALUE = -999.0
PAUSE_SECONDS = 1.0
MAX_RETRIES = 6

POWER_RAW_DIR = RAW_DIR / "nasa_power"
POWER_PARQUET = PROCESSED_DIR / "weather_power_daily.parquet"
# 30 days before the first dataset day, for the 30-day features.
POWER_START = DATASET_START - timedelta(days=WEATHER_LOOKBACK_DAYS + 1)


def cache_path(zone_id: str, start: date, end: date):
    return POWER_RAW_DIR / f"{zone_id}_{start:%Y%m%d}_{end:%Y%m%d}.json"


def fetch_point(session: requests.Session, latitude: float, longitude: float,
                start: date, end: date) -> dict:
    params = {
        "parameters": ",".join(PARAMETERS),
        "community": COMMUNITY,
        "latitude": f"{latitude:.4f}",
        "longitude": f"{longitude:.4f}",
        "start": f"{start:%Y%m%d}",
        "end": f"{end:%Y%m%d}",
        "format": "JSON",
        "time-standard": "LST",
    }
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = session.get(POWER_URL, params=params, timeout=120)
            if response.status_code == 429 or response.status_code >= 500:
                raise requests.HTTPError(f"HTTP {response.status_code}")
            response.raise_for_status()
            return response.json()
        except requests.RequestException as error:
            if attempt == MAX_RETRIES:
                raise
            wait = min(600, 30 * 2 ** (attempt - 1))
            print(f"  {error}; retry {attempt}/{MAX_RETRIES - 1} in {wait} s")
            time.sleep(wait)
    raise AssertionError("unreachable")


def download(end: date) -> None:
    zones = load_zones()
    pending = [z for z in zones.itertuples() if not cache_path(z.id, POWER_START, end).exists()]
    print(f"NASA POWER: {len(zones)} zones, {len(pending)} to download ({POWER_START}..{end})")
    session = requests.Session()
    for index, zone in enumerate(pending, start=1):
        payload = fetch_point(session, zone.latitude, zone.longitude, POWER_START, end)
        path = cache_path(zone.id, POWER_START, end)
        path.parent.mkdir(parents=True, exist_ok=True)
        partial = path.with_suffix(".part")
        partial.write_text(json.dumps(payload), encoding="utf-8")
        partial.replace(path)
        if index % 8 == 0 or index == len(pending):
            print(f"  {index}/{len(pending)} {zone.id}")
        time.sleep(PAUSE_SECONDS)


def point_to_frame(zone_id: str, payload: dict) -> pd.DataFrame:
    values = payload["properties"]["parameter"]
    frame = pd.DataFrame({PARAMETERS[name]: series for name, series in values.items()})
    frame.index = pd.to_datetime(frame.index, format="%Y%m%d")
    frame = frame.replace(FILL_VALUE, np.nan).rename_axis("date").reset_index()
    longitude, latitude, elevation = payload["geometry"]["coordinates"]
    frame.insert(0, "zone_id", zone_id)
    frame["power_elevation_m"] = elevation
    return frame


def merge() -> pd.DataFrame:
    files = sorted(POWER_RAW_DIR.glob("*.json"))
    if not files:
        raise SystemExit("No NASA POWER data cached. Run: python -m willay_ml.power")
    frames = []
    for path in files:
        zone_id = path.stem.rsplit("_", 2)[0]
        frames.append(point_to_frame(zone_id, json.loads(path.read_text(encoding="utf-8"))))
    weather = (
        pd.concat(frames, ignore_index=True)
        .sort_values(["zone_id", "date"])
        .drop_duplicates(["zone_id", "date"], keep="last")
    )
    # Trailing days still without MERRA-2 data (fill value in every column) are dropped.
    value_columns = list(PARAMETERS.values())
    weather = weather.dropna(subset=value_columns, how="all").reset_index(drop=True)
    POWER_PARQUET.parent.mkdir(parents=True, exist_ok=True)
    weather.to_parquet(POWER_PARQUET, index=False)
    print(
        f"{len(weather)} zone-days, {weather['zone_id'].nunique()} zones, "
        f"{weather['date'].min():%Y-%m-%d}..{weather['date'].max():%Y-%m-%d} -> {POWER_PARQUET}"
    )
    return weather


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--merge-only", action="store_true", help="only merge cached responses")
    parser.add_argument("--end", type=date.fromisoformat, default=date.today(),
                        help="last day requested (default: today)")
    args = parser.parse_args()
    if not args.merge_only:
        download(args.end)
    merge()


if __name__ == "__main__":
    main()
