import {
  AfterViewInit, Component, ElementRef, OnDestroy, computed, effect, inject, signal, untracked, viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  AttributionControl, Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent,
} from 'maplibre-gl';
import { getUserLocation, locationMessage } from '../../../core/location/user-location';
import { AppCurtain } from '../../../core/app-curtain';
import { SearchRequest } from '../../../core/search-request';
import type { ZoneBoundaries, ZoneRiskSummary } from '../../../domain/model/risk';
import { averagePerYear } from '../../../domain/util/fire-history';
import { nearestZone } from '../../../domain/util/geo';
import { ZonesStore } from '../../../state/zones.store';
import { AppIcon } from '../../components/app-icon/app-icon';
import { MapOverviewSheet } from '../../components/map-overview-sheet/map-overview-sheet';
import { SearchBox } from '../../components/search-box/search-box';
import { MID_HEIGHT } from '../../components/zone-sheet/sheet-snap';
import { ZoneSheet } from '../../components/zone-sheet/zone-sheet';
import {
  FLY_MS, MAX_BOUNDS, MAX_ZOOM, MIN_ZOOM_OVER_NARINO, NARINO_BOUNDS, NO_PADDING, PITCH, SPIN_MS, TAP_FLY_MS,
  ZONE_FLY_MS, ZONE_ZOOM,
  globeHalo, globeStart, hasWebGL, introPlan, narinoPadding, prefersReducedMotion, readIntroPlayed, rememberIntroPlayed, spinCenter,
} from './map-camera';
import {
  BOUNDARIES_SOURCE, DEPARTMENT_SOURCE, HOTSPOTS_SOURCE, ZONE_FILL_LAYER, ZONE_SELECTED_LAYERS, boundariesSource, boundaryLayers,
  departmentSource, hotspotLayers, hotspotPoints, hotspotsSource, readMapColors, selectedZoneFilter, zoneStates, type MapColors,
} from './map-layers';
import { mapStyle } from './map-style';
import { ZONES_SOURCE, diffMarkers, markerItems, zonePoints, zonesHitLayer, zonesSource, type MarkerItem } from './zone-clusters';
import {
  clusterLabel, clusterMarkerHtml, coveredDots, showsNames, visibleLabels, zoneMarkerHtml, type LabelBox, type ScreenBox,
} from './zone-marker';

/** MapLibre's worker, copied next to the app by angular.json (it cannot come from a CDN). */
const WORKER_PATH = 'maplibre/maplibre-gl-worker.mjs';
/**
 * The globe spins and flies once per session (sessionStorage, so a reload does not replay it);
 * later visits open straight over Nariño. This flag covers a browser without storage.
 */
let introPlayed = false;
/** Any of these on the map during the intro skips it. */
const SKIP_EVENTS = ['mousedown', 'touchstart', 'wheel'] as const;
/** How far (px) the globe's orange halo reaches beyond its edge. */
const GLOW_WIDTH = 44;
/** Room (px) a label keeps from the edges of the free map area. */
const LABEL_MARGIN = 4;
/** Half the size (px) of the dot of a municipality whose label does not fit (map-markers.css). */
const DOT_RADIUS = 4;
/** A flown-to seat sits this far above the center, clear of the zone sheet. */
const SEAT_OFFSET: [number, number] = [0, -150];

interface ShownMarker {
  readonly marker: Marker;
  readonly item: MarkerItem;
}

@Component({
  selector: 'app-map-page',
  imports: [AppIcon, MapOverviewSheet, SearchBox, ZoneSheet],
  templateUrl: './map.page.html',
  styleUrl: './map.page.css',
  // --sheet-inset: how much of the map the sheet covers, so the credits sit just above it.
  host: { class: 'ion-page', '[style.--sheet-inset.px]': 'sheetInset()' },
})
export class MapPage implements AfterViewInit, OnDestroy {
  protected readonly store = inject(ZonesStore);
  private readonly router = inject(Router);
  private readonly searchRequest = inject(SearchRequest);
  private readonly curtain = inject(AppCurtain);

