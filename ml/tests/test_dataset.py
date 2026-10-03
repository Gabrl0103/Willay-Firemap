import numpy as np
import pandas as pd

from willay_ml.dataset import daily_counts, future_any, label_hotspots
from willay_ml.geo import distance_matrix_km, within_km_of_any

ZONES = pd.DataFrame({"id": ["a", "b"], "latitude": [1.0, 2.0], "longitude": [-77.0, -78.0]})
DAYS = pd.date_range("2020-01-01", "2020-01-10")


def hotspot(lat, lon, day, sensor="viirs_snpp", processing="SP", type_=0):
    return {
        "sensor": sensor,
        "processing": processing,
        "latitude": lat,
        "longitude": lon,
        "local_date": pd.Timestamp(day),
        "type": type_,
    }


def test_distance_matches_backend_haversine():
    # Pasto -> Ipiales, same formula as backend geo.ts.
    km = distance_matrix_km(np.array([[1.212352, -77.278795]]), np.array([[0.830181, -77.644372]]))
    assert abs(km[0, 0] - 58.6) < 0.5


def test_daily_counts_uses_radius_and_fills_zeros():
    hotspots = pd.DataFrame(
        [hotspot(1.1, -77.0, "2020-01-05"), hotspot(1.3, -77.0, "2020-01-05")]
    )  # ~11 km and ~33 km from zone a
    counts = daily_counts(ZONES, hotspots, 25, DAYS)
    assert len(counts) == len(ZONES) * len(DAYS)
    by_key = counts.set_index(["zone_id", "date"])["count"]
    assert by_key[("a", pd.Timestamp("2020-01-05"))] == 1
    assert by_key[("a", pd.Timestamp("2020-01-04"))] == 0
    assert by_key[("b", pd.Timestamp("2020-01-05"))] == 0


def test_label_looks_only_at_the_next_three_days():
    hotspots = pd.DataFrame([hotspot(1.0, -77.0, "2020-01-05")])
    counts = daily_counts(ZONES, hotspots, 25, DAYS)
    counts["label"] = future_any(counts["count"], counts["zone_id"], 3)
    labels = counts[counts["zone_id"] == "a"].set_index("date")["label"]
    # The fire on day 5 is in the label of days 2, 3 and 4 only; never in day 5 itself.
    assert labels["2020-01-01"] == 0
    assert labels["2020-01-02"] == 1
    assert labels["2020-01-04"] == 1
    assert labels["2020-01-05"] == 0
    # The last 3 days have an unknown future: NaN, not 0.
    assert labels["2020-01-08":].isna().all()
    # Zone b never gets the label of zone a (no leakage across zones in the shift).
    assert (counts[counts["zone_id"] == "b"]["label"].dropna() == 0).all()


def test_label_hotspots_drops_static_sources_and_modis():
    hotspots = pd.DataFrame(
        [
            hotspot(1.22, -77.36, "2020-01-01", type_=1),  # volcano (archive)
            hotspot(1.2201, -77.3601, "2020-01-02", processing="NRT", type_=pd.NA),  # same spot
            hotspot(1.5, -77.0, "2020-01-02", processing="NRT", type_=pd.NA),
            hotspot(1.5, -77.0, "2020-01-02", sensor="modis"),
            hotspot(1.6, -77.0, "2020-01-03", sensor="viirs_noaa20"),
        ]
    )
    hotspots["type"] = hotspots["type"].astype("Int8")
    kept = label_hotspots(hotspots)
    assert sorted(kept["latitude"]) == [1.5, 1.6]
    assert set(kept["sensor"]) == {"viirs_snpp", "viirs_noaa20"}


def test_within_km_of_any_handles_empty_references():
    points = np.array([[1.0, -77.0]])
    assert not within_km_of_any(points, np.empty((0, 2)), 1).any()
    assert within_km_of_any(points, np.array([[1.005, -77.0]]), 1).all()


def test_days_without_downloaded_chunks_are_reported(monkeypatch):
    import willay_ml.dataset as dataset

    snpp = pd.date_range("2018-03-25", "2018-04-10")
    noaa20 = pd.date_range("2018-04-01", "2018-04-05")
    monkeypatch.setattr(
        dataset, "covered_days", lambda sensor: snpp if sensor == "viirs_snpp" else noaa20
    )
    missing = dataset.missing_hotspot_days(pd.date_range("2018-03-28", "2018-04-08"))
    # Before NOAA-20 existed only SNPP is required; after, both (local day d needs UTC d and d+1).
    assert pd.Timestamp("2018-03-31") not in missing
    assert pd.Timestamp("2018-04-04") not in missing
    assert list(missing.strftime("%m-%d")) == ["04-05", "04-06", "04-07", "04-08"]
