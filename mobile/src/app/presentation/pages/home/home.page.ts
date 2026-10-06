import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { summarizeDepartment, topZones } from '../../../domain/util/department-summary';
import { RISK_LABELS } from '../../../domain/util/risk-labels';
import { ZonesStore } from '../../../state/zones.store';
import { LavaBg } from '../../components/lava-bg/lava-bg';
import { RiskBadge } from '../../components/risk-badge/risk-badge';

/** Cuántas zonas muestra el carrusel "Zonas con mayor riesgo". */
const TOP_ZONE_COUNT = 5;

@Component({
  selector: 'app-home-page',
  imports: [LavaBg, RiskBadge],
  templateUrl: './home.page.html',
  styleUrl: './home.page.css',
  host: { class: 'ion-page' },
})
export class HomePage {
  protected readonly store = inject(ZonesStore);
  private readonly router = inject(Router);
  protected readonly riskLabels = RISK_LABELS;
  protected readonly summary = computed(() => summarizeDepartment(this.store.zones(), this.store.hotspots()));
  protected readonly topZones = computed(() => topZones(this.store.zones(), TOP_ZONE_COUNT));

  constructor() {
    if (this.store.zones().length === 0 && !this.store.loading()) this.store.load();
  }

  /** Abre el mapa con la hoja de la zona (el mapa la muestra cuando llega store.detail). */
  protected openZone(zoneId: string): void {
    this.store.select(zoneId);
    void this.router.navigateByUrl('/map');
  }
}
