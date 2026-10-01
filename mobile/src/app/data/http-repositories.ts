import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/config/api-config';
import type { FireHistory, Hotspot, ZoneDetail, ZoneRiskSummary } from '../domain/model/risk';
import { FireRepository, HotspotRepository, ZoneRepository } from '../domain/repository/repositories';

@Injectable()
export class HttpZoneRepository extends ZoneRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(): Observable<ZoneRiskSummary[]> {
    return this.http.get<ZoneRiskSummary[]>(`${this.baseUrl}/zones`);
  }

  detail(zoneId: string): Observable<ZoneDetail> {
    return this.http.get<ZoneDetail>(`${this.baseUrl}/zones/${encodeURIComponent(zoneId)}`);
  }
}

@Injectable()
export class HttpFireRepository extends FireRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  history(zoneId?: string): Observable<FireHistory> {
    const query = zoneId ? `?zoneId=${encodeURIComponent(zoneId)}` : '';
    return this.http.get<FireHistory>(`${this.baseUrl}/fires${query}`);
  }
}

@Injectable()
export class HttpHotspotRepository extends HotspotRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(): Observable<Hotspot[]> {
    return this.http.get<Hotspot[]>(`${this.baseUrl}/hotspots`);
  }
}
