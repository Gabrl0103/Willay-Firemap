import {
  Component, ElementRef, OnDestroy, afterNextRender, computed, inject, input, output, signal, viewChild,
} from '@angular/core';
import type { ZoneDetail, ZoneForecast, ZoneRiskSummary } from '../../../domain/model/risk';
import { formatDecimal, formatPercent, formatTimeAgo, formatUpdatedDay } from '../../../domain/util/format';
import { riskLabel } from '../../../domain/util/risk-labels';
import { formatTemperature, formatWind } from '../../../domain/util/units';
import { I18n } from '../../../i18n/i18n';
import { TranslatePipe } from '../../../i18n/t.pipe';
import type { MessageKey, MessageParams, PluralKey } from '../../../i18n/translate';
import { SettingsStore } from '../../../state/settings.store';
import type { ForecastStatus } from '../../../state/zones.store';
import { AppIcon, type IconName } from '../app-icon/app-icon';
import { ForecastSection } from '../forecast-section/forecast-section';
import { RiskBadge } from '../risk-badge/risk-badge';
import { FULL_HEIGHT, clampOffset, resolveSnap, snapOffset, type SheetSnap } from './sheet-snap';

/** Movement (px) below which a press on the handle is a tap, not a drag. */
const TAP_SLOP = 6;
/** A finger that stops this long (ms) before lifting releases with no speed. */
const STILL_MS = 100;
/** Same as the transform transition in sheet-frame.css. */
const SLIDE_MS = 320;
/** Score ring: 92 px wide with a 9 px stroke (zone-sheet.css). */
const RING_RADIUS = 41.5;
const RING_TOTAL = 2 * Math.PI * RING_RADIUS;

interface DragState {
  readonly pointerId: number;
  readonly startY: number;
  readonly startOffset: number;
  readonly sheetHeight: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  moved: boolean;
}