  private readonly mapElement = viewChild.required<ElementRef<HTMLDivElement>>('mapElement');
  private readonly overview = viewChild('overview', { read: ElementRef<HTMLElement> });
  private readonly glow = viewChild.required<ElementRef<HTMLDivElement>>('glow');
  private readonly header = viewChild.required<ElementRef<HTMLElement>>('header');
  private map?: MapLibreMap;
  private colors?: MapColors;
  private readonly markers = new Map<string, ShownMarker>();
  private userMarker?: Marker;
  private spinFrame?: number;
  private spinning = false;
  /** Ends the intro (spin or flight to Nariño) and drops its skip listeners; false outside it. */
  private endIntro: () => boolean = () => false;
  /** Bumped by every camera move the page starts, so a flight that was cut short does not finish its work. */
  private cameraMove = 0;
  private destroyed = false;
  private readonly mapReady = signal(false);
  private boundariesShown = false;
  /** The camera shows the whole department (intro, «Acercar a Nariño»), untouched since. */
  private framingNarino = false;
  protected readonly sheetInset = signal(0);
  /** No WebGL: MapLibre cannot draw in any projection, so the map area explains it instead. */
  protected readonly mapUnavailable = signal(false);
  /** The glass search layer, opened from the magnifier of the bottom nav. */
  protected readonly searchOpen = signal(false);
  protected readonly locating = signal(false);
  /** Why «Mi ubicación» failed, in Spanish (kept apart from the store error, whose retry reloads zones). */
  protected readonly locationError = signal<string | null>(null);

