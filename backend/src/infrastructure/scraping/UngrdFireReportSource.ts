import type { NewFireEvent } from '../../domain/model/FireEvent.js';
import type { Zone } from '../../domain/model/Zone.js';
import type { FireReportBatch, FireReportSource } from '../../domain/port/DataSources.js';
import { findZoneByName } from '../../domain/service/zoneMatching.js';
import type { PoliteHttpClient } from './PoliteHttpClient.js';

/** One "Emergencias UNGRD" dataset on datos.gov.co (same columns, one per period). */
export interface UngrdDataset {
  /** Socrata id, e.g. "wwkg-r6te". */
  readonly id: string;
  /** Years it covers, used in the source name ("ungrd-2023-2024"). */
  readonly years: string;
  readonly license: string;
}

/**
 * Emergencies reported to the UNGRD, published on datos.gov.co. Checked 2026-10-04: the three
 * datasets do not overlap, and Nariño has 174 (2023), 303 (2024) and 198 (2025) wildfire rows in
 * the newer two. Attribution is shown in the app (Historial) and in docs/REQUIREMENTS.md.
 */
export const UNGRD_DATASETS: readonly UngrdDataset[] = [
  { id: 'wwkg-r6te', years: '2019-2022', license: 'CC BY-SA 4.0' },
  { id: 'rgre-6ak4', years: '2023-2024', license: 'CC BY-SA 4.0' },
  { id: '2343-nuqp', years: '2025', license: 'CC BY 4.0' },
];

/** The UNGRD renamed the event: "INCENDIO DE COBERTURA VEGETAL" until 2022, "INCENDIO FORESTAL" since 2023. */
export const UNGRD_WILDFIRE_EVENTS = ['INCENDIO DE COBERTURA VEGETAL', 'INCENDIO FORESTAL'] as const;

export const ungrdApiUrl = (dataset: UngrdDataset): string => `https://www.datos.gov.co/resource/${dataset.id}.json`;
export const ungrdPageUrl = (dataset: UngrdDataset): string => `https://www.datos.gov.co/d/${dataset.id}`;

export interface UngrdRow {
  readonly fecha?: string;
  readonly municipio?: string;
  readonly hectareas?: string;
}

/** Keeps the rows of known zones. The dataset only names the municipality, so it is also the place. */
export function ungrdRowsToFireEvents(rows: readonly UngrdRow[], zones: readonly Zone[], sourceUrl: string): NewFireEvent[] {
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
      sourceUrl,
    });
  }
  return events;
}

/** Socrata query: wildfires in Nariño under either event name, oldest first. */
export function ungrdQuery(): URLSearchParams {
  const events = UNGRD_WILDFIRE_EVENTS.map((event) => `'${event}'`).join(', ');
  return new URLSearchParams({
    $select: 'fecha,municipio,hectareas',
    // LIKE avoids depending on how "Ñ" is encoded in the department name.
    $where: `departamento like 'NARI%' AND evento in (${events})`,
    $order: 'fecha',
    $limit: '5000',
  });
}

/** Reads one dataset through its public Socrata API (allowed by datos.gov.co/robots.txt, Crawl-delay 1). */
export class UngrdFireReportSource implements FireReportSource {
  constructor(
    private readonly dataset: UngrdDataset,
    private readonly http: Pick<PoliteHttpClient, 'getJson'>,
  ) {}

  get name(): string {
    return `ungrd-${this.dataset.years}`;
  }

  async fetchReports(zones: readonly Zone[]): Promise<FireReportBatch> {
    const rows = await this.http.getJson<UngrdRow[]>(`${ungrdApiUrl(this.dataset)}?${ungrdQuery().toString()}`);
    // Every row is a wildfire in Nariño (see the query).
    return {
      itemsRead: rows.length,
      wildfireItems: rows.length,
      events: ungrdRowsToFireEvents(rows, zones, ungrdPageUrl(this.dataset)),
    };
  }
}
