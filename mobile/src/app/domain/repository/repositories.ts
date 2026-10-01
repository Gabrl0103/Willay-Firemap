import type { Observable } from 'rxjs';
import type { FireHistory, Hotspot, ZoneDetail, ZoneRiskSummary } from '../model/risk';

/** Ports of the app. Abstract classes double as Angular DI tokens. */
export abstract class ZoneRepository {
  abstract list(): Observable<ZoneRiskSummary[]>;
  abstract detail(zoneId: string): Observable<ZoneDetail>;
}

export abstract class FireRepository {
  abstract history(zoneId?: string): Observable<FireHistory>;
}

export abstract class HotspotRepository {
  abstract list(): Observable<Hotspot[]>;
}