  protected readonly updatedLabel = computed(() => {
    const date = this.store.updatedAt();
    return date
      ? `Actualizado ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
      : 'Cargando…';
  });

  /** Fires per year of the selected zone, from its records (null until they arrive). */
  protected readonly firesPerYear = computed(() => {
    const history = this.store.detailFires();
    return history ? averagePerYear(history.events, new Date()) : null;
  });

  constructor() {
    // The bottom nav's magnifier (on any screen) navigates here and asks for the search.
    effect(() => {
      if (!this.searchRequest.pending()) return;
      this.searchRequest.consume();
      this.searchOpen.set(true);
    });
    effect(() => {
      if (!this.mapReady()) return;
      this.setZones(this.store.zones());
    });
    effect(() => {
      if (!this.mapReady()) return;
      this.source(HOTSPOTS_SOURCE)?.setData(hotspotPoints(this.store.hotspots()));
    });
    effect(() => {
      if (!this.mapReady()) return;
      const boundaries = this.store.boundaries();
      if (boundaries && !this.boundariesShown) this.showBoundaries(boundaries);
    });
    effect(() => {
      if (!this.mapReady()) return;
      this.styleSelection(this.store.zones(), this.store.selectedId(), this.store.boundaries());
    });
    // A sheet that grows covers more map: the labels under it give way (and the ones it uncovers come back).
    effect(() => {
      this.sheetInset();
      if (this.mapReady()) untracked(() => this.placeLabels());
    });
    // The overview sheet folds and unfolds: the credits follow it and Nariño is framed again above it.
    effect((onCleanup) => {
      const overview = this.overview()?.nativeElement;
      if (!overview) {
        // The zone sheet opens at MID_HEIGHT of the screen.
        const detailOpen = this.store.detail() !== null;
        this.sheetInset.set(detailOpen ? Math.round(this.mapElement().nativeElement.clientHeight * MID_HEIGHT) : 0);
        return;
      }
      const observer = new ResizeObserver(() => {
        this.sheetInset.set(overview.offsetHeight);
        if (this.framingNarino) this.reframeNarino();
      });
      observer.observe(overview);
      onCleanup(() => observer.disconnect());
    });
  }

  ngAfterViewInit(): void {
    if (this.store.zones().length === 0) this.store.load();
    this.store.loadBoundaries();
    if (!hasWebGL(document)) {
      this.mapUnavailable.set(true);
      return;
    }
    this.createMap();
  }

  private createMap(): void {
    setWorkerUrl(new URL(WORKER_PATH, document.baseURI).href);
    const element = this.mapElement().nativeElement;
    const colors = readMapColors(element);
    this.colors = colors;
    const plan = introPlan({
      hasSelection: this.store.selectedId() !== null,
      reducedMotion: prefersReducedMotion(window),
      firstVisit: !introPlayed && !readIntroPlayed(window),
    });
    introPlayed = true;
    rememberIntroPlayed(window);

    const map = new MapLibreMap({
      container: element,
      style: mapStyle(),
      ...globeStart({ width: element.clientWidth, height: element.clientHeight, bottom: this.sheetHeight() }),
      maxZoom: MAX_ZOOM,
      maxPitch: PITCH,
      attributionControl: false,
      // The view keeps north up: tilt comes from the camera, not from the fingers.
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    this.map = map;
    map.touchZoomRotate.disableRotation();
    // Always expanded: OpenStreetMap and DANE ask to be credited where the map is seen.
    map.addControl(new AttributionControl({ compact: false }), 'bottom-right');

    const updateZoomClass = (): void => {
      const names = showsNames(map.getZoom());
      if (names === element.classList.contains('show-names')) return;
      // Crossing into the names: they wait hidden until the camera stops and placeLabels sorts them out.
      if (names) this.hideLabels();
      element.classList.toggle('show-names', names);
    };
    map.on('zoom', updateZoomClass);
    updateZoomClass();
    map.on('render', () => this.syncMarkers());
    map.on('moveend', () => this.placeLabels());
    map.on('move', () => this.placeGlow());
    map.on('resize', () => this.placeGlow());
    this.placeGlow();
    map.on('click', ZONE_FILL_LAYER, (event) => this.onPolygonTap(event));
    // A finger (or the wheel) moving the map ends the department framing; camera flights do not.
    map.on('movestart', (event) => {
      if (event.originalEvent) this.framingNarino = false;
    });
    map.once('load', () => {
      this.addLayers(map, colors);
      this.mapReady.set(true);
      this.openCamera(plan);
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.endIntro();
    this.stopSpin();
    this.map?.remove();
  }

  protected selectZone(zone: ZoneRiskSummary, duration = ZONE_FLY_MS): void {
    this.store.select(zone.id);
    this.flyToSeat(zone.longitude, zone.latitude, duration);
  }

  protected pickFromSearch(zone: ZoneRiskSummary): void {
    this.searchOpen.set(false);
    this.selectZone(zone);
  }

  protected closeSearch(): void {
    this.searchOpen.set(false);
  }

  /** «Acercar a Nariño»: back to the whole department (a jump with reduced motion). */
  protected zoomToNarino(): void {
    this.flyToNarino(false);
  }

  /**
   * The zone sheet closed (its back button, the backdrop or a drag down): the camera stays where it is
   * and the municipality loses its highlight. Only «Acercar a Nariño» goes back to the whole department.
   */
  protected closeSheet(): void {
    this.store.clearSelection();
  }

  protected openHistory(zoneId: string): void {
    void this.router.navigate(['/history'], { queryParams: { zoneId } });
  }

  protected async locateMe(): Promise<void> {
    if (this.locating()) return;
    this.locating.set(true);
    this.locationError.set(null);
    const result = await getUserLocation();
    this.locating.set(false);
    if (result.status !== 'ok') {
      this.locationError.set(locationMessage(result.status));
      return;
    }
    const { latitude, longitude } = result;
    this.showUser(latitude, longitude);
    const zone = nearestZone(this.store.zones(), latitude, longitude);
    if (zone) this.store.select(zone.id);
    this.flyToSeat(longitude, latitude);
  }

  /** The base style is ready: add the zones, hotspots and (when they arrive) the municipal polygons. */
  private addLayers(map: MapLibreMap, colors: MapColors): void {
    map.addSource(HOTSPOTS_SOURCE, hotspotsSource([]));
    for (const layer of hotspotLayers(colors)) map.addLayer(layer);
    map.addSource(ZONES_SOURCE, zonesSource([]));
    map.addLayer(zonesHitLayer);
  }

  /** Polygons go under the hotspots and the markers. Added once: risk and selection only restyle them. */
  private showBoundaries(boundaries: ZoneBoundaries): void {
    const map = this.map;
    if (!map || !this.colors) return;
    this.boundariesShown = true;
    map.addSource(BOUNDARIES_SOURCE, boundariesSource(boundaries));
    map.addSource(DEPARTMENT_SOURCE, departmentSource(boundaries));
    for (const layer of boundaryLayers(this.colors)) map.addLayer(layer, 'hotspot-halo');
    this.styleSelection(this.store.zones(), this.store.selectedId(), boundaries);
  }

  /** New scores regroup the seats: the markers are rebuilt from the next render. */
  private setZones(zones: readonly ZoneRiskSummary[]): void {
    for (const { marker } of this.markers.values()) marker.remove();
    this.markers.clear();
    this.source(ZONES_SOURCE)?.setData(zonePoints(zones));
  }

  private styleSelection(zones: readonly ZoneRiskSummary[], selectedId: string | null, boundaries: ZoneBoundaries | null): void {
    const map = this.map;
    if (!map) return;
    if (boundaries && this.boundariesShown) {
      for (const { id, state } of zoneStates(boundaries, zones, selectedId)) map.setFeatureState({ source: BOUNDARIES_SOURCE, id }, state);
      for (const layer of ZONE_SELECTED_LAYERS) map.setFilter(layer, selectedZoneFilter(selectedId));
    }
    // Markers already on screen take the new score, level or selection; the selected name goes first.
    for (const { marker, item } of this.markers.values()) {
      if (item.kind === 'zone') this.paintZoneMarker(marker, item.zoneId);
    }
    this.placeLabels();
  }

  /** Same as tapping the marker. A tap that started on a marker (or group) is the marker's, not the polygon's. */
  private onPolygonTap(event: MapLayerMouseEvent): void {
    const target = event.originalEvent.target;
    if (target instanceof Element && target.closest('.maplibregl-marker')) return;
    const id = event.features?.[0]?.properties['id'];
    const zone = this.store.zones().find((z) => z.id === id);
    // Zones without a score yet have no sheet to open.
    if (zone) this.selectZone(zone, TAP_FLY_MS);
  }

  /** Shows one HTML marker per group or lone seat that the zones source has, reusing those already shown. */
  private syncMarkers(): void {
    const map = this.map;
    if (!map || !map.getSource(ZONES_SOURCE) || !map.isSourceLoaded(ZONES_SOURCE)) return;
    const { add, remove } = diffMarkers(new Set(this.markers.keys()), markerItems(map.querySourceFeatures(ZONES_SOURCE)));
    for (const key of remove) {
      this.markers.get(key)?.marker.remove();
      this.markers.delete(key);
    }
    for (const item of add) {
      const marker = item.kind === 'zone' ? this.zoneMarker(item.zoneId) : this.clusterMarker(item);
      if (!marker) continue;
      marker.setLngLat(item.lngLat).addTo(map);
      this.markers.set(item.key, { marker, item });
    }
    if (add.length > 0 && !map.isMoving()) this.placeLabels();
  }

  /**
   * Shows the names (with the score) that fit without overlapping: the selected zone first, then
   * the riskiest. The rest are a small dot, dropped when a shown label covers it, so a municipality
   * is never a label and a dot at once. Measured when the camera stops, so nothing flickers while it moves.
   */
  private placeLabels(): void {
    const map = this.map;
    if (!map || !showsNames(map.getZoom())) return;
    const scores = new Map(this.store.zones().map((zone) => [zone.id, zone.score]));
    const selectedId = this.store.selectedId();
    const boxes: LabelBox[] = [];
    for (const { marker, item } of this.markers.values()) {
      const label = item.kind === 'zone' ? marker.getElement().querySelector('.zone-label') : null;
      if (!label || item.kind !== 'zone') continue;
      const { left, top, right, bottom } = label.getBoundingClientRect();
      const priority = item.zoneId === selectedId ? Infinity : (scores.get(item.zoneId) ?? 0);
      boxes.push({ key: item.key, priority, left, top, right, bottom });
    }
    const shown = visibleLabels(boxes, this.labelArea());
    const dots: (ScreenBox & { readonly key: string })[] = [];
    for (const { marker, item } of this.markers.values()) {
      const element = marker.getElement();
      element.classList.toggle('label-hidden', !shown.has(item.key));
      if (item.kind === 'zone' && !shown.has(item.key)) {
        const { left, top, right, bottom } = element.getBoundingClientRect();
        const x = (left + right) / 2;
        const y = (top + bottom) / 2;
        dots.push({ key: item.key, left: x - DOT_RADIUS, top: y - DOT_RADIUS, right: x + DOT_RADIUS, bottom: y + DOT_RADIUS });
      }
    }
    const covered = coveredDots(dots, boxes.filter((box) => shown.has(box.key)));
    for (const { marker, item } of this.markers.values()) marker.getElement().classList.toggle('dot-hidden', covered.has(item.key));
  }

  /** Where a label can show whole: the map below the header and above the sheet, with a small margin. */
  private labelArea(): ScreenBox {
    const map = this.mapElement().nativeElement.getBoundingClientRect();
    return {
      left: map.left + LABEL_MARGIN,
      right: map.right - LABEL_MARGIN,
      top: this.header().nativeElement.getBoundingClientRect().bottom + LABEL_MARGIN,
      bottom: map.bottom - this.sheetInset() - LABEL_MARGIN,
    };
  }

  private hideLabels(): void {
    for (const { marker } of this.markers.values()) marker.getElement().classList.add('label-hidden');
  }

  private zoneMarker(zoneId: string): Marker | null {
    const zone = this.store.zones().find((z) => z.id === zoneId);
    if (!zone) return null;
    const element = document.createElement('div');
    // Its label shows once placeLabels finds room for it.
    element.className = 'zone-icon label-hidden';
    element.title = zone.name;
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      const current = this.store.zones().find((z) => z.id === zoneId);
      if (current) this.selectZone(current, TAP_FLY_MS);
    });
    const marker = new Marker({ element });
    this.paintZoneMarker(marker, zoneId);
    return marker;
  }

  private paintZoneMarker(marker: Marker, zoneId: string): void {
    const zone = this.store.zones().find((z) => z.id === zoneId);
    if (!zone) return;
    const selected = zone.id === this.store.selectedId();
    const element = marker.getElement();
    element.innerHTML = zoneMarkerHtml(zone, selected);
    // The selected marker goes on top, so its name is not hidden under its neighbours.
    element.style.zIndex = selected ? '2' : '';
  }

  private clusterMarker(item: Extract<MarkerItem, { kind: 'cluster' }>): Marker {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'cluster-icon';
    element.setAttribute('aria-label', clusterLabel(item.count));
    element.innerHTML = clusterMarkerHtml(item.count, item.level);
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      void this.zoomIntoCluster(item);
    });
    return new Marker({ element });
  }

  private async zoomIntoCluster(item: Extract<MarkerItem, { kind: 'cluster' }>): Promise<void> {
    const map = this.map;
    const source = this.source(ZONES_SOURCE);
    if (!map || !source) return;
    const zoom = await source.getClusterExpansionZoom(item.clusterId);
    this.framingNarino = false;
    map.easeTo({ center: item.lngLat, zoom: zoom + 0.25, duration: 500 });
  }

  private openCamera(plan: ReturnType<typeof introPlan>): void {
    if (plan === 'spin-fly') {
      // The globe waits in full view until the splash (or the introduction) is gone.
      void this.curtain.lifted.then(() => {
        if (!this.destroyed) this.spin();
      });
      return;
    }
    this.jumpToNarino();
    const selected = this.store.zones().find((z) => z.id === this.store.selectedId());
    if (plan === 'zone' && selected) this.flyToSeat(selected.longitude, selected.latitude);
  }

  /** The globe turns slowly, then flies to Nariño. Touching the map, spinning or flying, skips to the end. */
  private spin(): void {
    const map = this.map;
    if (!map) return;
    const start = performance.now();
    this.spinning = true;
    const skip = (): void => {
      this.endIntro();
      this.stopSpin();
      map.stop();
      this.jumpToNarino();
    };
    this.endIntro = () => {
      this.endIntro = () => false;
      for (const type of SKIP_EVENTS) map.off(type, skip);
      return true;
    };
    for (const type of SKIP_EVENTS) map.on(type, skip);
    const frame = (now: number): void => {
      if (!this.spinning) return;
      const elapsed = now - start;
      if (elapsed >= SPIN_MS) {
        this.stopSpin();
        this.flyToNarino();
        return;
      }
      map.setCenter(spinCenter(elapsed));
      this.spinFrame = requestAnimationFrame(frame);
    };
    this.spinFrame = requestAnimationFrame(frame);
  }

  /** The faint orange halo at the edge of the globe (MapLibre's own atmosphere is blue and fixed). */
  private placeGlow(): void {
    const map = this.map;
    const glow = this.glow().nativeElement;
    const halo = map
      ? globeHalo({
          zoom: map.getZoom(),
          centerLatitude: map.getCenter().lat,
          width: map.getContainer().clientWidth,
          height: map.getContainer().clientHeight,
          padding: map.getPadding(),
        })
      : null;
    if (!halo) {
      glow.style.opacity = '0';
      return;
    }
    const outer = halo.radius + GLOW_WIDTH;
    glow.style.opacity = String(halo.opacity);
    glow.style.width = glow.style.height = `${outer * 2}px`;
    glow.style.transform = `translate(${halo.x - outer}px, ${halo.y - outer}px)`;
    glow.style.setProperty('--edge', `${(halo.radius / outer) * 100}%`);
  }

  /** Ends the spin; false if it had already ended. */
  private stopSpin(): boolean {
    if (!this.spinning) return false;
    this.spinning = false;
    if (this.spinFrame !== undefined) cancelAnimationFrame(this.spinFrame);
    return true;
  }

  /** Height of the overview sheet, by layout (its entry animation only moves it). */
  private sheetHeight(): number {
    return this.overview()?.nativeElement.offsetHeight ?? 0;
  }

  /** Nariño as large as fits between the header and the sheet, tilted. Same for the intro and the button. */
  private narinoCamera() {
    const camera = this.map?.cameraForBounds(NARINO_BOUNDS, { padding: narinoPadding(this.sheetHeight()), pitch: PITCH });
    return camera && { ...camera, pitch: PITCH, padding: NO_PADDING };
  }

  /** The intro flight is essential (reduced motion never gets here); the button's is not. */
  private flyToNarino(essential = true): void {
    const map = this.map;
    const camera = this.narinoCamera();
    if (!map || !camera) return;
    this.framingNarino = false;
    const move = ++this.cameraMove;
    map.once('moveend', () => {
      // A skip or another flight took over: that one finishes the work.
      if (move !== this.cameraMove) return;
      this.endIntro();
      this.limitToNarino();
      this.framingNarino = true;
    });
    map.flyTo({ ...camera, duration: FLY_MS, essential });
  }

  /** The sheet changed height while showing the department: frame it again above the sheet. */
  private reframeNarino(): void {
    const camera = this.narinoCamera();
    if (camera) this.map?.easeTo({ ...camera, duration: 350 });
  }

  private jumpToNarino(): void {
    const map = this.map;
    const camera = this.narinoCamera();
    if (!map || !camera) return;
    this.cameraMove++;
    map.jumpTo(camera);
    this.limitToNarino();
    this.framingNarino = true;
  }

  /** Once over Nariño the camera stays around it. */
  private limitToNarino(): void {
    this.map?.setMaxBounds(MAX_BOUNDS);
    this.map?.setMinZoom(MIN_ZOOM_OVER_NARINO);
  }

  /**
   * Non-essential: MapLibre jumps instead of flying when the phone asks for reduced motion. A zone
   * picked during the spin wins over the flight to Nariño; the camera is limited once it lands.
   */
  private flyToSeat(longitude: number, latitude: number, duration = ZONE_FLY_MS): void {
    const fromIntro = this.endIntro();
    this.stopSpin();
    this.cameraMove++;
    this.framingNarino = false;
    this.map?.flyTo({
      center: [longitude, latitude], zoom: ZONE_ZOOM, pitch: PITCH, offset: SEAT_OFFSET, padding: NO_PADDING, duration,
    });
    // Cut short, the intro never limited the camera: the seat's flight does it when it lands (registered
    // after flyTo, which ends the intro's own flight with a moveend).
    if (fromIntro) this.map?.once('moveend', () => this.limitToNarino());
  }

  private showUser(latitude: number, longitude: number): void {
    const map = this.map;
    if (!map) return;
    this.userMarker?.remove();
    const element = document.createElement('div');
    element.className = 'user-icon';
    element.innerHTML = '<span class="user-dot"></span>';
    this.userMarker = new Marker({ element }).setLngLat([longitude, latitude]).addTo(map);
  }

  private source(id: string): GeoJSONSource | undefined {
    return this.map?.getSource<GeoJSONSource>(id);
  }
}
