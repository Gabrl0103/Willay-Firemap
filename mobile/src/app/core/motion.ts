import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import { SettingsStore } from '../state/settings.store';

/** Class on <html> while «Movimiento» is «Reducido»: base.css stops the animations as the phone setting does. */
export const REDUCE_MOTION_CLASS = 'reduce-motion';

/**
 * Whether the app should move: «Automático» follows the phone (prefers-reduced-motion), «Reducido»
 * stops the map's entry and flights, the lava particles and the entry animations whatever it says.
 */
@Injectable({ providedIn: 'root' })
export class Motion {
  private readonly settings = inject(SettingsStore);
  private readonly system = signal(false);

  readonly reduced = computed(() => this.settings.motion() === 'reduced' || this.system());

  constructor() {
    const document = inject(DOCUMENT);
    const query = document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (query) {
      this.system.set(query.matches);
      query.addEventListener?.('change', (event) => this.system.set(event.matches));
    }
    const apply = (): void => {
      document.documentElement.classList.toggle(REDUCE_MOTION_CLASS, this.settings.motion() === 'reduced');
    };
    // At once (the splash is already on screen) and on every change.
    apply();
    effect(apply);
  }
}
