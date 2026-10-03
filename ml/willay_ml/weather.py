"""Downloads daily historical weather (Open-Meteo Historical Weather API) for every zone.

    python -m willay_ml.weather              # download what is missing, then merge
    python -m willay_ml.weather --merge-only

Open-Meteo is free without a key but counts usage per location: one call per location for up to
10 variables and 14 days, so one year for one location is ~26 calls. Free limits: 600/min,
5000/hour, 10000/day. The full history (64 zones, 2014-12 to today) is ~19,600 calls, so the
download takes two UTC days. Every request is logged in data/raw/open_meteo/usage.jsonl and the
script waits before going over the limits (with a safety margin), so it can be stopped and run
again. Responses are cached per (zone batch, year).

Data: ERA5 / ERA5-Land reanalysis (best match, ~11-25 km grid, corrected to the elevation of the
coordinates), local dates (America/Bogota). It is not station data.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import time
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

import pandas as pd
import requests

from .config import DATASET_START, PROCESSED_DIR, WEATHER_LOOKBACK_DAYS, WEATHER_RAW_DIR
from .zones import load_zones

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
DAILY_VARIABLES = (
    "precipitation_sum",
    "temperature_2m_max",
    "temperature_2m_min",
    "temperature_2m_mean",
    "wind_speed_10m_max",
    "wind_speed_10m_mean",
    "et0_fao_evapotranspiration",
    "relative_humidity_2m_mean",
    "relative_humidity_2m_min",
    "vapour_pressure_deficit_max",
)
# ERA5 is published with a ~5 day delay.
ARCHIVE_DELAY_DAYS = 6
ZONES_PER_REQUEST = 16

# Limits of the free API, with a margin (other apps on the same IP, like the backend ingestion).
LIMITS = {"minute": 500, "hour": 4500, "day": 9500}
USAGE_LOG = WEATHER_RAW_DIR / "usage.jsonl"
MAX_RETRIES = 6

WEATHER_PARQUET = PROCESSED_DIR / "weather_daily.parquet"
WEATHER_START = DATASET_START - timedelta(days=WEATHER_LOOKBACK_DAYS)


def call_weight(locations: int, variables: int, days: int) -> float:
    """Open-Meteo counting: >10 variables or >14 days for one location count as several calls."""
    return locations * max(1.0, variables / 10) * max(1.0, days / 14)


@dataclass(frozen=True)
class WeatherChunk:
    zone_ids: tuple[str, ...]
    start: date
    end: date  # inclusive

    @property
    def weight(self) -> float:
        days = (self.end - self.start).days + 1
        return call_weight(len(self.zone_ids), len(DAILY_VARIABLES), days)

    @property
    def path(self):
        batch = hashlib.sha1(",".join(self.zone_ids).encode()).hexdigest()[:8]
        return WEATHER_RAW_DIR / f"{self.start:%Y-%m-%d}_{self.end:%Y-%m-%d}_{batch}.json"


def plan_chunks(zone_ids: list[str], start: date, end: date) -> list[WeatherChunk]:
    """One chunk per (batch of zones, calendar year); most recent years first."""
    batches = [
        tuple(zone_ids[i : i + ZONES_PER_REQUEST])
        for i in range(0, len(zone_ids), ZONES_PER_REQUEST)
    ]
    chunks = []
    for year in range(end.year, start.year - 1, -1):
        year_start, year_end = max(start, date(year, 1, 1)), min(end, date(year, 12, 31))
        chunks += [WeatherChunk(batch, year_start, year_end) for batch in batches]
    return chunks


class UsageLedger:
    """Calls made in the last minute/hour and in the current UTC day, persisted on disk."""

    def __init__(self, path=USAGE_LOG) -> None:
        self.path = path
        self.entries: list[tuple[datetime, float]] = []
        if path.exists():
            for line in path.read_text(encoding="utf-8").splitlines():
                record = json.loads(line)
                self.entries.append((datetime.fromisoformat(record["at"]), record["weight"]))

    def used(self, now: datetime) -> dict[str, float]:
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        windows = {
            "minute": now - timedelta(minutes=1),
            "hour": now - timedelta(hours=1),
            "day": day_start,
        }
        return {
            name: sum(weight for at, weight in self.entries if at >= since)
            for name, since in windows.items()
        }

    def seconds_to_wait(self, weight: float, now: datetime) -> float:
        used = self.used(now)
        if used["day"] + weight > LIMITS["day"]:
            tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=2, second=0, microsecond=0)
            return (tomorrow - now).total_seconds()
        for name, span in (("hour", timedelta(hours=1)), ("minute", timedelta(minutes=1))):
            if used[name] + weight > LIMITS[name]:
                since = now - span
                # Wait until enough old calls leave the window.
                excess = used[name] + weight - LIMITS[name]
                freed = 0.0
                for at, entry_weight in sorted(e for e in self.entries if e[0] >= since):
                    freed += entry_weight
                    if freed >= excess:
                        return (at + span - now).total_seconds() + 1
        return 0.0

    def record(self, weight: float, now: datetime) -> None:
        self.entries.append((now, weight))
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as log:
            log.write(json.dumps({"at": now.isoformat(), "weight": round(weight, 2)}) + "\n")


def fetch_chunk(session: requests.Session, chunk: WeatherChunk, zones: pd.DataFrame) -> list:
    rows = zones.set_index("id").loc[list(chunk.zone_ids)]
    params = {
        "latitude": ",".join(f"{value:.6f}" for value in rows["latitude"]),
        "longitude": ",".join(f"{value:.6f}" for value in rows["longitude"]),
        "start_date": chunk.start.isoformat(),
        "end_date": chunk.end.isoformat(),
        "daily": ",".join(DAILY_VARIABLES),
        "wind_speed_unit": "kmh",
        "timezone": "America/Bogota",
    }
    response = session.get(ARCHIVE_URL, params=params, timeout=180)
    if response.status_code == 429:
        raise RateLimited(response.text[:200])
    response.raise_for_status()
    data = response.json()
    locations = data if isinstance(data, list) else [data]
    if len(locations) != len(chunk.zone_ids):
        raise RuntimeError(f"{len(locations)} locations for {len(chunk.zone_ids)} zones")
    return locations


class RateLimited(Exception):
    pass


def download(end: date) -> None:
    zones = load_zones()
    chunks = plan_chunks(sorted(zones["id"]), WEATHER_START, end)
    pending = [chunk for chunk in chunks if not chunk.path.exists()]
    total = sum(chunk.weight for chunk in pending)
    print(f"Open-Meteo: {len(chunks)} chunks, {len(pending)} to download (~{total:,.0f} calls)")
    ledger, session = UsageLedger(), requests.Session()
    for index, chunk in enumerate(pending, start=1):
        for attempt in range(1, MAX_RETRIES + 1):
            wait = ledger.seconds_to_wait(chunk.weight, datetime.now(UTC))
            if wait > 0:
                print(f"  usage limit: waiting {wait / 60:.1f} min ({ledger.used(datetime.now(UTC))})")
                time.sleep(wait)
            try:
                locations = fetch_chunk(session, chunk, zones)
                ledger.record(chunk.weight, datetime.now(UTC))
                break
            except RateLimited as error:
                # Counted by the server anyway; wait for the window named in the message.
                ledger.record(chunk.weight, datetime.now(UTC))
                pause = 3600 if "Hourly" in str(error) else 60
                if "Daily" in str(error):
                    pause = ledger.seconds_to_wait(LIMITS["day"], datetime.now(UTC))
                print(f"  429 {error!s}; waiting {pause / 60:.1f} min")
                time.sleep(pause)
            except requests.RequestException as error:
                if attempt == MAX_RETRIES:
                    raise
                print(f"  {error}; retry {attempt} in {30 * attempt} s")
                time.sleep(30 * attempt)
        else:
            raise RuntimeError(f"Could not download {chunk}")
        chunk.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"zone_ids": list(chunk.zone_ids), "locations": locations}
        chunk.path.write_text(json.dumps(payload), encoding="utf-8")
        print(f"  {index}/{len(pending)} {chunk.start}..{chunk.end} ({len(chunk.zone_ids)} zones)")


def locations_to_frame(zone_ids: list[str], locations: list[dict]) -> pd.DataFrame:
    frames = []
    for zone_id, location in zip(zone_ids, locations, strict=True):
        frame = pd.DataFrame(location["daily"])
        frame.insert(0, "zone_id", zone_id)
        frame["grid_latitude"] = location["latitude"]
        frame["grid_longitude"] = location["longitude"]
        frame["grid_elevation"] = location.get("elevation")
        frames.append(frame)
    return pd.concat(frames, ignore_index=True).rename(columns={"time": "date"})


def merge() -> pd.DataFrame:
    files = sorted(WEATHER_RAW_DIR.glob("*.json"))
    if not files:
        raise SystemExit("No weather cached. Run: python -m willay_ml.weather")
    frames = []
    for path in files:
        payload = json.loads(path.read_text(encoding="utf-8"))
        frames.append(locations_to_frame(payload["zone_ids"], payload["locations"]))
    weather = pd.concat(frames, ignore_index=True)
    weather["date"] = pd.to_datetime(weather["date"])
    weather = (
        weather.sort_values(["zone_id", "date"])
        .drop_duplicates(["zone_id", "date"], keep="last")
        .reset_index(drop=True)
    )
    WEATHER_PARQUET.parent.mkdir(parents=True, exist_ok=True)
    weather.to_parquet(WEATHER_PARQUET, index=False)
    print(
        f"{len(weather)} zone-days, {weather['zone_id'].nunique()} zones, "
        f"{weather['date'].min():%Y-%m-%d}..{weather['date'].max():%Y-%m-%d} -> {WEATHER_PARQUET}"
    )
    return weather


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--merge-only", action="store_true", help="only merge cached responses")
    parser.add_argument(
        "--end",
        type=date.fromisoformat,
        default=date.today() - timedelta(days=ARCHIVE_DELAY_DAYS),
        help="last day (default: today minus the ERA5 delay)",
    )
    args = parser.parse_args()
    if not args.merge_only:
        download(args.end)
    merge()


if __name__ == "__main__":
    main()
