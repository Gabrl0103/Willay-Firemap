import { Component, computed, input, output, signal } from '@angular/core';
import type { RiskLevel } from '../../../domain/model/risk';
import { RISK_RANGES } from '../../../domain/util/risk-labels';
import { AppIcon } from '../app-icon/app-icon';
import { RiskBadge } from '../risk-badge/risk-badge';

const LEVELS: readonly RiskLevel[] = ['low', 'medium', 'high', 'extreme'];

/** "64 municipios · 12 focos de calor recientes", in singular when there is one. */
export function overviewCounts(zoneCount: number, hotspotCount: number): string {
  const zones = zoneCount === 1 ? '1 municipio' : `${zoneCount} municipios`;
  const hotspots = hotspotCount === 1 ? '1 foco de calor reciente' : `${hotspotCount} focos de calor recientes`;
  return `${zones} · ${hotspots}`;
}

/**
 * Bottom sheet of the map while no zone is selected: the department in numbers, the risk legend and
 * a way back to the whole department. The handle folds it down to its title to see more map.
 */
@Component({
  selector: 'app-map-overview-sheet',
  imports: [AppIcon, RiskBadge],
  template: `
    <section class="overview anim-sheet" [class.is-folded]="folded()" aria-labelledby="overview-title">
      <button
        type="button"
        class="handle"
        [attr.aria-label]="folded() ? 'Mostrar leyenda' : 'Ocultar leyenda'"
        [attr.aria-expanded]="!folded()"
        (click)="folded.set(!folded())"
      >
        <span></span>
      </button>
      <h2 id="overview-title">Departamento de Nariño</h2>
      <p class="counts">{{ counts() }}</p>
      @if (!folded()) {
        <ul class="legend" aria-label="Leyenda de riesgo">
          @for (level of levels; track level) {
            <li><app-risk-badge [level]="level" /><small class="range mono">{{ ranges[level] }}</small></li>
          }
        </ul>
        <p class="hotspot-key"><span class="dot"></span>Foco de calor (NASA FIRMS, últimos 5 días)</p>
        @if (canZoom()) {
          <button type="button" class="zoom" (click)="zoomRequested.emit()">Acercar a Nariño</button>
        }
        <p class="note">
          <span><app-icon name="alert" [size]="12" />Estimación de riesgo, no predicción exacta</span>
          @if (updatedLabel()) {
            <span class="mono">{{ updatedLabel() }}</span>
          }
        </p>
      }
    </section>
  `,
  styleUrl: './map-overview-sheet.css',
})
export class MapOverviewSheet {
  /** Zones with a score; 0 while they load. */
  readonly zoneCount = input.required<number>();
  readonly hotspotCount = input.required<number>();
  readonly updatedLabel = input<string>('');
  /** False without a map (no WebGL): then there is nothing to zoom. */
  readonly canZoom = input(true);
  readonly zoomRequested = output<void>();

  protected readonly levels = LEVELS;
  protected readonly ranges = RISK_RANGES;
  protected readonly folded = signal(false);
  protected readonly counts = computed(() =>
    this.zoneCount() === 0 ? 'Cargando municipios…' : overviewCounts(this.zoneCount(), this.hotspotCount()),
  );
}
