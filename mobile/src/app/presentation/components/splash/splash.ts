import { Component, DestroyRef, inject, output, signal } from '@angular/core';
import { TranslatePipe } from '../../../i18n/t.pipe';
import { LavaBg } from '../lava-bg/lava-bg';
import { Logo } from '../logo/logo';

/** Tiempo visible de la splash antes del fundido. */
export const SPLASH_DURATION_MS = 2500;
const FADE_OUT_MS = 450;

/** Splash animada sobre la lámpara de lava. Mientras se ve, la app carga los datos por detrás. */
@Component({
  selector: 'app-splash',
  imports: [LavaBg, Logo, TranslatePipe],
  template: `
    <app-lava-bg />
    <div class="brand">
      <app-logo variant="light" [size]="58" [intro]="true" />
    </div>
    <p class="tagline">{{ 'splash.tagline' | t }}</p>
    <p class="loading">{{ 'common.loading' | t }}</p>
  `,
  styleUrl: './splash.css',
  host: { '[class.leaving]': 'leaving()' },
})
export class Splash {
  readonly finished = output<void>();
  protected readonly leaving = signal(false);

  constructor() {
    const fadeTimer = setTimeout(() => this.leaving.set(true), SPLASH_DURATION_MS);
    const doneTimer = setTimeout(() => this.finished.emit(), SPLASH_DURATION_MS + FADE_OUT_MS);
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    });
  }
}