/** One value of «Clima ahora»: its icon, the value in the chosen unit and what it is. */
interface WeatherItem {
  readonly icon: IconName;
  readonly value: string;
  readonly label: MessageKey | PluralKey;
  readonly params?: MessageParams;
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

@Component({
  selector: 'app-zone-sheet',
  imports: [AppIcon, ForecastSection, RiskBadge, TranslatePipe],
  template: `
    <div class="sheet-layer" [class.is-closing]="snap() === 'closed'">
      <button type="button" class="sheet-backdrop" [attr.aria-label]="'sheet.close' | t" (click)="close()"></button>
      <button type="button" class="sheet-back" [attr.aria-label]="'sheet.back' | t" (click)="close()">
        <app-icon name="chevron-left" [size]="22" /><span>Nariño</span>
      </button>
      <p class="sheet-notice" role="status">
        @if (notice(); as text) {
          <span class="notice-pill">{{ text }}</span>
        }
      </p>
      <section
        #sheet
        class="zone-sheet"
        [class.is-dragging]="dragOffset() !== null"
        [class.is-expanded]="snap() === 'full'"
        [style.height.%]="fullHeightPct"
        [style.transform]="transform()"
        [attr.aria-label]="'sheet.label' | t"
      >
        <div
          class="sheet-drag-area"
          (pointerdown)="onPointerDown($event)"
          (pointermove)="onPointerMove($event)"
          (pointerup)="onPointerUp($event)"
          (pointercancel)="onPointerCancel($event)"
        >
          <button
            type="button"
            class="sheet-handle"
            [attr.aria-label]="(snap() === 'full' ? 'sheet.collapse' : 'sheet.expand') | t"
            [attr.aria-expanded]="snap() === 'full'"
            (click)="toggle()"
          >
            <span></span>
          </button>

          <header class="zone-heading">
            <div class="zone-title">
              <h2>{{ risk().name }}</h2>
              <p>Nariño{{ updated() }}</p>
              <div class="zone-meta">
                <app-risk-badge [level]="risk().level" />
                <button
                  type="button"
                  class="icon-action favorite-toggle"
                  [class.is-on]="favorite()"
                  [attr.aria-pressed]="favorite()"
                  [attr.aria-label]="(favorite() ? 'sheet.removeFavorite' : 'sheet.addFavorite') | t"
                  (click)="favoriteToggled.emit()"
                >
                  <app-icon [name]="favorite() ? 'heart-filled' : 'heart'" [size]="22" />
                </button>
                <button type="button" class="icon-action share-button" [attr.aria-label]="'sheet.share' | t" (click)="shareRequested.emit()">
                  <app-icon name="share" [size]="20" />
                </button>
              </div>
            </div>
            <div
              class="score-ring"
              [class]="'risk-' + risk().level"
              role="img"
              [attr.aria-label]="'sheet.scoreAria' | t: { score: risk().score, level: riskLabel() }"
            >
              <svg viewBox="0 0 92 92" aria-hidden="true">
                <circle class="ring-track" cx="46" cy="46" [attr.r]="ringRadius" />
                <circle
                  class="ring-value anim-ring"
                  cx="46"
                  cy="46"
                  [attr.r]="ringRadius"
                  [attr.stroke-dasharray]="ringValue() + ' ' + ringTotal"
                  [style.--ring-value]="ringValue()"
                  [style.--ring-total]="ringTotal"
                />
              </svg>
              <strong class="mono">{{ risk().score }}</strong>
              <span>{{ riskLabel() }}</span>
            </div>
          </header>
        </div>

        <div class="zone-content">
          @if (weather(); as items) {
            @if (items.length > 0) {
              <section class="weather" aria-labelledby="weather-title">
                <h3 id="weather-title" class="factors-title">{{ 'weather.title' | t }}</h3>
                <ul class="weather-row">
                  @for (item of items; track item.label) {
                    <li class="stat-tile">
                      <app-icon [name]="item.icon" [size]="16" />
                      <b class="mono">{{ item.value }}</b>
                      <small>{{ item.label | t: item.params }}</small>
                    </li>
                  }
                </ul>
              </section>
            }
          } @else {
            <div class="weather weather-skeleton skeleton" aria-hidden="true"></div>
          }
          <h3 class="factors-title">{{ 'sheet.factorsTitle' | t }}</h3>
          @for (factor of factors(); track factor.label; let i = $index) {
            <div class="factor">
              <div class="factor-head">
                <span>{{ factor.label | t }} <small>· <span class="mono">{{ factor.weight }} %</span></small></span>
                @if (factor.value !== null) {
                  <b class="mono">{{ factor.value }}</b>
                } @else {
                  <span class="skeleton factor-value-skeleton" aria-hidden="true"></span>
                }
              </div>
              <div class="factor-track" [class.skeleton]="factor.value === null">
                @if (factor.value !== null) {
                  <span class="anim-growx" [style.--i]="i + 1" [style.width.%]="factor.value"></span>
                }
              </div>
            </div>
          }

          @if (!detail() || detail()?.hotspots || perYear() !== null) {
            <div class="stats">
              @if (detail()?.hotspots; as hotspots) {
                <div class="stat-tile hotspots-stat">
                  <b class="mono">{{ hotspots.count }}</b>
                  <span>{{ 'sheet.hotspotsNear' | t: { count: hotspots.count } }}</span>
                  @if (latestHotspot(); as latest) {
                    <small>{{ 'sheet.latest' | t: { ago: latest } }}</small>
                  }
                </div>
              } @else if (!detail()) {
                <div class="stat-tile skeleton stat-skeleton" aria-hidden="true"></div>
              }
              @if (perYear(); as perYear) {
                <div class="stat-tile fires-stat">
                  <b class="mono">{{ perYear }}</b>
                  <span>{{ 'sheet.firesPerYear' | t }}</span>
                </div>
              }
            </div>
          }

          <app-forecast-section [forecast]="forecast()" [status]="forecastStatus()" (retry)="forecastRetry.emit()" />

          <button type="button" class="history-cta" (click)="historyRequested.emit()">
            {{ 'sheet.history' | t: { name: risk().name } }}
          </button>
          <p class="disclaimer">{{ 'sheet.disclaimer' | t }}</p>
        </div>
      </section>
    </div>
  `,
  styleUrls: ['./sheet-frame.css', './zone-sheet.css'],
})
export class ZoneSheet implements OnDestroy {
  /** The zone as the map has it: the sheet opens with it at once, without waiting for the network. */
  readonly zone = input.required<ZoneRiskSummary>();
  /** Arrives a moment later (GET /zones/:id): the nearby hotspots, and the factors if the zone had none. */
  readonly detail = input<ZoneDetail | null>(null);
  /** When the zones were loaded; null leaves the "actualizado" text out. */
  readonly updatedAt = input<Date | null>(null);
  /** Average fires per year of the zone (from its records); null leaves the card out. */
  readonly firesPerYear = input<number | null>(null);
  /** 72 h forecast of the zone (ML model or its fallback) and whether it is still loading or failed. */
  readonly forecast = input<ZoneForecast | null>(null);
  readonly forecastStatus = input<ForecastStatus>('idle');
  readonly forecastRetry = output<void>();
  /** Whether the zone is among «Mis municipios»; the heart only asks the page to change it. */
  readonly favorite = input(false);
  readonly favoriteToggled = output<void>();
  /** «Compartir»: the page builds the text with the data on screen and sends it. */
  readonly shareRequested = output<void>();
  /** A short notice over the map («Copiado»); null hides it. */
  readonly notice = input<string | null>(null);
  readonly closed = output<void>();
  readonly historyRequested = output<void>();

