import numpy as np
import pandas as pd

from willay_ml.metrics import evaluate, precision_recall_at_k
from willay_ml.weighted_model import fires_per_year_until, weighted_score


def test_weighted_score_matches_backend_cases():
    # Same cases as backend/test/riskScoring.test.ts.
    assert weighted_score(12, 85, 5, 0, 0, 0) <= 10
    assert weighted_score(35, 15, 45, 20, 6, 3) == 100
    with_hotspots = weighted_score(24, 40, 18, 9, 3, 0.5)
    without = weighted_score(24, 40, 18, 9, 0, 0.5)
    assert with_hotspots > without
    # History factor 0.258 fires/year -> 26 -> 0.2 * 26 = 5.2 points on top of the cold case.
    assert weighted_score(12, 85, 5, 0, 0, 0.258) - weighted_score(12, 85, 5, 0, 0, 0) == 5


def test_fires_per_year_counts_only_past_events():
    rows = pd.DataFrame({"zone_id": ["a", "a", "b"],
                         "date": pd.to_datetime(["2019-12-31", "2020-12-31", "2020-12-31"])})
    events = pd.DataFrame({"zone_id": ["a", "a"],
                           "event_date": pd.to_datetime(["2019-06-01", "2020-06-01"])})
    rates = fires_per_year_until(rows, events)
    assert np.isclose(rates[0], 1 / (365 / 365.25))
    assert np.isclose(rates[1], 2 / (731 / 365.25))
    assert rates[2] == 0


def test_precision_and_recall_at_k_per_day():
    dates = pd.Series(pd.to_datetime(["2025-01-01"] * 4 + ["2025-01-02"] * 4))
    labels = np.array([1, 0, 1, 0, 0, 0, 0, 0])
    scores = np.array([0.9, 0.8, 0.1, 0.0, 0.5, 0.4, 0.3, 0.2])
    precision, recall = precision_recall_at_k(dates, labels, scores, 2)
    assert precision == (0.5 + 0.0) / 2  # day 1: 1 of 2 flagged; day 2: none
    assert recall == 0.5  # only day 1 has positives: 1 of its 2 found


def test_evaluate_reports_every_metric():
    rng = np.random.default_rng(0)
    dates = pd.Series(np.repeat(pd.date_range("2025-01-01", periods=20), 10))
    labels = rng.integers(0, 2, 200)
    result = evaluate(dates, labels, rng.random(200))
    for key in ("roc_auc", "pr_auc", "brier", "precision_at_5", "recall_at_10"):
        assert 0 <= result[key] <= 1
