import type { ZoneBoundary } from '../../domain/model/ZoneBoundary.js';

export interface ZoneBoundaries {
  /** Who made the boundaries, to credit them. */
  readonly source: string;
  readonly boundaries: readonly ZoneBoundary[];
}

/** The outlines of the zones. They are a static file joined at start-up, so they never change while running. */
export class GetZoneBoundariesUseCase {
  constructor(private readonly zoneBoundaries: ZoneBoundaries) {}

  execute(): ZoneBoundaries {
    return this.zoneBoundaries;
  }
}
