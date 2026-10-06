import {
  Component, ElementRef, OnDestroy, afterNextRender, computed, input, output, signal, viewChild,
} from '@angular/core';
import type { ZoneDetail } from '../../../domain/model/risk';
import { formatDecimal, formatTimeAgo, formatUpdatedDay } from '../../../domain/util/format';
import { RISK_LABELS } from '../../../domain/util/risk-labels';
import { AppIcon } from '../app-icon/app-icon';
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

@Component({
  selector: 'app-zone-sheet',
  imports: [AppIcon, RiskBadge],
  template: `
    <div class="sheet-layer" [class.is-closing]="snap() === 'closed'">
      <button type="button" class="sheet-backdrop" aria-label="Cerrar detalle" (click)="close()"></button>
      <button type="button" class="sheet-back" aria-label="Volver a Nariño" (click)="close()">
        <app-icon name="chevron-left" [size]="22" /><span>Nariño</span>
      </button>
      <section
        #sheet
        class="zone-sheet"
        [class.is-dragging]="dragOffset() !== null"
        [class.is-expanded]="snap() === 'full'"
        [style.height.%]="fullHeightPct"
        [style.transform]="transform()"
        aria-label="Detalle de zona"
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
            [attr.aria-label]="snap() === 'full' ? 'Reducir detalle' : 'Expandir detalle'"
            [attr.aria-expanded]="snap() === 'full'"
            (click)="toggle()"
          >
            <span></span>
          </button>

          <header class="zone-heading">
            <div class="zone-title">
              <h2>{{ detail().name }}</h2>
              <p>Nariño{{ updated() }}</p>
              <app-risk-badge [level]="detail().level" />
            </div>
            <div
              class="score-ring"
              [class]="'risk-' + detail().level"
              role="img"
              [attr.aria-label]="'Puntaje ' + detail().score + ' de 100, ' + riskLabel()"
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
              <strong class="mono">{{ detail().score }}</strong>
              <span>{{ riskLabel() }}</span>
            </div>
          </header>
        </div>

        <div class="zone-content">
          <h3 class="factors-title">De qué depende el puntaje</h3>
          @for (factor of factors(); track factor.label; let i = $index) {
            <div class="factor">
              <div class="factor-head">
                <span>{{ factor.label }} <small>· <span class="mono">{{ factor.weight }} %</span></small></span>
                <b class="mono">{{ factor.value }}</b>
              </div>
              <div class="factor-track">
                <span class="anim-growx" [style.--i]="i + 1" [style.width.%]="factor.value"></span>
              </div>
            </div>
          }

          @if (detail().hotspots || firesPerYear() !== null) {
            <div class="stats">
              @if (detail().hotspots; as hotspots) {
                <div class="stat-tile hotspots-stat">
                  <b class="mono">{{ hotspots.count }}</b>
                  <span>{{ hotspots.count === 1 ? 'foco' : 'focos' }} a menos de 25 km</span>
                  @if (latestHotspot(); as latest) {
                    <small>el último, {{ latest }}</small>
                  }
                </div>
              }
              @if (firesPerYear(); as perYear) {
                <div class="stat-tile fires-stat">
                  <b class="mono">{{ perYear }}</b>
                  <span>incendios por año</span>
                </div>
              }
            </div>
          }

          <button type="button" class="history-cta" (click)="historyRequested.emit()">
            Ver historial de {{ detail().name }}
          </button>
          <p class="disclaimer">
            Datos simulados para fines académicos. El riesgo no confirma la ocurrencia de un incendio.
          </p>
        </div>
      </section>
    </div>
  `,
  styleUrls: ['./sheet-frame.css', './zone-sheet.css'],
})
export class ZoneSheet implements OnDestroy {
  readonly detail = input.required<ZoneDetail>();
  /** When the zones were loaded; null leaves the "actualizado" text out. */
  readonly updatedAt = input<Date | null>(null);
  /** Average fires per year of the zone (from its records); null leaves the card out. */
  readonly firesPerYear = input<string | null, number | null>(null, { transform: perYearLabel });
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
  protected readonly ringValue = computed(() => (Math.min(Math.max(this.detail().score, 0), 100) / 100) * RING_TOTAL);
  protected readonly riskLabel = computed(() => RISK_LABELS[this.detail().level]);
  protected readonly updated = computed(() => {
    const date = this.updatedAt();
    return date ? ` · actualizado ${formatUpdatedDay(date)}` : '';
  });
  protected readonly latestHotspot = computed(() => {
    const hotspots = this.detail().hotspots;
    return hotspots?.count && hotspots.latestDetectedAt ? formatTimeAgo(hotspots.latestDetectedAt) : '';
  });

  /** Weights from backend/src/domain/service/RiskScoringService.ts (SCORE_WEIGHTS). */
  protected readonly factors = computed(() => {
    const f = this.detail().factors;
    return [
      { label: 'Clima seco', weight: 50, value: f.dryWeather },
      { label: 'Focos cercanos', weight: 30, value: f.nearbyHotspots },
      { label: 'Historial', weight: 20, value: f.fireHistory },
    ];
  });
}

/** 2.08 -> "2,1"; null stays null. */
function perYearLabel(value: number | null): string | null {
  return value === null ? null : formatDecimal(value);
}
