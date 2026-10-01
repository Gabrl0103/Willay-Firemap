import { Component, computed, input, output } from '@angular/core';
import type { ZoneDetail } from '../../../domain/model/risk';
import { RISK_LABELS } from '../../../domain/util/risk-labels';
import { AppIcon, type IconName } from '../app-icon/app-icon';

@Component({
  selector: 'app-zone-sheet',
  imports: [AppIcon],
  template: `
    <div class="sheet-layer">
      <button type="button" class="sheet-backdrop" aria-label="Cerrar detalle" (click)="closed.emit()"></button>
      <section class="zone-sheet" aria-label="Detalle de zona">
        <span class="sheet-handle"></span>
        <button type="button" class="sheet-close" aria-label="Cerrar" (click)="closed.emit()">
          <app-icon name="x" [size]="16" />
        </button>

        <header class="zone-cover">
          <div class="zone-cover-lines"></div>
          <div class="zone-heading">
            <div>
              <span class="eyebrow">Zona seleccionada</span>
              <h2>{{ detail().name }}</h2>
              <p>Riesgo próximas 24–72 h</p>
            </div>
            <div class="score-block" [class]="'risk-' + detail().level">
              <strong>{{ detail().score }}</strong><span>/100</span>
              <b>{{ level() }}</b>
            </div>
          </div>
        </header>

        <div class="zone-content">
          <div class="section-heading"><span>Condiciones actuales</span><small>Ahora</small></div>
          <div class="weather-grid">
            @for (item of weather(); track item.label) {
              <div class="weather-item">
                <app-icon [name]="item.icon" [size]="17" />
                <strong>{{ item.value }}</strong>
                <small>{{ item.label }}</small>
              </div>
            }
          </div>

          <div class="factors">
            <div class="section-heading"><span>Factores de riesgo</span><small>Contribución</small></div>
            @for (factor of factors(); track factor.label) {
              <div class="factor">
                <div><span>{{ factor.label }}</span><b>{{ factor.value }}%</b></div>
                <div class="factor-track"><span [style.width.%]="factor.value"></span></div>
              </div>
            }
          </div>

          <button type="button" class="history-cta" (click)="historyRequested.emit()">
            <app-icon name="history" [size]="16" />
            <span>Ver historial de {{ detail().name }}</span>
            <app-icon name="chevron-right" [size]="16" />
          </button>
          <p class="disclaimer">
            Datos simulados para fines académicos. El riesgo no confirma la ocurrencia de un incendio.
          </p>
        </div>
      </section>
    </div>
  `,
  styleUrl: './zone-sheet.css',
})
export class ZoneSheet {
  readonly detail = input.required<ZoneDetail>();
  readonly closed = output<void>();
  readonly historyRequested = output<void>();

  protected readonly level = computed(() => RISK_LABELS[this.detail().level]);

  protected readonly weather = computed<{ icon: IconName; value: string; label: string }[]>(() => {
    const w = this.detail().weather;
    return [
      { icon: 'thermometer', value: `${w.temperatureC}°`, label: 'Temperatura' },
      { icon: 'droplet', value: `${w.humidityPct}%`, label: 'Humedad' },
      { icon: 'wind', value: `${w.windKmh}`, label: 'Viento km/h' },
      { icon: 'calendar', value: `${w.daysWithoutRain}`, label: 'Días sin lluvia' },
    ];
  });

  protected readonly factors = computed(() => {
    const f = this.detail().factors;
    return [
      { label: 'Clima seco', value: f.dryWeather },
      { label: 'Focos de calor cercanos', value: f.nearbyHotspots },
      { label: 'Historial de incendios', value: f.fireHistory },
    ];
  });
}
