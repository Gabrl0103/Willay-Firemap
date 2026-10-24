import { DOCUMENT, Injectable, InjectionToken, computed, effect, inject } from '@angular/core';
import { SettingsStore, type LanguageSetting } from '../state/settings.store';
import en from './en.json';
import es from './es.json';

export type Language = 'es' | 'en';
/** Every text of the app, as es.json has it (en.json must have the same keys: i18n.spec.ts checks it). */
export type MessageKey = keyof typeof es;
/** A text that changes with a number: the dictionaries have `<key>.one` and `<key>.other`. */
export type PluralKey = MessageKey extends infer K ? (K extends `${infer Base}.one` ? Base : never) : never;
export type MessageParams = Readonly<Record<string, string | number>>;

const DICTIONARIES: Record<Language, Readonly<Record<string, string>>> = { es, en };

/** Intl locale of each language: dates, numbers and plurals («24 oct. 2026» / «Oct 24, 2026»). */
export const LOCALES: Record<Language, string> = { es: 'es-CO', en: 'en-US' };

/** The phone's languages, most preferred first (a token so tests can pass their own). */
export const DEVICE_LANGUAGES = new InjectionToken<readonly string[]>('DEVICE_LANGUAGES', {
  providedIn: 'root',
  factory: () => (navigator.languages?.length ? navigator.languages : [navigator.language ?? '']),
});

/** «Automático»: the phone's language when it is Spanish or English; Spanish for any other. */
export function resolveLanguage(setting: LanguageSetting, deviceLanguages: readonly string[]): Language {
  if (setting !== 'auto') return setting;
  return deviceLanguages[0]?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

/**
 * The text of `key` in `language`, with each `{name}` replaced by its param. With a numeric `count`
 * a plural key picks `<key>.one` or `<key>.other` by the language's plural rules.
 */
export function translate(language: Language, key: MessageKey | PluralKey, params: MessageParams = {}): string {
  const dictionary = DICTIONARIES[language];
  const count = params['count'];
  const plural =
    typeof count === 'number'
      ? (dictionary[`${key}.${new Intl.PluralRules(LOCALES[language]).select(count)}`] ?? dictionary[`${key}.other`])
      : undefined;
  const text = plural ?? dictionary[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

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
