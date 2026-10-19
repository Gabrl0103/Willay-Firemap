"""Phase 3: trains and evaluates the models with a temporal split.

    python -m willay_ml.train      # -> models/, data/processed/evaluation.json, docs/ml/*.png

Split by date, never random: train until 2023-12-31, validation 2024, test 2025-01-01 onwards.
Models (label: hotspot <= 25 km in the next 72 h):
  a) baseline: logistic regression on dry days + zone propensity only;
  b) the current weighted model (0.5/0.3/0.2) recomputed on the same days (score / 100);
  c) logistic regression on every feature;
  d) HistGradientBoostingClassifier on every feature.
Class imbalance: balanced class weights while fitting. Calibration: each model's scores are
mapped to probabilities with a calibrator fitted on the validation year only (Platt for the linear
models, isotonic for boosting and for the weighted score). The test period is used once.
"""

from __future__ import annotations

import json
import subprocess
from datetime import UTC, datetime

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score
from sklearn.pipeline import make_pipeline
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.preprocessing import StandardScaler

from .config import ML_DIR, PROCESSED_DIR, RADIUS_KM, REPO_DIR
from .dataset import COUNTS_PARQUET
from .features import (
    FEATURE_COLUMNS,
    FEATURES_PARQUET,
    HOTSPOT_FEATURES,
    SEASON_FEATURES,
    WEATHER_FEATURES,
    ZONE_FEATURES,
)
from .fire_events import load_fire_events
from .metrics import calibration_table, evaluate
from .power import POWER_PARQUET
from .weighted_model import weighted_model_scores

MODEL_VERSION = "1.0.0"
LABEL = f"label_r{RADIUS_KM}"
TRAIN_END = pd.Timestamp("2023-12-31")
VALIDATION_END = pd.Timestamp("2024-12-31")
BASELINE_FEATURES = ["dry_days", "zone_hotspot_days_per_year"]
# Counts are heavy-tailed: log1p before the linear model.
LOG_FEATURES = HOTSPOT_FEATURES + ["zone_hotspot_days_per_year"]
HGB_GRID = [
    {"learning_rate": lr, "max_leaf_nodes": leaves, "min_samples_leaf": 100}
    for lr in (0.05, 0.1)
    for leaves in (15, 31)
]

# Ablation: logistic regression with groups of features removed (what does each group add?).
ABLATION_SETS = {
    "all": FEATURE_COLUMNS,
    "without_weather": HOTSPOT_FEATURES + SEASON_FEATURES + ZONE_FEATURES,
    "without_hotspots": WEATHER_FEATURES + SEASON_FEATURES + ZONE_FEATURES,
    "without_zone_propensity": WEATHER_FEATURES + HOTSPOT_FEATURES + SEASON_FEATURES,
    "season_and_zone_only": SEASON_FEATURES + ZONE_FEATURES,
}

MODELS_DIR = ML_DIR / "models"
FIGURES_DIR = REPO_DIR / "docs" / "ml"
EVALUATION_JSON = PROCESSED_DIR / "evaluation.json"


def split(table: pd.DataFrame):
    train = table[table["date"] <= TRAIN_END]
    validation = table[(table["date"] > TRAIN_END) & (table["date"] <= VALIDATION_END)]
    test = table[table["date"] > VALIDATION_END]
    return train, validation, test


class LogColumns(BaseEstimator, TransformerMixin):
    """log1p of the count columns (by position), so the model can be pickled and exported."""

    def __init__(self, indexes: tuple[int, ...] = ()) -> None:
        self.indexes = indexes

    def fit(self, values, labels=None):
        return self

    def transform(self, values):
        values = np.array(values, dtype=float, copy=True)
        index = list(self.indexes)
        values[:, index] = np.log1p(np.clip(values[:, index], 0, None))
        return values


def logistic(columns: list[str]):
    indexes = tuple(i for i, column in enumerate(columns) if column in LOG_FEATURES)
    return make_pipeline(
        LogColumns(indexes),
        StandardScaler(),
        LogisticRegression(class_weight="balanced", max_iter=2000, C=1.0),
    )


