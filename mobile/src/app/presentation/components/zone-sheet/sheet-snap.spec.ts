import { clampOffset, MID_OFFSET_RATIO, resolveSnap, snapOffset } from './sheet-snap';

describe('sheet snap', () => {
  const height = 850; // 85 % of a 1000 px map area
  const mid = snapOffset('mid', height);

  it('shows 45 % of the map area at mid and 85 % when expanded', () => {
    expect(height - mid).toBeCloseTo(450);
    expect(snapOffset('full', height)).toBe(0);
    expect(snapOffset('closed', height)).toBe(height);
    expect(MID_OFFSET_RATIO).toBeCloseTo(0.4706, 3);
  });

  it('keeps the drag inside the sheet', () => {
    expect(clampOffset(-40, height)).toBe(0);
    expect(clampOffset(900, height)).toBe(height);
    expect(clampOffset(120, height)).toBe(120);
  });

  it('settles on the nearest position after a slow drag', () => {
    expect(resolveSnap(100, 0, height)).toBe('full');
    expect(resolveSnap(mid - 60, 0.1, height)).toBe('mid');
    expect(resolveSnap(mid + 100, 0, height)).toBe('mid');
    expect(resolveSnap(height - 100, 0, height)).toBe('closed');
  });

  it('expands on a flick up, even from low positions', () => {
    expect(resolveSnap(mid + 50, -0.8, height)).toBe('full');
  });

  it('goes to mid on a flick down from above mid, and closes from below it', () => {
    expect(resolveSnap(60, 0.9, height)).toBe('mid');
    expect(resolveSnap(mid + 20, 0.9, height)).toBe('closed');
  });
});
