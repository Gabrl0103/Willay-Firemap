import {
  Component, ElementRef, OnDestroy, afterNextRender, computed, input, output, signal, viewChild,
} from '@angular/core';
import type { ZoneDetail } from '../../../domain/model/risk';
import { formatTimeAgo } from '../../../domain/util/format';
import { RISK_LABELS } from '../../../domain/util/risk-labels';
import { AppIcon, type IconName } from '../app-icon/app-icon';
import { FULL_HEIGHT, clampOffset, resolveSnap, snapOffset, type SheetSnap } from './sheet-snap';

/** Movement (px) below which a press on the handle is a tap, not a drag. */
const TAP_SLOP = 6;
/** A finger that stops this long (ms) before lifting releases with no speed. */
const STILL_MS = 100;
/** Same as the transform transition in zone-sheet.css. */
const SLIDE_MS = 320;

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
  imports: [AppIcon],
  template: `
    <div class="sheet-layer" [class.is-closing]="snap() === 'closed'">
      <button type="button" class="sheet-backdrop" aria-label="Cerrar detalle" (click)="close()"></button>
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
          <button type="button" class="sheet-close" aria-label="Cerrar" (click)="close()">
            <app-icon name="x" [size]="16" />
          </button>

          <header class="zone-cover">
            <div class="zone-cover-lines"></div>
            <div class="zone-heading">
              <div>
                <span class="eyebrow">Zona seleccionada</span>
                <h2>{{ detail().name }}</h2>
                <p>Riesgo próximas 24–72 h</p>
              </div>
              <div class="score-block" [class]="'risk-' + detail().level">
                <strong>{{ detail().score }}</strong><span>/100</span>
                <b>{{ level() }}</b>
              </div>
            </div>
          </header>
        </div>

        <div class="zone-content">
          <div class="section-heading"><span>Condiciones actuales</span><small>Ahora</small></div>
          <div class="weather-grid">
            @for (item of weather(); track item.label) {
              <div class="weather-item">
                <app-icon [name]="item.icon" [size]="17" />
                <strong>{{ item.value }}</strong>
                <small>{{ item.label }}</small>
              </div>
            }
          </div>

          <div class="factors">
            <div class="section-heading"><span>Factores de riesgo</span><small>Contribución</small></div>
            @for (factor of factors(); track factor.label) {
              <div class="factor">
                <div><span>{{ factor.label }}</span><b>{{ factor.value }}%</b></div>
                <div class="factor-track"><span [style.width.%]="factor.value"></span></div>
                @if (factor.note) {
                  <small class="factor-note">{{ factor.note }}</small>
                }
              </div>
            }
          </div>

          <button type="button" class="history-cta" (click)="historyRequested.emit()">
            <app-icon name="history" [size]="16" />
            <span>Ver historial de {{ detail().name }}</span>
            <app-icon name="chevron-right" [size]="16" />
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
    if (event.button !== 0 || (event.target as Element).closest('.sheet-close')) return;
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

  protected readonly level = computed(() => RISK_LABELS[this.detail().level]);

  protected readonly weather = computed<{ icon: IconName; value: string; label: string }[]>(() => {
    const w = this.detail().weather;
    return [
      { icon: 'thermometer', value: `${w.temperatureC}°`, label: 'Temperatura' },
      { icon: 'droplet', value: `${w.humidityPct}%`, label: 'Humedad' },
      { icon: 'wind', value: `${w.windKmh}`, label: 'Viento km/h' },
      { icon: 'calendar', value: `${w.daysWithoutRain}`, label: 'Días sin lluvia' },
    ];
  });

  protected readonly factors = computed(() => {
    const { factors: f, hotspots } = this.detail();
    return [
      { label: 'Clima seco', value: f.dryWeather, note: '' },
      { label: 'Focos de calor cercanos', value: f.nearbyHotspots, note: hotspotNote(hotspots) },
      { label: 'Historial de incendios', value: f.fireHistory, note: '' },
    ];
  });
}

/** "2 focos a 25 km o menos · el último, hace 3 días" (empty when the backend does not send it). */
export function hotspotNote(hotspots: ZoneDetail['hotspots']): string {
  if (!hotspots) return '';
  if (hotspots.count === 0 || !hotspots.latestDetectedAt) return 'Sin focos a 25 km o menos en los últimos 5 días';
  const count = hotspots.count === 1 ? '1 foco' : `${hotspots.count} focos`;
  return `${count} a 25 km o menos · el último, ${formatTimeAgo(hotspots.latestDetectedAt)}`;
}
