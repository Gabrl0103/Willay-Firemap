import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE, SettingsStore } from '../state/settings.store';
import en from './en.json';
import es from './es.json';
import { DEVICE_LANGUAGES, I18n, resolveLanguage, translate, type MessageKey } from './i18n';

describe('dictionaries', () => {
  it('have the same keys in Spanish and English', () => {
    const esKeys = Object.keys(es);
    const enKeys = Object.keys(en);
    expect(esKeys.filter((key) => !enKeys.includes(key))).toEqual([]); // missing in en.json
    expect(enKeys.filter((key) => !esKeys.includes(key))).toEqual([]); // missing in es.json
  });

  it('have no empty text and the same {params} in both languages', () => {
    const english: Readonly<Record<string, string>> = en;
    const params = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    for (const key of Object.keys(es) as MessageKey[]) {
      expect(es[key].trim(), key).not.toBe('');
      expect(english[key]?.trim(), key).not.toBe('');
      expect(params(english[key] ?? ''), key).toEqual(params(es[key]));
    }
  });
});

describe('resolveLanguage', () => {
  it('uses the phone language when it is Spanish or English, and Spanish for any other', () => {
    expect(resolveLanguage('auto', ['en-GB', 'es'])).toBe('en');
    expect(resolveLanguage('auto', ['es-CO'])).toBe('es');
    expect(resolveLanguage('auto', ['pt-BR', 'en'])).toBe('es');
    expect(resolveLanguage('auto', [])).toBe('es');
    expect(resolveLanguage('en', ['es-CO'])).toBe('en');
    expect(resolveLanguage('es', ['en-US'])).toBe('es');
  });
});

describe('translate', () => {
  it('finds the text in each language and leaves an unknown key visible', () => {
    expect(translate('es', 'risk.high')).toBe('Alto');
    expect(translate('en', 'risk.high')).toBe('High');
    expect(translate('en', 'missing.key' as MessageKey)).toBe('missing.key');
  });
});

describe('I18n', () => {
  it('switches every text live when the setting changes, and the page language with it', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: DEVICE_LANGUAGES, useValue: ['en-US'] },
        { provide: SETTINGS_STORAGE, useValue: { read: async () => null, write: async () => undefined } },
      ],
    });
    const i18n = TestBed.inject(I18n);
    const settings = TestBed.inject(SettingsStore);
    await settings.load();
    expect(settings.language()).toBe(DEFAULT_SETTINGS.language);
    expect(i18n.t('common.retry')).toBe('Retry');
    TestBed.tick();
    expect(document.documentElement.lang).toBe('en');

    await settings.update({ language: 'es' });
    expect(i18n.t('common.retry')).toBe('Reintentar');
    expect(i18n.locale()).toBe('es-CO');
    TestBed.tick();
    expect(document.documentElement.lang).toBe('es');
  });
});
