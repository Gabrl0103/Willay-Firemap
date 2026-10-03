"""Fire events scraped by the backend (UNGRD 2019-2022 + news 2026) from the `fire_event` table.

    python -m willay_ml.fire_events     # -> data/fire_events.csv (needs DATABASE_URL)

Used to recompute the current weighted model (its history factor) on the same test period.
"""

from __future__ import annotations

import pandas as pd

from .config import DATA_DIR, require_env

FIRE_EVENTS_CSV = DATA_DIR / "fire_events.csv"


def export_fire_events() -> pd.DataFrame:
    import psycopg

    query = "SELECT zone_id, event_date, source, hectares FROM fire_event ORDER BY event_date"
    with psycopg.connect(require_env("DATABASE_URL")) as connection, connection.cursor() as cursor:
        cursor.execute(query)
        events = pd.DataFrame(cursor.fetchall(), columns=["zone_id", "event_date", "source", "hectares"])
    events.to_csv(FIRE_EVENTS_CSV, index=False)
    print(f"{len(events)} fire events -> {FIRE_EVENTS_CSV}")
    return events


def load_fire_events() -> pd.DataFrame:
    if not FIRE_EVENTS_CSV.exists():
        return export_fire_events()
    return pd.read_csv(FIRE_EVENTS_CSV, parse_dates=["event_date"])


if __name__ == "__main__":
    export_fire_events()
