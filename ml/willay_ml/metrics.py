"""Evaluation metrics for daily zone rankings."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score

TOP_K = (5, 10)
CALIBRATION_BINS = (0, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0)


def precision_recall_at_k(dates: pd.Series, labels: np.ndarray, scores: np.ndarray, k: int):
    """Each day, the k zones with the highest score are flagged.

    precision@k: share of flagged zones that had hotspots (mean over days).
    recall@k: share of the day's positive zones that were flagged (mean over days with positives).
    """
    frame = pd.DataFrame({"date": dates.to_numpy(), "label": labels, "score": scores})
    # Random tie-breaking: a constant score must not look good by table order.
    frame["tie"] = np.random.default_rng(0).random(len(frame))
    frame = frame.sort_values(["date", "score", "tie"], ascending=[True, False, True])
    frame["rank"] = frame.groupby("date").cumcount()
    top = frame[frame["rank"] < k]
    hits = top.groupby("date")["label"].sum()
    positives = frame.groupby("date")["label"].sum()
    precision = (hits / k).mean()
    with_positives = positives > 0
    recall = (hits[with_positives] / positives[with_positives]).mean()
    return float(precision), float(recall)


def evaluate(dates: pd.Series, labels: np.ndarray, probabilities: np.ndarray) -> dict:
    labels = np.asarray(labels, dtype=int)
    result = {
        "rows": int(len(labels)),
        "positive_rate": float(labels.mean()),
        "roc_auc": float(roc_auc_score(labels, probabilities)),
        "pr_auc": float(average_precision_score(labels, probabilities)),
        "brier": float(brier_score_loss(labels, np.clip(probabilities, 0, 1))),
    }
    for k in TOP_K:
        precision, recall = precision_recall_at_k(dates, labels, probabilities, k)
        result[f"precision_at_{k}"] = precision
        result[f"recall_at_{k}"] = recall
    return result


def calibration_table(labels: np.ndarray, probabilities: np.ndarray) -> pd.DataFrame:
    bins = pd.cut(probabilities, CALIBRATION_BINS, include_lowest=True)
    frame = pd.DataFrame({"bin": bins, "label": labels, "p": probabilities})
    table = frame.groupby("bin", observed=True).agg(
        rows=("label", "size"), mean_predicted=("p", "mean"), observed_rate=("label", "mean")
    )
    return table.reset_index().assign(bin=lambda t: t["bin"].astype(str))
