import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Haptic } from '../../../core/haptics';
import { I18n } from '../../../i18n/i18n';
import { TranslatePipe } from '../../../i18n/t.pipe';
import type { MessageKey } from '../../../i18n/translate';
import { FavoritesStore } from '../../../state/favorites.store';
import { SettingsStore, type Settings } from '../../../state/settings.store';
import { ZonesStore } from '../../../state/zones.store';
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
export const MOTION_CHOICES: readonly Choice<Settings['motion']>[] = [
  { value: 'auto', label: 'settings.auto' },
  { value: 'reduced', label: 'settings.reduced' },
];

/** How long (ms) «Listo» stays after clearing the data cache. */
const DONE_MS = 2000;

/** «Ajustes»: opened from the gear of Inicio. Every choice applies at once and is saved on the phone. */
@Component({
  selector: 'app-settings-page',
  imports: [AppIcon, LavaBg, TranslatePipe],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.css',
  host: { class: 'ion-page' },
})
export class SettingsPage implements OnDestroy {
  protected readonly settings = inject(SettingsStore);
  protected readonly i18n = inject(I18n);
  private readonly router = inject(Router);
  private readonly haptic = inject(Haptic);
  protected readonly favorites = inject(FavoritesStore);
  private readonly zones = inject(ZonesStore);

  protected readonly languages = LANGUAGE_CHOICES;
  protected readonly temperatures = TEMPERATURE_CHOICES;
  protected readonly winds = WIND_CHOICES;
  protected readonly motions = MOTION_CHOICES;
  /** «Borrar favoritos» asks once more, in the same row, before clearing. */
  protected readonly confirmingClear = signal(false);
  protected readonly cacheCleared = signal(false);
  private doneTimer?: ReturnType<typeof setTimeout>;

  ngOnDestroy(): void {
    clearTimeout(this.doneTimer);
  }

  protected back(): void {
    void this.router.navigateByUrl('/home');
  }

  protected choose(change: Partial<Settings>): void {
    void this.settings.update(change);
  }

  protected clearFavorites(): void {
    this.confirmingClear.set(false);
    void this.favorites.clear();
  }

  protected clearCache(): void {
    this.zones.clearCache();
    clearTimeout(this.doneTimer);
    this.cacheCleared.set(true);
    this.doneTimer = setTimeout(() => this.cacheCleared.set(false), DONE_MS);
  }

  protected toggleHaptics(): void {
    const on = !this.settings.haptics();
    void this.settings.update({ haptics: on }).then(() => this.haptic.tap());
  }
}
