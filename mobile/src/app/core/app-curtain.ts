import { Injectable } from '@angular/core';

/**
 * Avisa cuando la splash y la introducción ya no tapan la app. El mapa espera esto para girar el
 * globo: si arranca debajo de la splash, la entrada termina sin que nadie la vea.
 */
@Injectable({ providedIn: 'root' })
export class AppCurtain {
  private open!: () => void;
  readonly lifted = new Promise<void>((resolve) => (this.open = resolve));

  lift(): void {
    this.open();
  }
}
