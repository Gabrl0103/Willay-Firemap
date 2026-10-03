"""Great-circle distances (same haversine formula as backend/src/domain/service/geo.ts)."""

from __future__ import annotations

import numpy as np

EARTH_RADIUS_KM = 6371.0


def distance_matrix_km(points_a: np.ndarray, points_b: np.ndarray) -> np.ndarray:
    """Distances between every (lat, lon) row of points_a and every row of points_b."""
    lat_a, lon_a = np.radians(points_a[:, :1]), np.radians(points_a[:, 1:2])
    lat_b, lon_b = np.radians(points_b[:, 0]), np.radians(points_b[:, 1])
    a = (
        np.sin((lat_b - lat_a) / 2) ** 2
        + np.cos(lat_a) * np.cos(lat_b) * np.sin((lon_b - lon_a) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def within_km_of_any(
    points: np.ndarray, references: np.ndarray, radius_km: float, batch: int = 2000
) -> np.ndarray:
    """Boolean mask: which points are within radius_km of at least one reference point."""
    mask = np.zeros(len(points), dtype=bool)
    if len(points) == 0 or len(references) == 0:
        return mask
    unique_refs = np.unique(np.round(references, 4), axis=0)
    for start in range(0, len(points), batch):
        block = distance_matrix_km(points[start : start + batch], unique_refs)
        mask[start : start + batch] = (block <= radius_km).any(axis=1)
    return mask
