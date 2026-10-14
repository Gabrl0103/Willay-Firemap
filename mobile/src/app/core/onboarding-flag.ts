import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

const KEY = 'onboarding.done';

/** Recuerda si ya se vio la introducción (Preferences: almacenamiento nativo; localStorage en el navegador). */
@Injectable({ providedIn: 'root' })
export class OnboardingFlag {
  async isDone(): Promise<boolean> {
    try {
      const { value } = await Preferences.get({ key: KEY });
      return value === '1';
    } catch {
      return false;
    }
  }

  async markDone(): Promise<void> {
    try {
      await Preferences.set({ key: KEY, value: '1' });
    } catch {
      // Sin almacenamiento la introducción volverá a salir; no es motivo para bloquear la app.
    }
  }
}