class Calibrated:
    """A fitted scorer plus a calibrator fitted on validation scores."""

    def __init__(self, score, method: str) -> None:
        self.score = score  # rows -> raw score
        self.method = method
        self.calibrator = None

    def fit(self, validation: pd.DataFrame) -> "Calibrated":
        raw, labels = self.score(validation), validation[LABEL].to_numpy()
        if self.method == "isotonic":
            self.calibrator = IsotonicRegression(out_of_bounds="clip").fit(raw, labels)
        else:
            self.calibrator = LogisticRegression().fit(raw.reshape(-1, 1), labels)
        return self

    def predict(self, rows: pd.DataFrame) -> np.ndarray:
        raw = self.score(rows)
        if self.method == "isotonic":
            return self.calibrator.predict(raw)
        return self.calibrator.predict_proba(raw.reshape(-1, 1))[:, 1]


def fit_hgb(train, validation):
    """Small grid chosen by validation PR-AUC."""
    best, best_ap, best_params = None, -1.0, None
    for params in HGB_GRID:
        model = HistGradientBoostingClassifier(
            max_iter=400, early_stopping=True, validation_fraction=0.15, n_iter_no_change=30,
            class_weight="balanced", l2_regularization=1.0, random_state=0, **params,
        ).fit(train[FEATURE_COLUMNS], train[LABEL])
        ap = average_precision_score(
            validation[LABEL], model.predict_proba(validation[FEATURE_COLUMNS])[:, 1]
        )
        print(f"  HGB {params}: validation PR-AUC {ap:.4f} ({model.n_iter_} iterations)")
        if ap > best_ap:
            best, best_ap, best_params = model, ap, params
    return best, best_params


def ablation(train, test) -> dict[str, dict]:
    """Uncalibrated logistic regressions: rankings only (ROC/PR-AUC, precision@k)."""
    results = {}
    for name, columns in ABLATION_SETS.items():
        model = logistic(columns).fit(train[columns], train[LABEL])
        metrics = evaluate(test["date"], test[LABEL], model.predict_proba(test[columns])[:, 1])
        results[name] = {key: metrics[key] for key in
                         ("roc_auc", "pr_auc", "precision_at_5", "precision_at_10")}
    return results


def git_commit() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=REPO_DIR,
                                       text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def plot_calibration(test: pd.DataFrame, predictions: dict[str, np.ndarray]) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    figure, axis = plt.subplots(figsize=(5.5, 5))
    axis.plot([0, 1], [0, 1], linestyle=":", color="#536064", label="Calibración perfecta")
    markers = {"baseline": "s", "weighted_model": "^", "logistic_regression": "o",
               "gradient_boosting": "D"}
    for name, probabilities in predictions.items():
        observed, predicted = calibration_curve(test[LABEL], probabilities, n_bins=10,
                                                strategy="quantile")
        axis.plot(predicted, observed, marker=markers[name], label=name)
    axis.set_xlabel("Probabilidad predicha")
    axis.set_ylabel("Frecuencia observada (test)")
    axis.set_title(f"Calibración en test (foco a ≤{RADIUS_KM} km en 72 h)")
    axis.legend(fontsize=8)
    figure.tight_layout()
    figure.savefig(FIGURES_DIR / "calibration.png", dpi=130)
    plt.close(figure)


