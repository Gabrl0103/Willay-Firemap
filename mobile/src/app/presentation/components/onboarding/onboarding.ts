import { Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { OnboardingFlag } from '../../../core/onboarding-flag';
import { AppIcon } from '../app-icon/app-icon';
import { LavaBg } from '../lava-bg/lava-bg';
import { Logo } from '../logo/logo';
import { RiskBadge } from '../risk-badge/risk-badge';

/** Pesos del puntaje (los mismos de SCORE_WEIGHTS en el backend). */
const SCORE_FACTORS = [
  { label: 'Clima seco', weight: 50 },
  { label: 'Focos cercanos', weight: 30 },
  { label: 'Historial', weight: 20 },
] as const;

const PAGE_COUNT = 3;
const FADE_OUT_MS = 400;

/** Introducción de 3 pantallas. Solo sale la primera vez. */
@Component({
  selector: 'app-onboarding',
  imports: [AppIcon, LavaBg, Logo, RiskBadge],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.css',
  host: { '[class.leaving]': 'leaving()' },
})
export class Onboarding {
  private readonly flag = inject(OnboardingFlag);
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  readonly finished = output<void>();
  protected readonly factors = SCORE_FACTORS;
  protected readonly pages = Array.from({ length: PAGE_COUNT }, (_, i) => i);
  protected readonly index = signal(0);
  protected readonly leaving = signal(false);

  protected isLast(): boolean {
    return this.index() === PAGE_COUNT - 1;
  }

  protected onScroll(): void {
    const el = this.track().nativeElement;
    this.index.set(Math.round(el.scrollLeft / el.clientWidth));
  }

  protected next(): void {
    if (this.isLast()) {
      this.finish();
      return;
    }
    this.goTo(this.index() + 1);
  }

  protected goTo(page: number): void {
    const el = this.track().nativeElement;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: page * el.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
    this.index.set(page);
  }

  protected finish(): void {
    if (this.leaving()) return;
    this.leaving.set(true);
    void this.flag.markDone();
    setTimeout(() => this.finished.emit(), FADE_OUT_MS);
  }
}
