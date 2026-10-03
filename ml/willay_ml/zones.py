"""Zones (the 64 municipalities of Nariño) with the coordinates of their municipal seat.

Source of truth: the `zone` table (DATABASE_URL). Without a database, the same data is read from
backend/src/infrastructure/persistence/narinoMunicipalities.ts (what `npm run db:zones` loads).

    python -m willay_ml.zones
"""

from __future__ import annotations

import re

import pandas as pd

from .config import MUNICIPALITIES_TS, ZONES_CSV, optional_env

COLUMNS = ["id", "name", "divipola", "latitude", "longitude"]

_TS_ROW = re.compile(
    r"\{\s*divipola:\s*(?P<divipola>\d+),\s*id:\s*'(?P<id>[^']+)',\s*name:\s*'(?P<name>[^']+)',"
    r"\s*latitude:\s*(?P<latitude>-?[\d.]+),\s*longitude:\s*(?P<longitude>-?[\d.]+)"
)


def parse_municipalities_ts(source: str) -> pd.DataFrame:
    rows = [match.groupdict() for match in _TS_ROW.finditer(source)]
    frame = pd.DataFrame(rows, columns=COLUMNS)
    return frame.astype({"divipola": int, "latitude": float, "longitude": float})


def read_zones_from_database(database_url: str) -> pd.DataFrame:
    import psycopg

    query = """
        SELECT id, name, divipola,
               ST_Y(centroid::geometry) AS latitude, ST_X(centroid::geometry) AS longitude
        FROM zone ORDER BY divipola, id
    """
    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        cursor.execute(query)
        return pd.DataFrame(cursor.fetchall(), columns=COLUMNS)


def export_zones() -> pd.DataFrame:
    database_url = optional_env("DATABASE_URL")
    if database_url:
        zones, origin = read_zones_from_database(database_url), "zone table (DATABASE_URL)"
    else:
        zones = parse_municipalities_ts(MUNICIPALITIES_TS.read_text(encoding="utf-8"))
        origin = MUNICIPALITIES_TS.name
    if zones.empty:
        raise SystemExit(f"No zones found in {origin}")
    ZONES_CSV.parent.mkdir(parents=True, exist_ok=True)
    zones.to_csv(ZONES_CSV, index=False)
    print(f"{len(zones)} zones from {origin} -> {ZONES_CSV}")
    return zones


def load_zones() -> pd.DataFrame:
    """Zones cached by `python -m willay_ml.zones`, exported on first use."""
    if not ZONES_CSV.exists():
        return export_zones()
    return pd.read_csv(ZONES_CSV)


if __name__ == "__main__":
    export_zones()