def main() -> None:
    table = pd.read_parquet(FEATURES_PARQUET).dropna(subset=[LABEL, *FEATURE_COLUMNS])
    table[LABEL] = table[LABEL].astype(int)
    weather = pd.read_parquet(POWER_PARQUET)
    counts = pd.read_parquet(COUNTS_PARQUET)
    table["weighted_score"] = weighted_model_scores(table, weather, counts, load_fire_events())
    train, validation, test = split(table)
    print(f"train {len(train)} ({train['date'].min():%Y-%m-%d}..{train['date'].max():%Y-%m-%d}), "
          f"validation {len(validation)}, test {len(test)} "
          f"({test['date'].min():%Y-%m-%d}..{test['date'].max():%Y-%m-%d})")

    baseline = logistic(BASELINE_FEATURES).fit(train[BASELINE_FEATURES], train[LABEL])
    linear = logistic(FEATURE_COLUMNS).fit(train[FEATURE_COLUMNS], train[LABEL])
    boosting, boosting_params = fit_hgb(train, validation)

    models = {
        "baseline": Calibrated(
            lambda rows: baseline.decision_function(rows[BASELINE_FEATURES]), "platt"),
        "weighted_model": Calibrated(lambda rows: rows["weighted_score"].to_numpy() / 100,
                                     "isotonic"),
        "logistic_regression": Calibrated(
            lambda rows: linear.decision_function(rows[FEATURE_COLUMNS]), "platt"),
        "gradient_boosting": Calibrated(
            lambda rows: boosting.predict_proba(rows[FEATURE_COLUMNS])[:, 1], "isotonic"),
    }
    results, predictions = {}, {}
    for name, model in models.items():
        model.fit(validation)
        predictions[name] = model.predict(test)
        results[name] = {
            "validation": evaluate(validation["date"], validation[LABEL], model.predict(validation)),
            "test": evaluate(test["date"], test[LABEL], predictions[name]),
            "calibration_test": calibration_table(test[LABEL].to_numpy(),
                                                  predictions[name]).to_dict("records"),
        }
        # Uncalibrated weighted score (what the app shows today / 100), for reference.
    results["weighted_model"]["test_raw_score"] = evaluate(
        test["date"], test[LABEL], test["weighted_score"].to_numpy() / 100)

    results["ablation_logistic_test"] = ablation(train, test)
    linear_coefficients = dict(zip(FEATURE_COLUMNS, linear[-1].coef_[0].round(4).tolist()))
    importance = permutation_importance(
        boosting, test[FEATURE_COLUMNS], test[LABEL], scoring="average_precision",
        n_repeats=3, random_state=0, n_jobs=1,
    )
    boosting_importance = dict(sorted(
        zip(FEATURE_COLUMNS, importance.importances_mean.round(4).tolist()),
        key=lambda item: -item[1],
    ))

    plot_calibration(test, predictions)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": linear, "calibrator": models["logistic_regression"].calibrator,
                 "features": FEATURE_COLUMNS}, MODELS_DIR / "logistic_regression.joblib")
    joblib.dump({"model": boosting, "calibrator": models["gradient_boosting"].calibrator,
                 "features": FEATURE_COLUMNS}, MODELS_DIR / "gradient_boosting.joblib")
    metadata = {
        "version": MODEL_VERSION,
        "trained_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "git_commit": git_commit(),
        "label": f"VIIRS hotspot <= {RADIUS_KM} km of the municipal seat in the next 72 h",
        "features": FEATURE_COLUMNS,
        "data": {
            "train": [f"{train['date'].min():%Y-%m-%d}", f"{train['date'].max():%Y-%m-%d}"],
            "validation": [f"{validation['date'].min():%Y-%m-%d}",
                           f"{validation['date'].max():%Y-%m-%d}"],
            "test": [f"{test['date'].min():%Y-%m-%d}", f"{test['date'].max():%Y-%m-%d}"],
            "rows": {"train": len(train), "validation": len(validation), "test": len(test)},
            "weather": "NASA POWER daily (MERRA-2, AG community)",
            "hotspots": "NASA FIRMS VIIRS SNPP + NOAA-20",
        },
        "gradient_boosting_params": boosting_params,
        "metrics": {name: {split: values for split, values in result.items()
                           if split in ("validation", "test", "test_raw_score")}
                    for name, result in results.items() if name in models},
        "ablation_logistic_test": results["ablation_logistic_test"],
        "logistic_regression_coefficients_standardized": linear_coefficients,
        "gradient_boosting_permutation_importance_test_pr_auc": boosting_importance,
    }
    (MODELS_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    EVALUATION_JSON.write_text(json.dumps(results, indent=2, default=str), encoding="utf-8")

    columns = ["roc_auc", "pr_auc", "brier", "precision_at_5", "recall_at_5", "precision_at_10",
               "recall_at_10"]
    summary = pd.DataFrame({name: results[name]["test"] for name in models}).T
    summary.loc["weighted_model (raw score/100)"] = results["weighted_model"]["test_raw_score"]
    print(f"\nTest ({test['date'].min():%Y-%m-%d}..{test['date'].max():%Y-%m-%d}), "
          f"positive rate {test[LABEL].mean():.3%}")
    print(summary[columns].round(4).to_string())
    print("\nAblation (logistic regression, test):")
    print(pd.DataFrame(results["ablation_logistic_test"]).T.round(4).to_string())
    print("\nPermutation importance (gradient boosting, test PR-AUC drop):")
    for feature, value in list(boosting_importance.items())[:10]:
        print(f"  {feature:30s} {value:.4f}")
    print("\nLogistic regression coefficients (standardized):")
    for feature, value in sorted(linear_coefficients.items(), key=lambda i: -abs(i[1]))[:10]:
        print(f"  {feature:30s} {value:+.4f}")


if __name__ == "__main__":
    main()
