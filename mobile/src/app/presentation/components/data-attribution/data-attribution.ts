import { Component } from '@angular/core';

interface Dataset {
  readonly years: string;
  readonly url: string;
  readonly license: string;
  readonly licenseUrl: string;
}

const CC_BY_SA_4 = 'https://creativecommons.org/licenses/by-sa/4.0/deed.es';
const CC_BY_4 = 'https://creativecommons.org/licenses/by/4.0/deed.es';

/** Same datasets as backend/src/infrastructure/scraping/UngrdFireReportSource.ts (UNGRD_DATASETS). */
export const UNGRD_DATASETS: readonly Dataset[] = [
  { years: '2019–2022', url: 'https://www.datos.gov.co/d/wwkg-r6te', license: 'CC BY-SA 4.0', licenseUrl: CC_BY_SA_4 },
  { years: '2023–2024', url: 'https://www.datos.gov.co/d/rgre-6ak4', license: 'CC BY-SA 4.0', licenseUrl: CC_BY_SA_4 },
  { years: '2025', url: 'https://www.datos.gov.co/d/2343-nuqp', license: 'CC BY 4.0', licenseUrl: CC_BY_4 },
];

/** Credit required by the CC licenses of the UNGRD data: author, source, license and changes made. */
@Component({
  selector: 'app-data-attribution',
  template: `
    <footer class="attribution">
      <p>
        Datos oficiales: «Emergencias UNGRD», Unidad Nacional para la Gestión del Riesgo de Desastres (UNGRD),
        publicados en datos.gov.co:
      </p>
      <ul>
        @for (dataset of datasets; track dataset.url) {
          <li>
            <a [href]="dataset.url" target="_blank" rel="noopener">{{ dataset.years }}</a> ·
            <a [href]="dataset.licenseUrl" target="_blank" rel="noopener">{{ dataset.license }}</a>
          </li>
        }
      </ul>
      <p>Atalaya solo toma los incendios forestales de Nariño y une los reportes del mismo día y municipio.</p>
    </footer>
  `,
  styles: `
    .attribution {
      padding: 16px 18px;
      border: 1px solid var(--glass-border);
      border-radius: 22px;
      background: var(--glass-bg);
      font-size: 12px;
      line-height: 1.45;
      color: var(--text-2);
    }
    p { margin: 0; }
    ul { margin: 8px 0; padding-left: 16px; }
    li { font-family: var(--font-mono); font-size: 11px; line-height: 1.8; }
    a { color: var(--amber); text-underline-offset: 2px; }
  `,
})
export class DataAttribution {
  protected readonly datasets = UNGRD_DATASETS;
}
