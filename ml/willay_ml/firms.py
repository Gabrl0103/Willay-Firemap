"""Downloads the NASA FIRMS hotspot history for the Nariño bounding box.

    python -m willay_ml.firms             # download what is missing, then merge
    python -m willay_ml.firms --merge-only

The area API answers at most 5 days per request and each request costs ~10 transactions of the
MAP_KEY budget (5000 every 10 minutes). Each 5-day chunk is cached as a CSV in
data/raw/firms/<SOURCE>/, so runs can be stopped and resumed without downloading again.

Sources: the standard-processing archive (*_SP) until its last day, then near-real-time (*_NRT).
VIIRS (375 m) SNPP + NOAA-20 from 2014-12 are the same satellites the backend ingests. MODIS (1 km) is downloaded
only to compare it with VIIRS (see summary).
"""

from __future__ import annotations

import argparse
import io
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import date, timedelta

import pandas as pd
import requests

from .config import (
    FIRMS_RAW_DIR,
    HOTSPOT_HISTORY_START,
    LOCAL_UTC_OFFSET_HOURS,
    NARINO_BBOX,
    PROCESSED_DIR,
    require_env,
)

FIRMS_URL = "https://firms.modaps.eosdis.nasa.gov"
CHUNK_DAYS = 5  # API maximum
# Leave room for the backend ingestion, which uses the same MAP_KEY.
TRANSACTION_BUDGET = 4000
STATUS_CHECK_EVERY = 20
PAUSE_SECONDS = 0.5
WORKERS = 3  # parallel requests (the budget check is shared)
MAX_RETRIES = 6

HISTORY_START = HOTSPOT_HISTORY_START

# (archive, near-real-time) pairs. NOAA-21 is left out: the backend does not ingest it.
SOURCE_PAIRS = {
    "viirs_snpp": ("VIIRS_SNPP_SP", "VIIRS_SNPP_NRT"),
    "viirs_noaa20": ("VIIRS_NOAA20_SP", "VIIRS_NOAA20_NRT"),
    "modis": ("MODIS_SP", "MODIS_NRT"),
}
VIIRS_SOURCES = ("viirs_snpp", "viirs_noaa20")

HOTSPOTS_PARQUET = PROCESSED_DIR / "firms_hotspots.parquet"


@dataclass(frozen=True)
class Chunk:
    source: str
    start: date
    end: date  # inclusive

    @property
    def days(self) -> int:
        return (self.end - self.start).days + 1

    @property
    def path(self):
        return FIRMS_RAW_DIR / self.source / f"{self.start:%Y-%m-%d}_{self.end:%Y-%m-%d}.csv"


def plan_chunks(source: str, start: date, end: date) -> list[Chunk]:
    chunks, current = [], start
    while current <= end:
        chunk_end = min(current + timedelta(days=CHUNK_DAYS - 1), end)
        chunks.append(Chunk(source, current, chunk_end))
        current = chunk_end + timedelta(days=1)
    return chunks


def is_firms_csv(text: str) -> bool:
    """FIRMS answers errors as plain text with status 200 ("Invalid MAP_KEY.")."""
    return text.lstrip().startswith("latitude,")


class FirmsClient:
    def __init__(self, map_key: str) -> None:
        self.map_key = map_key
        self.session = requests.Session()
        self.requests_since_check = 0
        self.budget_lock = threading.Lock()

    def availability(self) -> dict[str, tuple[date, date]]:
        text = self._get(f"{FIRMS_URL}/api/data_availability/csv/{self.map_key}/all")
        frame = pd.read_csv(io.StringIO(text))
        return {
            row.data_id: (date.fromisoformat(row.min_date), date.fromisoformat(row.max_date))
            for row in frame.itertuples()
        }

    def transactions_in_window(self) -> int:
        response = self.session.get(
            f"{FIRMS_URL}/mapserver/mapkey_status/", params={"MAP_KEY": self.map_key}, timeout=30
        )
        response.raise_for_status()
        return int(response.json().get("current_transactions", 0))

    def wait_for_budget(self) -> None:
        with self.budget_lock:
            self.requests_since_check += 1
            if self.requests_since_check < STATUS_CHECK_EVERY:
                return
            self.requests_since_check = 0
            while (used := self.transactions_in_window()) > TRANSACTION_BUDGET:
                print(f"  FIRMS budget: {used} transactions in the last 10 min, waiting 60 s")
                time.sleep(60)

    def area_csv(self, chunk: Chunk) -> str:
        west, south, east, north = NARINO_BBOX
        url = (
            f"{FIRMS_URL}/api/area/csv/{self.map_key}/{chunk.source}/"
            f"{west},{south},{east},{north}/{chunk.days}/{chunk.start:%Y-%m-%d}"
        )
        self.wait_for_budget()
        text = self._get(url)
        if not is_firms_csv(text):
            raise RuntimeError(f"Unexpected FIRMS answer for {chunk}: {text[:120]!r}")
        return text

    def _get(self, url: str) -> str:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = self.session.get(url, timeout=60)
                if response.status_code == 429 or response.status_code >= 500:
                    raise requests.HTTPError(f"HTTP {response.status_code}")
                response.raise_for_status()
                if "Invalid MAP_KEY" in response.text[:100]:
                    raise SystemExit("FIRMS rejected the MAP_KEY.")
                if "Exceeding allowed transaction limit" in response.text[:200]:
                    raise requests.HTTPError("transaction limit")
                return response.text
            except (requests.RequestException, requests.HTTPError) as error:
                if attempt == MAX_RETRIES:
                    raise
                wait = min(600, 15 * 2 ** (attempt - 1))
                print(f"  {error}; retry {attempt}/{MAX_RETRIES - 1} in {wait} s")
                time.sleep(wait)
        raise AssertionError("unreachable")


