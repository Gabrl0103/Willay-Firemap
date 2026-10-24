import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Haptic } from '../../../core/haptics';
import { I18n } from '../../../i18n/i18n';
import { TranslatePipe } from '../../../i18n/t.pipe';
import type { MessageKey } from '../../../i18n/translate';
import { SettingsStore, type Settings } from '../../../state/settings.store';
import { AppIcon } from '../../components/app-icon/app-icon';
import { LavaBg } from '../../components/lava-bg/lava-bg';

interface Choice<T> {
  readonly value: T;
  readonly label: MessageKey;
}

export const LANGUAGE_CHOICES: readonly Choice<Settings['language']>[] = [
  { value: 'auto', label: 'settings.auto' },
  { value: 'es', label: 'settings.spanish' },
  { value: 'en', label: 'settings.english' },
];
export const TEMPERATURE_CHOICES: readonly Choice<Settings['temperature']>[] = [
  { value: 'c', label: 'units.celsius' },
  { value: 'f', label: 'units.fahrenheit' },
];
export const WIND_CHOICES: readonly Choice<Settings['wind']>[] = [
  { value: 'kmh', label: 'units.kmh' },
  { value: 'mph', label: 'units.mph' },
];

/** «Ajustes»: opened from the gear of Inicio. Every choice applies at once and is saved on the phone. */
@Component({
  selector: 'app-settings-page',
  imports: [AppIcon, LavaBg, TranslatePipe],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.css',
  host: { class: 'ion-page' },
})
export class SettingsPage {
  protected readonly settings = inject(SettingsStore);
  protected readonly i18n = inject(I18n);
  private readonly router = inject(Router);
  private readonly haptic = inject(Haptic);

  protected readonly languages = LANGUAGE_CHOICES;
  protected readonly temperatures = TEMPERATURE_CHOICES;
  protected readonly winds = WIND_CHOICES;

  protected back(): void {
    void this.router.navigateByUrl('/home');
  }

  protected choose(change: Partial<Settings>): void {
    void this.settings.update(change);
  }

  protected toggleHaptics(): void {
    const on = !this.settings.haptics();
    void this.settings.update({ haptics: on }).then(() => this.haptic.tap());
  }
}
