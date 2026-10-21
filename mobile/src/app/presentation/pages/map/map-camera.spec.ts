import {
  GLOBE_START, MAX_BOUNDS, MIN_FPS_SAMPLES, NARINO_BOUNDS, SPIN_DEGREES_PER_SECOND, hasWebGL, introPlan, measureFps,
  prefersReducedMotion, shouldUseFlatMap, spinCenter,
} from './map-camera';

const frames = (count: number, gapMs: number): number[] => Array.from({ length: count }, (_, i) => i * gapMs);

describe('map camera: opening', () => {
  const base = { hasSelection: false, reducedMotion: false, firstVisit: true, projection: 'globe' as const };

  it('spins the globe and flies to Nariño on the first visit', () => {
    expect(introPlan(base)).toBe('spin-fly');
  });

  it('jumps straight to Nariño with reduced motion, on later visits and on the flat map', () => {
    expect(introPlan({ ...base, reducedMotion: true })).toBe('jump');
    expect(introPlan({ ...base, firstVisit: false })).toBe('jump');
    expect(introPlan({ ...base, projection: 'mercator' })).toBe('jump');
  });

  it('goes to the selected zone when arriving from Inicio, without spinning', () => {
    expect(introPlan({ ...base, hasSelection: true })).toBe('zone');
    expect(introPlan({ ...base, hasSelection: true, reducedMotion: true })).toBe('zone');
  });

  it('turns the globe west from its start', () => {
    expect(spinCenter(0)).toEqual(GLOBE_START.center);
    expect(spinCenter(1000)).toEqual([GLOBE_START.center[0] - SPIN_DEGREES_PER_SECOND, GLOBE_START.center[1]]);
  });

  it('keeps Nariño inside the bounds the camera may move in', () => {
    const [[west, south], [east, north]] = MAX_BOUNDS as [[number, number], [number, number]];
    const [[nWest, nSouth], [nEast, nNorth]] = NARINO_BOUNDS;
    expect(west < nWest && south < nSouth && east > nEast && north > nNorth).toBe(true);
  });
});

describe('map camera: flat fallback', () => {
  it('waits for enough frames before judging', () => {
    expect(measureFps(frames(MIN_FPS_SAMPLES - 1, 16))).toBeNull();
    expect(shouldUseFlatMap(null)).toBe(false);
  });

  it('keeps the globe at 60 fps and drops it below 30', () => {
    expect(Math.round(measureFps(frames(60, 1000 / 60))!)).toBe(60);
    expect(shouldUseFlatMap(measureFps(frames(60, 1000 / 60)))).toBe(false);
    expect(shouldUseFlatMap(measureFps(frames(60, 50)))).toBe(true); // 20 fps
  });

  it('is not decided by one slow frame', () => {
    const times = frames(60, 16);
    times.splice(30, 0, times[29]! + 400);
    for (let i = 31; i < times.length; i++) times[i]! += 400;
    expect(shouldUseFlatMap(measureFps(times))).toBe(false);
  });

  it('detects WebGL and reduced motion', () => {
    const canvas = { getContext: (kind: string) => (kind === 'webgl' ? {} : null) };
    expect(hasWebGL({ createElement: () => canvas } as unknown as Document)).toBe(true);
    expect(hasWebGL({ createElement: () => ({ getContext: () => null }) } as unknown as Document)).toBe(false);
    const win = (matches: boolean) => ({ matchMedia: () => ({ matches }) }) as unknown as Window;
    expect(prefersReducedMotion(win(true))).toBe(true);
    expect(prefersReducedMotion(win(false))).toBe(false);
  });
});
