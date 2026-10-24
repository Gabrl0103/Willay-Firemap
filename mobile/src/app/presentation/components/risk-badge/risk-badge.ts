import { Component, computed, inject, input } from '@angular/core';
import type { RiskLevel } from '../../../domain/model/risk';
import { riskLabel } from '../../../domain/util/risk-labels';
import { I18n } from '../../../i18n/i18n';

/** Píldora de vidrio con el nivel de riesgo. Úsala en todos los lugares donde se muestre un nivel. */
@Component({
  selector: 'app-risk-badge',
  template: `<span class="badge" [attr.data-level]="level()"><i class="dot"></i>{{ text() }}</span>`,
  styleUrl: './risk-badge.css',
})
export class RiskBadge {
  readonly level = input.required<RiskLevel>();
  /** Texto opcional; por defecto el nombre del nivel en el idioma de la app (Bajo… / Low…). */
  readonly label = input<string>();

  private readonly i18n = inject(I18n);
  protected readonly text = computed(() => this.label() ?? riskLabel(this.level(), this.i18n.language()));
}
