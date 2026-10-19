from datetime import UTC, date, datetime, timedelta

import pandas as pd

from willay_ml.firms import CHUNK_DAYS, is_firms_csv, plan_chunks
from willay_ml.weather import LIMITS, UsageLedger, call_weight, locations_to_frame
from willay_ml.weather import plan_chunks as plan_weather_chunks
from willay_ml.zones import parse_municipalities_ts


def test_firms_chunks_cover_the_range_without_gaps():
    chunks = plan_chunks("VIIRS_SNPP_SP", date(2020, 1, 1), date(2020, 1, 31))
    assert chunks[0].start == date(2020, 1, 1)
    assert chunks[-1].end == date(2020, 1, 31)
    assert all(chunk.days <= CHUNK_DAYS for chunk in chunks)
    for previous, current in zip(chunks, chunks[1:]):
        assert current.start == previous.end + timedelta(days=1)


def test_firms_error_text_is_not_csv():
    assert is_firms_csv("latitude,longitude,bright_ti4\n")
    assert not is_firms_csv("Invalid MAP_KEY.")


def test_open_meteo_call_weight():
    assert call_weight(1, 10, 14) == 1
    assert call_weight(1, 15, 14) == 1.5
    assert call_weight(16, 10, 28) == 32


def test_weather_chunks_split_by_year_and_batch():
    zone_ids = [f"z{i:02d}" for i in range(20)]
    chunks = plan_weather_chunks(zone_ids, date(2024, 12, 2), date(2025, 3, 1))
    assert len(chunks) == 4  # 2 years x 2 batches (16 + 4)
    assert chunks[0].start == date(2025, 1, 1)  # most recent first
    assert {len(chunk.zone_ids) for chunk in chunks} == {16, 4}


def test_ledger_waits_when_the_hour_is_full(tmp_path):
    ledger = UsageLedger(tmp_path / "usage.jsonl")
    now = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)
    ledger.record(LIMITS["hour"] - 10, now - timedelta(minutes=30))
    wait = ledger.seconds_to_wait(100, now)
    assert 29 * 60 < wait <= 31 * 60
    assert ledger.seconds_to_wait(5, now + timedelta(minutes=2)) == 0


def test_ledger_waits_for_the_next_utc_day(tmp_path):
    ledger = UsageLedger(tmp_path / "usage.jsonl")
    now = datetime(2026, 1, 1, 22, 0, tzinfo=UTC)
    for hour in (10, 14, 18):
        ledger.record(LIMITS["day"] / 3, now.replace(hour=hour))
    assert ledger.seconds_to_wait(1, now) >= 2 * 3600
    # The ledger is persisted, so a new run sees the same usage.
    assert UsageLedger(tmp_path / "usage.jsonl").used(now)["day"] >= LIMITS["day"] - 1


def test_locations_to_frame_keeps_zone_order():
    location = {"latitude": 1, "longitude": -77, "elevation": 2500,
                "daily": {"time": ["2024-01-01"], "precipitation_sum": [3.2]}}
    frame = locations_to_frame(["a", "b"], [location, {**location, "elevation": 10}])
    assert list(frame["zone_id"]) == ["a", "b"]
    assert list(frame["grid_elevation"]) == [2500, 10]
    assert isinstance(frame, pd.DataFrame)


def test_parse_municipalities_ts():
    source = (
        "{ divipola: 52001, id: 'pasto', name: 'Pasto', latitude: 1.212352, "
        "longitude: -77.278795, aliases: ['San Juan de Pasto'] },"
    )
    zones = parse_municipalities_ts(source)
    assert zones.iloc[0].to_dict() == {
        "id": "pasto", "name": "Pasto", "divipola": 52001,
        "latitude": 1.212352, "longitude": -77.278795,
    }
