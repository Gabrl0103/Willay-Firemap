import { Component, computed, input, output } from '@angular/core';
import type { ForecastFallbackReason, ZoneForecast } from '../../../domain/model/risk';
import type { ForecastStatus } from '../../../state/zones.store';
import { RiskBadge } from '../risk-badge/risk-badge';

/** Why the backend answered with the current score instead of the model. */
export const FALLBACK_REASONS: Record<ForecastFallbackReason, string> = {
  weather_unavailable: 'no pudimos consultar el pronóstico del clima',
  weather_history_incomplete: 'faltan días recientes de clima',
  hotspot_history_incomplete: 'faltan días recientes de focos de calor',
  model_error: 'el modelo no pudo calcularlo',
};

/** Day at whose end each row starts its 72 h (the note under the rows explains it). */
const WHEN: Record<24 | 48 | 72, string> = { 24: 'hoy', 48: 'mañana', 72: 'pasado mañana' };

/** "24 %", or "<1 %" so a tiny probability does not read as zero. */
export function percentLabel(probability: number): string {
  const percent = Math.round(probability * 100);
  return percent < 1 ? '<1 %' : `${percent} %`;
}

/** «Pronóstico 72 h» of the zone sheet: the ML model at 24, 48 and 72 h, or why it is not available. */
@Component({
  selector: 'app-forecast-section',
  imports: [RiskBadge],
  template: `
    <section class="forecast glass-card" aria-labelledby="forecast-title">
      <h3 id="forecast-title">Pronóstico 72 h</h3>
      @switch (status()) {
        @case ('loading') {
          <div class="forecast-loading" role="status" aria-label="Calculando el pronóstico…">
            @for (hours of loadingRows; track hours) {
              <div class="forecast-row" aria-hidden="true">
                <div class="forecast-head">
                  <span class="forecast-when"><b class="mono">{{ hours }} h</b><small>{{ when(hours) }}</small></span>
                  <span class="skeleton skeleton-badge"></span>
                  <span class="skeleton skeleton-value"></span>
                </div>
                <div class="forecast-track skeleton"></div>
              </div>
            }
          </div>
        }
        @case ('error') {
          <div class="forecast-state is-error" role="alert">
            <p>No pudimos cargar el pronóstico.</p>
            <button type="button" (click)="retry.emit()">Reintentar</button>
          </div>
        }
        @default {
          @if (forecast(); as data) {
            @if (data.source === 'model') {
              <ul class="forecast-rows">
                @for (horizon of data.horizons; track horizon.hours; let i = $index) {
                  <li class="forecast-row" [class]="'risk-' + horizon.level">
                    <div class="forecast-head">
                      <span class="forecast-when"><b class="mono">{{ horizon.hours }} h</b><small>{{ when(horizon.hours) }}</small></span>
                      <app-risk-badge [level]="horizon.level" />
                      <b class="mono forecast-value">{{ percent(horizon.probability) }}</b>
                    </div>
                    <div class="forecast-track" aria-hidden="true">
                      <span class="anim-growx" [style.--i]="i + 1" [style.width.%]="horizon.probability * 100"></span>
                    </div>
                  </li>
                }
              </ul>
              <p class="forecast-note">
                Probabilidad de focos de calor a menos de 25 km en las 72 h siguientes a cada día (hoy, mañana y
                pasado mañana), con el clima pronosticado.
                Es una estimación del modelo, no una predicción exacta.
              </p>
            } @else {
              <div class="forecast-state is-fallback" role="status">
                <p>Pronóstico no disponible: {{ reason() }}. Mostramos el riesgo actual.</p>
                <span class="forecast-current">
                  <app-risk-badge [level]="data.current.level" /><b class="mono">{{ data.current.score }}</b>
                </span>
              </div>
            }
          }
        }
      }
    </section>
  `,
  styleUrl: './forecast-section.css',
})
export class ForecastSection {
  readonly forecast = input<ZoneForecast | null>(null);
  readonly status = input<ForecastStatus>('idle');
  readonly retry = output<void>();

  protected readonly reason = computed(() => {
    const data = this.forecast();
    return data?.source === 'fallback' ? FALLBACK_REASONS[data.reason] : '';
  });
  protected readonly percent = percentLabel;
  /** While it loads, the three rows keep their place: the sheet does not jump when the answer comes. */
  protected readonly loadingRows = [24, 48, 72] as const;
  protected readonly when = (hours: 24 | 48 | 72): string => WHEN[hours];
}