def chunks_to_download(availability: dict[str, tuple[date, date]], today: date) -> list[Chunk]:
    """Archive chunks until the archive ends, near-real-time chunks after that."""
    chunks: list[Chunk] = []
    for archive, near_real_time in SOURCE_PAIRS.values():
        archive_start, archive_end = availability[archive]
        start = max(HISTORY_START, archive_start)
        chunks += plan_chunks(archive, start, archive_end)
        nrt_start, nrt_end = availability[near_real_time]
        chunks += plan_chunks(
            near_real_time, max(archive_end + timedelta(days=1), nrt_start), min(nrt_end, today)
        )
    return chunks


def download(client: FirmsClient) -> None:
    today = date.today()
    availability = client.availability()
    chunks = chunks_to_download(availability, today)
    # The last chunk of each source may still grow: never trust its cache.
    open_ended = {source: max(c.end for c in chunks if c.source == source) for source in
                  {c.source for c in chunks}}
    pending = [c for c in chunks if not c.path.exists() or c.end >= open_ended[c.source]]
    print(f"FIRMS: {len(chunks)} chunks, {len(pending)} to download")

    def fetch(chunk: Chunk) -> None:
        text = client.area_csv(chunk)
        chunk.path.parent.mkdir(parents=True, exist_ok=True)
        # Write then rename, so an interrupted run never leaves a truncated chunk in the cache.
        partial = chunk.path.with_suffix(".part")
        partial.write_text(text, encoding="utf-8")
        partial.replace(chunk.path)
        time.sleep(PAUSE_SECONDS)

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for index, _ in enumerate(pool.map(fetch, pending), start=1):
            if index % 100 == 0 or index == len(pending):
                print(f"  {index}/{len(pending)} chunks")


def covered_days(sensor: str) -> pd.DatetimeIndex:
    """UTC days covered by the cached chunks of one sensor (archive + near-real-time)."""
    days: set[pd.Timestamp] = set()
    for processing in ("SP", "NRT"):
        for path in (FIRMS_RAW_DIR / f"{sensor.upper()}_{processing}").glob("*.csv"):
            start, end = path.stem.split("_")
            days.update(pd.date_range(start, end))
    return pd.DatetimeIndex(sorted(days))


def read_chunk(path) -> pd.DataFrame:
    frame = pd.read_csv(path, dtype={"acq_time": str, "confidence": str, "version": str})
    frame["source"] = path.parent.name
    return frame


def merge() -> pd.DataFrame:
    """All cached chunks -> one table with UTC timestamps and local (Colombia) dates."""
    files = sorted(FIRMS_RAW_DIR.glob("*/*.csv"))
    if not files:
        raise SystemExit("No FIRMS chunks cached. Run: python -m willay_ml.firms")
    frames = [frame for frame in (read_chunk(path) for path in files) if not frame.empty]
    raw = pd.concat(frames, ignore_index=True)
    hhmm = raw["acq_time"].str.zfill(4)
    detected_utc = pd.to_datetime(
        raw["acq_date"] + " " + hhmm.str[:2] + ":" + hhmm.str[2:], utc=True
    )
    local = detected_utc + pd.Timedelta(hours=LOCAL_UTC_OFFSET_HOURS)
    hotspots = pd.DataFrame(
        {
            "source": raw["source"],
            "sensor": raw["source"].str.replace(r"_(SP|NRT)$", "", regex=True).str.lower(),
            "processing": raw["source"].str.extract(r"_(SP|NRT)$")[0],
            "latitude": raw["latitude"],
            "longitude": raw["longitude"],
            "detected_utc": detected_utc,
            "local_date": local.dt.tz_localize(None).dt.normalize(),
            "confidence": raw["confidence"],
            "frp": raw["frp"],
            "daynight": raw["daynight"],
            # 0 vegetation fire, 1 active volcano, 2 other static land source, 3 offshore.
            # Only in the archive (SP); NRT rows have no type.
            "type": raw["type"] if "type" in raw else pd.NA,
        }
    )
    hotspots["type"] = hotspots["type"].astype("Int8")
    hotspots = hotspots.drop_duplicates(["source", "latitude", "longitude", "detected_utc"])
    hotspots = hotspots.sort_values("detected_utc").reset_index(drop=True)
    HOTSPOTS_PARQUET.parent.mkdir(parents=True, exist_ok=True)
    hotspots.to_parquet(HOTSPOTS_PARQUET, index=False)
    print(f"{len(hotspots)} hotspots from {len(files)} chunks -> {HOTSPOTS_PARQUET}")
    return hotspots


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--merge-only", action="store_true", help="only merge cached chunks")
    args = parser.parse_args()
    if not args.merge_only:
        download(FirmsClient(require_env("MAP_KEY")))
    merge()


if __name__ == "__main__":
    main()
