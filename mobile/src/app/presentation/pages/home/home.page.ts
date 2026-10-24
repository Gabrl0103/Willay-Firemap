import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { summarizeDepartment, topZones } from '../../../domain/util/department-summary';
import { favoriteZones } from '../../../domain/util/favorites';
import { RISK_LABELS } from '../../../domain/util/risk-labels';
import { FavoritesStore } from '../../../state/favorites.store';
import { ZonesStore } from '../../../state/zones.store';
import { AppIcon } from '../../components/app-icon/app-icon';
import { LavaBg } from '../../components/lava-bg/lava-bg';
import { RiskBadge } from '../../components/risk-badge/risk-badge';

/** Cuántas zonas muestra el carrusel "Zonas con mayor riesgo". */
const TOP_ZONE_COUNT = 5;

@Component({
  selector: 'app-home-page',
  imports: [AppIcon, LavaBg, RiskBadge],
  templateUrl: './home.page.html',
  styleUrl: './home.page.css',
  host: { class: 'ion-page' },
})
export class HomePage {
  protected readonly store = inject(ZonesStore);
  private readonly router = inject(Router);
  private readonly favorites = inject(FavoritesStore);
  protected readonly riskLabels = RISK_LABELS;
  protected readonly summary = computed(() => summarizeDepartment(this.store.zones(), this.store.hotspots()));
  protected readonly topZones = computed(() => topZones(this.store.zones(), TOP_ZONE_COUNT));
  /** «Mis municipios»: the hearts of the zone sheet, in the order they were added. */
  protected readonly myZones = computed(() => favoriteZones(this.favorites.ids(), this.store.zones()));

  constructor() {
    if (this.store.zones().length === 0 && !this.store.loading()) this.store.load();
  }

  /** Abre el mapa con la hoja de la zona (el mapa la muestra cuando llega store.detail). */
  protected openZone(zoneId: string): void {
    this.store.select(zoneId);
    void this.router.navigateByUrl('/map');
  }
}
