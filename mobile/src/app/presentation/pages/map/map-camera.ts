import type { LngLatBoundsLike } from 'maplibre-gl';
import type { MapProjection } from './map-style';

/** Extent of the 64 municipal polygons (DANE MGN 2025), rounded out a little. */
export const NARINO_BOUNDS: [[number, number], [number, number]] = [[-79.05, 0.33], [-76.8, 2.72]];
/**
 * How far the camera may go once over Nariño: the department plus a margin, so a seat on the edge
 * (Tumaco, Ipiales) can still sit above the bottom sheet with the map tilted.
 */
export const MAX_BOUNDS: LngLatBoundsLike = [[-80.8, -0.9], [-75.0, 4.0]];
export const MIN_ZOOM_OVER_NARINO = 6;
export const MAX_ZOOM = 14;
/** Tilt of the view over Nariño and of the flight to a seat. */
export const PITCH = 50;
/** Zoom of the flight to a seat: names show from 10 (zone-marker.ts). */
export const ZONE_ZOOM = 10;

/** Opening view: the whole globe, South America in front, slightly east of Nariño so it spins into view. */
export const GLOBE_START = { center: [-55, 2] as [number, number], zoom: 1.4, pitch: 0, bearing: 0 };
/** The globe turns west this many degrees per second... */
export const SPIN_DEGREES_PER_SECOND = 10;
/** ...for this long, then flies to Nariño. */
export const SPIN_MS = 2000;
export const FLY_MS = 2600;
/** Flight to a seat (tap, search, coming from Inicio). */
export const ZONE_FLY_MS = 1200;

/**
 * How the map opens:
 * - 'zone': a zone is already selected (from Inicio): straight to its seat, no spin.
 * - 'spin-fly': the globe turns and then flies to Nariño (first visit of the session).
 * - 'jump': already over Nariño, without animation (later visits, reduced motion, or the flat map).
 */
export type IntroPlan = 'zone' | 'spin-fly' | 'jump';

export function introPlan(options: {
  readonly hasSelection: boolean;
  readonly reducedMotion: boolean;
  readonly firstVisit: boolean;
  readonly projection: MapProjection;
}): IntroPlan {
  if (options.hasSelection) return 'zone';
  if (options.reducedMotion || !options.firstVisit || options.projection === 'mercator') return 'jump';
  return 'spin-fly';
}

/** Center of the opening view after `elapsedMs` of spin (the globe turns west). */
export function spinCenter(elapsedMs: number): [number, number] {
  const [longitude, latitude] = GLOBE_START.center;
  return [longitude - (SPIN_DEGREES_PER_SECOND * elapsedMs) / 1000, latitude];
}

/** Below this the globe is not smooth enough: the map switches to the flat projection. */
export const MIN_GLOBE_FPS = 30;
/** Frames needed before judging (about one second of animation). */
export const MIN_FPS_SAMPLES = 30;

/**
 * Frames per second of an animation from the timestamps of its frames (requestAnimationFrame).
 * Uses the median gap, so one slow frame (a tile decoding) does not decide alone.
 */
export function measureFps(frameTimes: readonly number[]): number | null {
  if (frameTimes.length < MIN_FPS_SAMPLES) return null;
  const gaps = frameTimes.slice(1).map((time, i) => time - frameTimes[i]!).sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)]!;
  return median > 0 ? 1000 / median : null;
}

export function shouldUseFlatMap(fps: number | null): boolean {
  return fps !== null && fps < MIN_GLOBE_FPS;
}

/** MapLibre draws with WebGL in both projections: without it there is no map at all. */
export function hasWebGL(doc: Document): boolean {
  try {
    const canvas = doc.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function prefersReducedMotion(win: Window): boolean {
  return win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
