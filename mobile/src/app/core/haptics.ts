import { Injectable, inject } from '@angular/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SettingsStore } from '../state/settings.store';

/** A light tap on the phone (nothing in the browser), unless «Vibración» is off in Ajustes. */
@Injectable({ providedIn: 'root' })
export class Haptic {
  private readonly settings = inject(SettingsStore);

  tap(): void {
    if (!this.settings.haptics()) return;
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  }
}
