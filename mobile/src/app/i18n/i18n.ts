import { DOCUMENT, Injectable, InjectionToken, computed, effect, inject } from '@angular/core';
import { SettingsStore } from '../state/settings.store';
import { LOCALES, resolveLanguage, translate, type MessageKey, type MessageParams, type PluralKey } from './translate';

export * from './translate';

/** The phone's languages, most preferred first (a token so tests can pass their own). */
export const DEVICE_LANGUAGES = new InjectionToken<readonly string[]>('DEVICE_LANGUAGES', {
  providedIn: 'root',
  factory: () => (navigator.languages?.length ? navigator.languages : [navigator.language ?? '']),
});

/** The language of the app: the «Idioma» setting, switched live (every text reads this signal). */
@Injectable({ providedIn: 'root' })
export class I18n {
  private readonly settings = inject(SettingsStore);
  private readonly deviceLanguages = inject(DEVICE_LANGUAGES);

  readonly language = computed(() => resolveLanguage(this.settings.language(), this.deviceLanguages));
  readonly locale = computed(() => LOCALES[this.language()]);

  constructor() {
    const document = inject(DOCUMENT);
    // Screen readers and the browser's own texts follow the app.
    effect(() => (document.documentElement.lang = this.language()));
  }

  t(key: MessageKey | PluralKey, params?: MessageParams): string {
    return translate(this.language(), key, params);
  }
}
