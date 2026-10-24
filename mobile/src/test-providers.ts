import type { Provider } from '@angular/core';
import { DEVICE_LANGUAGES } from './app/i18n/i18n';
import { SETTINGS_STORAGE } from './app/state/settings.store';

/**
 * Every spec starts on a Spanish phone with no saved settings (jsdom says en-US and has its own
 * localStorage); a spec that needs English or saved settings provides its own.
 */
export default [
  { provide: DEVICE_LANGUAGES, useValue: ['es-CO'] },
  { provide: SETTINGS_STORAGE, useValue: { read: async () => null, write: async () => undefined } },
] satisfies Provider[];
