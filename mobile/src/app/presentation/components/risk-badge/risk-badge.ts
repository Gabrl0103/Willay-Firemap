import { Component, computed, input } from '@angular/core';
import type { RiskLevel } from '../../../domain/model/risk';
import { RISK_LABELS } from '../../../domain/util/risk-labels';

/** Píldora de vidrio con el nivel de riesgo. Úsala en todos los lugares donde se muestre un nivel. */
@Component({
  selector: 'app-risk-badge',
  template: `<span class="badge" [attr.data-level]="level()"><i class="dot"></i>{{ text() }}</span>`,
  styleUrl: './risk-badge.css',
})
export class RiskBadge {
  readonly level = input.required<RiskLevel>();
  /** Texto opcional; por defecto el nombre del nivel (Bajo, Medio, Alto, Extremo). */
  readonly label = input<string>();

  protected readonly text = computed(() => this.label() ?? RISK_LABELS[this.level()]);
}
