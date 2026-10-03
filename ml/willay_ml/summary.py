"""Summary of the phase 1 data: hotspots, MODIS vs VIIRS, labels, class balance, missing values.

    python -m willay_ml.summary      # prints Markdown and writes data/processed/summary.md
"""

from __future__ import annotations

import sys

import numpy as np
import pandas as pd

from .config import DATASET_START, HORIZON_DAYS, PROCESSED_DIR, RADIUS_KM, SENSITIVITY_RADII_KM
from .dataset import DATASET_PARQUET, daily_counts, future_any, label_hotspots
from .firms import HOTSPOTS_PARQUET
from .geo import distance_matrix_km
from .power import PARAMETERS
from .zones import load_zones

SUMMARY_MD = PROCESSED_DIR / "summary.md"
MATCH_KM = 2.0  # a MODIS pixel is 1 km; VIIRS 375 m


def pct(part: float, whole: float) -> str:
    return f"{100 * part / whole:.2f} %" if whole else "n/a"


def table(frame: pd.DataFrame) -> str:
    header = "| " + " | ".join(map(str, frame.columns)) + " |"
    rule = "|" + "|".join("---" for _ in frame.columns) + "|"
    rows = ["| " + " | ".join(map(str, row)) + " |" for row in frame.itertuples(index=False)]
    return "\n".join([header, rule, *rows])


def hotspot_section(hotspots: pd.DataFrame, labeled: pd.DataFrame) -> list[str]:
    since = hotspots[hotspots["local_date"] >= pd.Timestamp(DATASET_START)]
    by_source = (
        since.groupby("source")
        .agg(
            hotspots=("latitude", "size"),
            first=("local_date", "min"),
            last=("local_date", "max"),
            volcano=("type", lambda t: int((t == 1).sum())),
            static_or_offshore=("type", lambda t: int(t.isin([2, 3]).sum())),
        )
        .reset_index()
    )
    by_source["first"] = by_source["first"].dt.strftime("%Y-%m-%d")
    by_source["last"] = by_source["last"].dt.strftime("%Y-%m-%d")
    viirs = since[since["sensor"].str.startswith("viirs")]
    confidence = viirs["confidence"].value_counts(normalize=True).mul(100).round(1)
    labeled_since = labeled[labeled["local_date"] >= pd.Timestamp(DATASET_START)]
    per_year = (
        labeled_since.groupby(labeled_since["local_date"].dt.year)
        .size()
        .rename("viirs_hotspots_used")
        .reset_index()
        .rename(columns={"local_date": "year"})
    )
    return [
        "## Focos de calor (NASA FIRMS, bbox de Nariño)",
        table(by_source),
        "",
        f"VIIRS por confianza (%): {confidence.to_dict()}",
        "",
        f"Focos VIIRS usados para etiquetas (sin volcanes/fuentes estáticas): {len(labeled_since)}",
        "",
        table(per_year),
    ]


def modis_section(hotspots: pd.DataFrame, labeled: pd.DataFrame, zones, days) -> list[str]:
    """Does MODIS add fires that VIIRS misses?"""
    modis = hotspots[
        (hotspots["sensor"] == "modis")
        & (hotspots["local_date"] >= pd.Timestamp(DATASET_START))
        & ~hotspots["type"].isin([1, 2, 3])
    ].reset_index(drop=True)
    if modis.empty:
        return ["## MODIS vs VIIRS", "Sin datos MODIS."]
    matched = np.zeros(len(modis), dtype=bool)
    viirs_by_day = {day: group for day, group in labeled.groupby("local_date")}
    for day, group in modis.groupby("local_date"):
        candidates = pd.concat(
            [viirs_by_day.get(day + pd.Timedelta(days=offset)) for offset in (-1, 0, 1)
             if day + pd.Timedelta(days=offset) in viirs_by_day] or [labeled.iloc[:0]]
        )
        if candidates.empty:
            continue
        distances = distance_matrix_km(
            group[["latitude", "longitude"]].to_numpy(),
            candidates[["latitude", "longitude"]].to_numpy(),
        )
        matched[group.index] = (distances <= MATCH_KM).any(axis=1)

    viirs_counts = daily_counts(zones, labeled, RADIUS_KM, days)
    modis_counts = daily_counts(zones, modis, RADIUS_KM, days)
    viirs_label = future_any(viirs_counts["count"], viirs_counts["zone_id"], HORIZON_DAYS)
    modis_label = future_any(modis_counts["count"], modis_counts["zone_id"], HORIZON_DAYS)
    known = viirs_label.notna() & modis_label.notna() & (viirs_counts["date"] >= pd.Timestamp(DATASET_START))
    modis_only = int(((modis_label == 1) & (viirs_label == 0) & known).sum())
    viirs_positive = int(((viirs_label == 1) & known).sum())
    return [
        "## MODIS vs VIIRS (desde 2015, sin volcanes)",
        f"- Focos MODIS: {len(modis)}; con un foco VIIRS a <= {MATCH_KM:g} km y +-1 día: "
        f"{matched.sum()} ({pct(matched.sum(), len(modis))}).",
        f"- Días-zona positivos (r = {RADIUS_KM} km) con VIIRS: {viirs_positive}. "
        f"Positivos que agregaría MODIS (MODIS sí, VIIRS no): {modis_only} "
        f"({pct(modis_only, viirs_positive)} de los positivos VIIRS).",
    ]


