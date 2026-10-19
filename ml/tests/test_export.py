import numpy as np
import pandas as pd

from willay_ml.export_backend import apply_weather_map, fit_weather_map
from willay_ml.export_backend import WEATHER_MAP


def open_meteo_and_power(days: int = 40):
    dates = pd.date_range("2024-01-01", periods=days)
    rng = np.random.default_rng(0)
    open_meteo = pd.DataFrame({"zone_id": "a", "date": dates})
    power = pd.DataFrame({"zone_id": "a", "date": dates})
    for column, (source, *_rest) in WEATHER_MAP.items():
        values = rng.uniform(1, 30, days)
        open_meteo[source] = values
        power[column] = 0.5 * values + 2  # an exact linear relation the fit must recover
    return open_meteo, power


def test_weather_map_recovers_a_linear_relation():
    open_meteo, power = open_meteo_and_power()
    mapping = fit_weather_map(open_meteo, power)
    assert set(mapping) == set(WEATHER_MAP)
    for rule in mapping.values():
        assert np.isclose(rule["slope"], 0.5)
        assert np.isclose(rule["intercept"], 2)


def test_weather_map_only_fits_on_the_mapping_year():
    open_meteo, power = open_meteo_and_power()
    later = open_meteo.assign(date=open_meteo["date"] + pd.DateOffset(years=1))
    noise = power.assign(date=later["date"], precipitation_mm=999.0)  # 2025 rows must be ignored
    mapping = fit_weather_map(pd.concat([open_meteo, later]), pd.concat([power, noise]))
    assert np.isclose(mapping["precipitation_mm"]["slope"], 0.5)


def test_apply_weather_map_clips_to_physical_bounds_and_fixes_soil_wetness():
    open_meteo, power = open_meteo_and_power(days=20)
    mapping = fit_weather_map(open_meteo, power)
    mapping["humidity_mean_pct"].update(slope=10.0, intercept=0.0)
    mapping["precipitation_mm"].update(slope=1.0, intercept=-100.0)
    mapped = apply_weather_map(open_meteo, mapping, soil_wetness=0.72)
    assert mapped["humidity_mean_pct"].max() <= 100
    assert mapped["precipitation_mm"].min() == 0
    assert (mapped["surface_soil_wetness"] == 0.72).all()
