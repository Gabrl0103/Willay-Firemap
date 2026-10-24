import { Component, computed, inject } from '@angular/core';
import { I18n } from '../../../i18n/i18n';
import { TranslatePipe } from '../../../i18n/t.pipe';

interface Dataset {
  readonly years: string;
  readonly url: string;
  readonly license: string;
  /** Creative Commons deed without its language: the page links the one in the app's language. */
  readonly licenseUrl: string;
}

const CC_BY_SA_4 = 'https://creativecommons.org/licenses/by-sa/4.0/deed.';
const CC_BY_4 = 'https://creativecommons.org/licenses/by/4.0/deed.';

/** Same datasets as backend/src/infrastructure/scraping/UngrdFireReportSource.ts (UNGRD_DATASETS). */
export const UNGRD_DATASETS: readonly Dataset[] = [
  { years: '2019–2022', url: 'https://www.datos.gov.co/d/wwkg-r6te', license: 'CC BY-SA 4.0', licenseUrl: CC_BY_SA_4 },
  { years: '2023–2024', url: 'https://www.datos.gov.co/d/rgre-6ak4', license: 'CC BY-SA 4.0', licenseUrl: CC_BY_SA_4 },
  { years: '2025', url: 'https://www.datos.gov.co/d/2343-nuqp', license: 'CC BY 4.0', licenseUrl: CC_BY_4 },
];

/**
 * Credit required by the CC licenses of the UNGRD data (author, source, license and changes made) and
 * by DANE's terms of use for the municipal boundaries of the map. DANE asks for its citation word for
 * word, so it stays in Spanish in both languages.
 */
@Component({
  selector: 'app-data-attribution',
  imports: [TranslatePipe],
  template: `
    <footer class="attribution">
      <p>{{ 'attribution.ungrd' | t }}</p>
      <ul>
        @for (dataset of datasets; track dataset.url) {
          <li>
            <a [href]="dataset.url" target="_blank" rel="noopener">{{ dataset.years }}</a> ·
            <a [href]="dataset.licenseUrl + deed()" target="_blank" rel="noopener">{{ dataset.license }}</a>
          </li>
        }
      </ul>
      <p>{{ 'attribution.changes' | t }}</p>
      <p class="boundaries">
        {{ 'attribution.boundaries' | t }}
        Fuente: Departamento Administrativo Nacional de Estadística:
        <a href="https://www.dane.gov.co" target="_blank" rel="noopener">www.dane.gov.co</a>
      </p>
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
    .boundaries { margin-top: 10px; }
    ul { margin: 8px 0; padding-left: 16px; }
    li { font-family: var(--font-mono); font-size: 11px; line-height: 1.8; }
    a { color: var(--amber); text-underline-offset: 2px; }
  `,
})
export class DataAttribution {
  protected readonly datasets = UNGRD_DATASETS;
  private readonly i18n = inject(I18n);
  /** "es" or "en": the license deed in the app's language. */
  protected readonly deed = computed(() => this.i18n.language());
}
