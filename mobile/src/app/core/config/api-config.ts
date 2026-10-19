import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/**
 * Base URL of the backend.
 * - Browser (ng serve): local backend on localhost.
 * - Android app (emulator or real phone): the deployed backend on Render (https).
 */
const DEV_BROWSER_URL = 'http://localhost:3000/api';
const NATIVE_API_URL = 'https://willay-api.onrender.com/api';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => (Capacitor.isNativePlatform() ? NATIVE_API_URL : DEV_BROWSER_URL),
});
