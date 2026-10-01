import { NotFoundError } from '../../domain/error/DomainErrors.js';
import type { FireEvent } from '../../domain/model/FireEvent.js';
import type { FireEventRepository, ZoneRepository } from '../../domain/port/Repositories.js';

export interface FireHistory {
  readonly events: FireEvent[];
  readonly summary: {
    readonly count: number;
    readonly totalHectares: number;
    /** ISO date of the most recent fire, or null when there are none. */
    readonly lastDate: string | null;
  };
}

export class GetFireHistoryUseCase {
  constructor(
    private readonly fireEventRepository: FireEventRepository,
    private readonly zoneRepository: ZoneRepository,
  ) {}

  async execute(zoneId?: string): Promise<FireHistory> {
    if (zoneId && !(await this.zoneRepository.findById(zoneId))) {
      throw new NotFoundError(`Zone ${zoneId} not found`);
    }

    const all = await this.fireEventRepository.findAll();
    const events = all
      .filter((event) => !zoneId || event.zoneId === zoneId)
      .sort((a, b) => b.date.localeCompare(a.date));

    const totalHectares = events.reduce((sum, event) => sum + event.hectares, 0);
    return {
      events,
      summary: {
        count: events.length,
        totalHectares: Math.round(totalHectares * 10) / 10,
        lastDate: events[0]?.date ?? null,
      },
    };
  }
}
