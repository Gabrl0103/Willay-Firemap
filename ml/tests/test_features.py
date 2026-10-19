import numpy as np
import pandas as pd
import pytest

from willay_ml.config import DATASET_START
from willay_ml.features import (
    FEATURE_COLUMNS,
    PROPENSITY_END,
    build_features,
    consecutive_dry_days,
)
from willay_ml.power import PARAMETERS

DAYS = pd.date_range("2014-12-02", "2019-06-30")
ZONE_IDS = ["a", "b", "c"]


def synthetic_inputs(seed: int = 0):
    rng = np.random.default_rng(seed)
    index = pd.MultiIndex.from_product([ZONE_IDS, DAYS], names=["zone_id", "date"])
    weather = pd.DataFrame(index=index).reset_index()
    for column in PARAMETERS.values():
        weather[column] = rng.gamma(2.0, 2.0, len(weather))
    weather = weather[weather["date"] >= "2018-12-01"].reset_index(drop=True)
    counts = pd.DataFrame(index=index).reset_index()
    for radius in (10, 25, 50):
        counts[f"hotspots_today_r{radius}"] = rng.poisson(0.2 * radius / 25, len(counts)).astype(float)
    return weather, counts


def corrupt_after(frame: pd.DataFrame, cutoff: pd.Timestamp, seed: int) -> pd.DataFrame:
    """Replaces every value after the cutoff day with random numbers."""
    rng = np.random.default_rng(seed)
    frame = frame.copy()
    later = frame["date"] > cutoff
    for column in frame.columns.difference(["zone_id", "date"]):
        frame.loc[later, column] = rng.uniform(0, 500, later.sum())
    return frame


@pytest.mark.parametrize("cutoff", ["2019-01-01", "2019-02-15", "2019-05-31"])
def test_no_feature_uses_data_after_the_prediction_day(cutoff):
    cutoff = pd.Timestamp(cutoff)
    weather, counts = synthetic_inputs()
    clean = build_features(weather, counts)
    leaked = build_features(corrupt_after(weather, cutoff, 1), corrupt_after(counts, cutoff, 2))
    rows = clean["date"] <= cutoff
    pd.testing.assert_frame_equal(
        clean.loc[rows, FEATURE_COLUMNS].reset_index(drop=True),
        leaked.loc[rows, FEATURE_COLUMNS].reset_index(drop=True),
    )
    # Sanity check: the corruption does change later rows (the test can fail).
    assert not clean.loc[~rows, FEATURE_COLUMNS].equals(leaked.loc[~rows, FEATURE_COLUMNS])


def test_zone_propensity_ends_before_the_first_dataset_day():
    assert PROPENSITY_END < pd.Timestamp(DATASET_START)


def test_features_have_no_gaps_from_the_first_dataset_day():
    weather, counts = synthetic_inputs()
    features = build_features(weather, counts)
    rows = features[features["date"] >= pd.Timestamp(DATASET_START)]
    assert rows[FEATURE_COLUMNS].notna().all().all()


def test_consecutive_dry_days():
    rain = pd.Series([5.0, 0.0, 0.2, 0.9, 3.0, 0.0, np.nan, 0.0])
    assert consecutive_dry_days(rain).tolist()[:6] == [0, 1, 2, 3, 0, 1]
    assert np.isnan(consecutive_dry_days(rain).iloc[6])


def test_hotspot_windows_sum_the_last_days_including_today():
    weather, counts = synthetic_inputs()
    counts[[c for c in counts.columns if c.startswith("hotspots")]] = 0.0
    day = pd.Timestamp("2019-03-10")
    hit = (counts["zone_id"] == "a") & (counts["date"] == day - pd.Timedelta(days=6))
    counts.loc[hit, ["hotspots_today_r25", "hotspots_today_r50"]] = [2.0, 5.0]
    features = build_features(weather, counts).set_index(["zone_id", "date"])
    row = features.loc[("a", day)]
    assert row["hotspots_zone_7d"] == 2 and row["hotspots_ring_7d"] == 3
    assert row["hotspots_zone_1d"] == 0
    assert features.loc[("a", day + pd.Timedelta(days=1)), "hotspots_zone_7d"] == 0