  private readonly sheet = viewChild.required<ElementRef<HTMLElement>>('sheet');
  /** Starts hidden and slides up to mid once rendered. */
  protected readonly snap = signal<SheetSnap>('closed');
  /** Offset (px) while the finger moves the sheet; null when it rests on a snap position. */
  protected readonly dragOffset = signal<number | null>(null);
  protected readonly fullHeightPct = FULL_HEIGHT * 100;
  protected readonly transform = computed(() => {
    const offset = this.dragOffset();
    if (offset !== null) return `translateY(${offset}px)`;
    // Percentages of the sheet's own height, so no measuring is needed at rest.
    return `translateY(${snapOffset(this.snap(), 100)}%)`;
  });

  private drag?: DragState;
  /** The click that follows a drag on the handle must not toggle the sheet. */
  private suppressClick = false;
  private closeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    afterNextRender(() => requestAnimationFrame(() => this.snap.set('mid')));
  }

  ngOnDestroy(): void {
    clearTimeout(this.closeTimer);
  }

  protected toggle(): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.snap.set(this.snap() === 'full' ? 'mid' : 'full');
  }

  /** Slides the sheet down, then tells the page to remove it. */
  protected close(): void {
    if (this.closeTimer) return;
    this.snap.set('closed');
    this.closeTimer = setTimeout(() => this.closed.emit(), SLIDE_MS);
  }

  protected onPointerDown(event: PointerEvent): void {
    this.suppressClick = false;
    if (event.button !== 0) return;
    const sheetHeight = this.sheet().nativeElement.offsetHeight;
    this.drag = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startOffset: snapOffset(this.snap(), sheetHeight),
      sheetHeight,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0,
      moved: false,
    };
  }

  protected onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.abs(dy) < TAP_SLOP) return;
      drag.moved = true;
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
    }
    const dt = event.timeStamp - drag.lastTime;
    if (dt > 0) drag.velocity = (event.clientY - drag.lastY) / dt;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    this.dragOffset.set(clampOffset(drag.startOffset + dy, drag.sheetHeight));
  }

  protected onPointerUp(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    this.drag = undefined;
    if (!drag.moved) return;
    this.suppressClick = true;
    const offset = this.dragOffset() ?? drag.startOffset;
    const velocity = event.timeStamp - drag.lastTime > STILL_MS ? 0 : drag.velocity;
    this.dragOffset.set(null);
    const target = resolveSnap(offset, velocity, drag.sheetHeight);
    if (target === 'closed') this.close();
    else this.snap.set(target);
  }

  protected onPointerCancel(event: PointerEvent): void {
    if (event.pointerId !== this.drag?.pointerId) return;
    this.drag = undefined;
    this.dragOffset.set(null);
  }

  protected readonly ringRadius = RING_RADIUS;
  protected readonly ringTotal = RING_TOTAL;
  /** Name, score and level: the detail's once it arrives, the map's until then. */
  protected readonly risk = computed(() => this.detail() ?? this.zone());
  protected readonly ringValue = computed(() => (Math.min(Math.max(this.risk().score, 0), 100) / 100) * RING_TOTAL);
  private readonly i18n = inject(I18n);
  protected readonly riskLabel = computed(() => riskLabel(this.risk().level, this.i18n.language()));
  protected readonly updated = computed(() => {
    const date = this.updatedAt();
    return date ? ` · ${this.i18n.t('sheet.updated', { day: formatUpdatedDay(date, this.i18n.language()) })}` : '';
  });
  protected readonly latestHotspot = computed(() => {
    const hotspots = this.detail()?.hotspots;
    return hotspots?.count && hotspots.latestDetectedAt ? formatTimeAgo(hotspots.latestDetectedAt, this.i18n.language()) : '';
  });
  private readonly settings = inject(SettingsStore);
  /**
   * «Clima ahora» from the detail, in the units of Ajustes (the API sends °C and km/h). A value the
   * API did not send is left out; null while the detail has not arrived (a placeholder keeps its room).
   */
  protected readonly weather = computed((): WeatherItem[] | null => {
    const detail = this.detail();
    if (!detail) return null;
    const weather: Partial<ZoneDetail['weather']> = detail.weather ?? {};
    const language = this.i18n.language();
    const items: WeatherItem[] = [];
    if (isNumber(weather.temperatureC)) {
      const value = formatTemperature(weather.temperatureC, this.settings.temperature(), language);
      items.push({ icon: 'thermometer', value, label: 'weather.temperature' });
    }
    if (isNumber(weather.humidityPct)) {
      items.push({ icon: 'droplet', value: formatPercent(Math.round(weather.humidityPct), language), label: 'weather.humidity' });
    }
    if (isNumber(weather.windKmh)) {
      items.push({ icon: 'wind', value: formatWind(weather.windKmh, this.settings.wind(), language), label: 'weather.wind' });
    }
    if (isNumber(weather.daysWithoutRain)) {
      const count = Math.round(weather.daysWithoutRain);
      items.push({ icon: 'calendar', value: String(count), label: 'weather.dryDays', params: { count } });
    }
    return items;
  });
  /** 2.08 -> "2,1" | "2.1"; null leaves the card out. */
  protected readonly perYear = computed(() => {
    const value = this.firesPerYear();
    return value === null ? null : formatDecimal(value, this.i18n.language());
  });

  /**
   * Weights from backend/src/domain/service/RiskScoringService.ts (SCORE_WEIGHTS). A null value is a
   * placeholder: an older backend sends no factors in the zone list, so they wait for the detail.
   */
  protected readonly factors = computed((): { label: MessageKey; weight: number; value: number | null }[] => {
    const f = this.detail()?.factors ?? this.zone().factors;
    return [
      { label: 'factor.dryWeather', weight: 50, value: f?.dryWeather ?? null },
      { label: 'factor.nearbyHotspots', weight: 30, value: f?.nearbyHotspots ?? null },
      { label: 'factor.fireHistory', weight: 20, value: f?.fireHistory ?? null },
    ];
  });
}
