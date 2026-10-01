import type { NewFireEvent } from '../../domain/model/FireEvent.js';
import type { Zone } from '../../domain/model/Zone.js';
import type { FireReportSource } from '../../domain/port/DataSources.js';
import { findZoneByName } from '../../domain/service/zoneMatching.js';
import type { PoliteHttpClient } from './PoliteHttpClient.js';

/** "Emergencias UNGRD" (datos.gov.co, CC BY-SA 4.0): emergencies reported in 2019-2022. */
const DATASET_API = 'https://www.datos.gov.co/resource/wwkg-r6te.json';
const DATASET_PAGE = 'https://www.datos.gov.co/d/wwkg-r6te';

export interface UngrdRow {
  readonly fecha?: string;
  readonly municipio?: string;
  readonly hectareas?: string;
}

/** Keeps the rows of known zones. The dataset only names the municipality, so it is also the place. */
export function ungrdRowsToFireEvents(rows: readonly UngrdRow[], zones: readonly Zone[]): NewFireEvent[] {
  const events: NewFireEvent[] = [];
  for (const row of rows) {
    const zone = row.municipio ? findZoneByName(row.municipio, zones) : undefined;
    const date = row.fecha?.slice(0, 10);
    if (!zone || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const hectares = Number(row.hectareas);
    events.push({
      zoneId: zone.id,
      place: zone.name,
      date,
      hectares: Number.isFinite(hectares) && hectares > 0 ? hectares : 0,
      source: 'ungrd',
      sourceUrl: DATASET_PAGE,
    });
  }
  return events;
}

/** Reads the dataset through its public Socrata API (allowed by datos.gov.co/robots.txt, Crawl-delay 1). */
export class UngrdFireReportSource implements FireReportSource {
  readonly name = 'ungrd';

  constructor(private readonly http: PoliteHttpClient) {}

  async fetchReports(zones: readonly Zone[]): Promise<NewFireEvent[]> {
    const query = new URLSearchParams({
      $select: 'fecha,municipio,hectareas',
      // LIKE avoids depending on how "Ñ" is encoded in the department name.
      $where: "departamento like 'NARI%' AND evento = 'INCENDIO DE COBERTURA VEGETAL'",
      $order: 'fecha',
      $limit: '5000',
    });
    const rows = await this.http.getJson<UngrdRow[]>(`${DATASET_API}?${query.toString()}`);
    return ungrdRowsToFireEvents(rows, zones);
  }
}
