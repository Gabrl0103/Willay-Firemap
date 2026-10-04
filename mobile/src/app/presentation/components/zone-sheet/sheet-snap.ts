/** Resting positions of the zone sheet. */
export type SheetSnap = 'mid' | 'full' | 'closed';

/** Height of the expanded sheet, as a share of the map area (the screen above the bottom nav). */
export const FULL_HEIGHT = 0.85;
/** Visible height of the sheet in its middle position, as a share of the map area. */
export const MID_HEIGHT = 0.45;
/** How far the sheet is pushed down at mid, as a share of its own height. */
export const MID_OFFSET_RATIO = 1 - MID_HEIGHT / FULL_HEIGHT;
/** A release faster than this (px/ms) is a flick: it moves one position in its direction. */
export const FLICK_VELOCITY = 0.5;

const SNAP_RATIOS: Record<SheetSnap, number> = { full: 0, mid: MID_OFFSET_RATIO, closed: 1 };

/** Downward offset (px) of the sheet at a resting position. */
export function snapOffset(snap: SheetSnap, sheetHeight: number): number {
  return SNAP_RATIOS[snap] * sheetHeight;
}

/** Keeps a dragged sheet between fully expanded (0) and fully hidden (its height). */
export function clampOffset(offset: number, sheetHeight: number): number {
  return Math.min(Math.max(offset, 0), sheetHeight);
}

/**
 * Where the sheet settles when the finger is lifted. A flick up expands it; a flick down goes to
 * mid from above mid and closes it from below. Otherwise it goes to the nearest position, so
 * closing needs a drag past half of the mid part.
 * @param offset downward offset (px) when released
 * @param velocity px/ms, positive when moving down
 */
export function resolveSnap(offset: number, velocity: number, sheetHeight: number): SheetSnap {
  if (velocity <= -FLICK_VELOCITY) return 'full';
  if (velocity >= FLICK_VELOCITY) return offset < snapOffset('mid', sheetHeight) ? 'mid' : 'closed';
  const snaps: SheetSnap[] = ['full', 'mid', 'closed'];
  const distance = (snap: SheetSnap): number => Math.abs(snapOffset(snap, sheetHeight) - offset);
  return snaps.reduce((best, snap) => (distance(snap) < distance(best) ? snap : best));
}
