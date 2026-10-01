import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/**
 * Base URL of the backend.
 * - Browser (ng serve): localhost.
 * - Android emulator: 10.0.2.2 is the emulator's alias for the PC's localhost.
 * Cuando el backend esté desplegado (Render/Railway), cambia esta URL por la pública (https).
 */
const DEV_BROWSER_URL = 'http://localhost:3000/api';
const DEV_EMULATOR_URL = 'http://10.0.2.2:3000/api';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => (Capacitor.isNativePlatform() ? DEV_EMULATOR_URL : DEV_BROWSER_URL),
});
