import { Component } from '@angular/core';
import type { RiskLevel } from '../../../domain/model/risk';
import { RiskBadge } from '../risk-badge/risk-badge';

@Component({
  selector: 'app-risk-legend',
  imports: [RiskBadge],
  template: `
    <section class="legend" aria-label="Leyenda de riesgo">
      <p>Riesgo 24–72 h</p>
      @for (item of items; track item.level) {
        <div><app-risk-badge [level]="item.level" /><small class="mono">{{ item.range }}</small></div>
      }
      <div class="legend-hotspot"><span class="dot"></span><b>Foco de calor</b></div>
    </section>
  `,
  styleUrl: './risk-legend.css',
})
export class RiskLegend {
  protected readonly items: { level: RiskLevel; range: string }[] = [
    { level: 'low', range: '0–24' },
    { level: 'medium', range: '25–49' },
    { level: 'high', range: '50–74' },
    { level: 'extreme', range: '75–100' },
  ];
}
