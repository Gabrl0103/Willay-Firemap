import {
  AfterViewInit, Component, ElementRef, OnDestroy, computed, effect, inject, signal, viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Geolocation } from '@capacitor/geolocation';
import * as L from 'leaflet';
import type { Hotspot, ZoneRiskSummary } from '../../../domain/model/risk';
import { nearestZone } from '../../../domain/util/geo';
import { RISK_LABELS } from '../../../domain/util/risk-labels';
import { ZonesStore } from '../../../state/zones.store';
import { AppIcon } from '../../components/app-icon/app-icon';
import { RiskLegend } from '../../components/risk-legend/risk-legend';
import { SearchBox } from '../../components/search-box/search-box';
import { ZoneSheet } from '../../components/zone-sheet/zone-sheet';

/** Center of Nariño (approx.) and starting zoom. The real department outline arrives with the IGAC/DANE GeoJSON. */
const NARINO_CENTER: L.LatLngTuple = [1.3, -77.7];
const NARINO_ZOOM = 8;
/** Standard OpenStreetMap tiles (no API key). The dark look comes from a CSS filter in theme/map-markers.css. */
const TILES_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILES_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

@Component({
  selector: 'app-map-page',
  imports: [AppIcon, SearchBox, RiskLegend, ZoneSheet],
  templateUrl: './map.page.html',
  styleUrl: './map.page.css',
  host: { class: 'ion-page' },
})
export class MapPage implements AfterViewInit, OnDestroy {
  protected readonly store = inject(ZonesStore);
  private readonly router = inject(Router);

  private readonly mapElement = viewChild.required<ElementRef<HTMLDivElement>>('mapElement');
  private map?: L.Map;
  private readonly zoneLayer = L.layerGroup();
  private readonly hotspotLayer = L.layerGroup();
  private userMarker?: L.Marker;
  private readonly mapReady = signal(false);
  private fitted = false;

  protected readonly updatedLabel = computed(() => {
    const date = this.store.updatedAt();
    return date
      ? `Actualizado ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
      : 'Cargando…';
  });

  constructor() {
    effect(() => {
      if (!this.mapReady()) return;
      this.drawZones(this.store.zones(), this.store.selectedId());
    });
    effect(() => {
      if (!this.mapReady()) return;
      this.drawHotspots(this.store.hotspots());
    });
  }

  ngAfterViewInit(): void {
    this.map = L.map(this.mapElement().nativeElement, {
      center: NARINO_CENTER,
      zoom: NARINO_ZOOM,
      zoomControl: false,
      zoomSnap: 0.25,
      attributionControl: true,
    });
    L.tileLayer(TILES_URL, { attribution: TILES_ATTRIBUTION, maxZoom: 14 }).addTo(this.map);
    this.zoneLayer.addTo(this.map);
    this.hotspotLayer.addTo(this.map);
    this.map.attributionControl.setPrefix(false);
    // Labels get shorter when the map is zoomed out, so markers do not pile up.
    const updateZoomClass = (): void => {
      this.mapElement().nativeElement.classList.toggle('zoom-far', (this.map?.getZoom() ?? 0) < 9);
    };
    this.map.on('zoomend', updateZoomClass);
    updateZoomClass();
    this.mapReady.set(true);
    if (this.store.zones().length === 0) this.store.load();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  protected selectZone(zone: ZoneRiskSummary): void {
    this.store.select(zone.id);
    this.focusOn(zone.latitude, zone.longitude, 10);
  }

  protected closeSheet(): void {
    this.store.clearSelection();
  }

  protected openHistory(zoneId: string): void {
    void this.router.navigate(['/history'], { queryParams: { zoneId } });
  }

  protected async locateMe(): Promise<void> {
    try {
      const position = await Geolocation.getCurrentPosition({ timeout: 10000 });
      const { latitude, longitude } = position.coords;
      this.showUser(latitude, longitude);
      const zone = nearestZone(this.store.zones(), latitude, longitude);
      if (zone) this.store.select(zone.id);
      this.focusOn(latitude, longitude, 10);
    } catch {
      this.store.reportError('No pudimos obtener tu ubicación. Revisa los permisos.');
    }
  }

  private focusOn(latitude: number, longitude: number, zoom: number): void {
    if (!this.map) return;
    // Shift the center so the point stays visible above the bottom sheet.
    const point = this.map.project([latitude, longitude], zoom);
    point.y += 150;
    this.map.flyTo(this.map.unproject(point, zoom), zoom, { duration: 0.6 });
  }

  private showUser(latitude: number, longitude: number): void {
    if (!this.map) return;
    this.userMarker?.remove();
    this.userMarker = L.marker([latitude, longitude], {
      icon: L.divIcon({ className: 'user-icon', html: '<span class="user-dot"></span>', iconSize: [14, 14] }),
      interactive: false,
    }).addTo(this.map);
  }

  private drawZones(zones: readonly ZoneRiskSummary[], selectedId: string | null): void {
    this.zoneLayer.clearLayers();
    if (!this.fitted && zones.length > 0 && this.map) {
      this.fitted = true;
      this.map.fitBounds(L.latLngBounds(zones.map((z) => [z.latitude, z.longitude] as L.LatLngTuple)), {
        paddingTopLeft: [34, 190],
        paddingBottomRight: [34, 150],
        maxZoom: 9,
      });
    }
    for (const zone of zones) {
      const selected = zone.id === selectedId ? ' is-selected' : '';
      const icon = L.divIcon({
        className: 'zone-icon',
        iconSize: [18, 18],
        html:
          `<div class="zone-marker risk-${zone.level}${selected}">` +
          `<span class="zone-dot"></span>` +
          `<span class="zone-label"><b>${zone.name}</b><small>${zone.score} · ${RISK_LABELS[zone.level]}</small><i>${zone.score}</i></span>` +
          `</div>`,
      });
      L.marker([zone.latitude, zone.longitude], { icon, title: zone.name })
        .on('click', () => this.selectZone(zone))
        .addTo(this.zoneLayer);
    }
  }

  private drawHotspots(hotspots: readonly Hotspot[]): void {
    this.hotspotLayer.clearLayers();
    for (const hotspot of hotspots) {
      L.marker([hotspot.latitude, hotspot.longitude], {
        icon: L.divIcon({ className: 'hotspot-icon', html: '<span class="hotspot"></span>', iconSize: [7, 7] }),
        interactive: false,
      }).addTo(this.hotspotLayer);
    }
  }
}