def dataset_section(dataset: pd.DataFrame) -> list[str]:
    radii = sorted(set(SENSITIVITY_RADII_KM) | {RADIUS_KM})
    balance = pd.DataFrame(
        {
            "radio_km": radii,
            "positivos": [int(dataset[f"label_r{r}"].sum()) for r in radii],
            "porcentaje": [pct(dataset[f"label_r{r}"].sum(), len(dataset)) for r in radii],
            "zonas_con_algún_positivo": [
                int(dataset.groupby("zone_id")[f"label_r{r}"].max().sum()) for r in radii
            ],
        }
    )
    label = f"label_r{RADIUS_KM}"
    yearly = (
        dataset.groupby(dataset["date"].dt.year)[label]
        .agg(["size", "sum", "mean"])
        .reset_index()
        .rename(columns={"date": "año", "size": "días_zona", "sum": "positivos"})
    )
    yearly["mean"] = (yearly["mean"] * 100).round(2).astype(str) + " %"
    yearly = yearly.rename(columns={"mean": "porcentaje"})
    monthly = (dataset.groupby(dataset["date"].dt.month)[label].mean() * 100).round(1)
    per_zone = dataset.groupby("zone_id")[label].mean().mul(100).sort_values()
    top = ", ".join(f"{zone} {rate:.1f} %" for zone, rate in per_zone.tail(5)[::-1].items())
    bottom = ", ".join(f"{zone} {rate:.1f} %" for zone, rate in per_zone.head(5).items())

    weather_columns = [column for column in PARAMETERS.values() if column in dataset]
    missing = pd.DataFrame(
        {
            "columna": weather_columns,
            "faltantes": [int(dataset[c].isna().sum()) for c in weather_columns],
            "porcentaje": [pct(dataset[c].isna().sum(), len(dataset)) for c in weather_columns],
        }
    )
    no_weather = dataset[weather_columns].isna().all(axis=1) if weather_columns else None
    weather_years = (
        sorted(int(y) for y in dataset.loc[~no_weather, "date"].dt.year.unique())
        if no_weather is not None
        else []
    )
    return [
        "## Dataset diario (zona x día)",
        f"- Filas: {len(dataset)} = {dataset['zone_id'].nunique()} zonas x "
        f"{dataset['date'].nunique()} días.",
        f"- Rango: {dataset['date'].min():%Y-%m-%d} a {dataset['date'].max():%Y-%m-%d} "
        f"(el último día necesita {HORIZON_DAYS} días de focos después).",
        f"- Etiqueta: al menos un foco VIIRS a <= R km de la cabecera en d+1..d+{HORIZON_DAYS}.",
        "",
        "### Desbalance de clases por radio",
        table(balance),
        "",
        f"### Por año (r = {RADIUS_KM} km)",
        table(yearly),
        "",
        f"Porcentaje positivo por mes (r = {RADIUS_KM} km): {monthly.to_dict()}",
        "",
        f"Zonas con más positivos: {top}. Con menos: {bottom}.",
        "",
        "### Valores faltantes (clima)",
        table(missing) if weather_columns else "Sin clima todavía.",
        "",
        f"Días-zona sin ningún dato de clima: {int(no_weather.sum()) if no_weather is not None else len(dataset)} "
        f"(años con clima: {weather_years}).",
    ]


def summarize() -> str:
    zones = load_zones().sort_values("id").reset_index(drop=True)
    hotspots = pd.read_parquet(HOTSPOTS_PARQUET)
    dataset = pd.read_parquet(DATASET_PARQUET)
    labeled = label_hotspots(hotspots)
    days = pd.date_range(dataset["date"].min() - pd.Timedelta(days=30),
                         dataset["date"].max() + pd.Timedelta(days=HORIZON_DAYS))
    lines = [
        "# Willay ML — resumen de datos (fase 1)",
        "",
        *dataset_section(dataset),
        "",
        *hotspot_section(hotspots, labeled),
        "",
        *modis_section(hotspots, labeled, zones, days),
        "",
    ]
    text = "\n".join(lines)
    SUMMARY_MD.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY_MD.write_text(text, encoding="utf-8")
    return text


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(summarize())
