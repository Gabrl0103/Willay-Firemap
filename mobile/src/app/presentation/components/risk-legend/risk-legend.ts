import { Component } from '@angular/core';

@Component({
  selector: 'app-risk-legend',
  template: `
    <section class="legend" aria-label="Leyenda de riesgo">
      <p>Riesgo 24–72 h</p>
      @for (item of items; track item.cls) {
        <div>
          <span class="swatch" [class]="item.cls"></span><b>{{ item.label }}</b><small>{{ item.range }}</small>
        </div>
      }
      <div class="legend-hotspot"><span class="dot"></span><b>Foco de calor</b></div>
    </section>
  `,
  styleUrl: './risk-legend.css',
})
export class RiskLegend {
  protected readonly items = [
    { cls: 'risk-low', label: 'Bajo', range: '0–24' },
    { cls: 'risk-medium', label: 'Medio', range: '25–49' },
    { cls: 'risk-high', label: 'Alto', range: '50–74' },
    { cls: 'risk-extreme', label: 'Extremo', range: '75–100' },
  ];
}
