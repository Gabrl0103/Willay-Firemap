import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export type LocationFailure = 'denied' | 'disabled' | 'unavailable';

export type LocationResult =
  | { status: 'ok'; latitude: number; longitude: number }
  | { status: LocationFailure };

/** The part of the Geolocation plugin we use (a parameter so tests can pass a fake). */
export type GeolocationApi = Pick<typeof Geolocation, 'requestPermissions' | 'getCurrentPosition'>;

/** Plugin error codes: permission denied; location services off or the request to turn them on refused. */
const DENIED_CODES = ['OS-PLUG-GLOC-0003'];
const DISABLED_CODES = ['OS-PLUG-GLOC-0007', 'OS-PLUG-GLOC-0009', 'OS-PLUG-GLOC-0017'];
/** Browser GeolocationPositionError.PERMISSION_DENIED. */
const BROWSER_DENIED = 1;

const MESSAGES: Record<LocationFailure, string> = {
  denied:
    'Atalaya no tiene permiso de ubicación. Actívalo en Ajustes > Apps > Atalaya > Permisos, o busca tu municipio en el mapa.',
  disabled: 'La ubicación (GPS) de tu teléfono está apagada. Actívala y vuelve a intentarlo.',
  unavailable: 'No pudimos obtener tu ubicación. Inténtalo de nuevo en unos segundos.',
};

export function locationMessage(failure: LocationFailure): string {
  return MESSAGES[failure];
}

/**
 * Current position of the user.
 * On Android/iOS asks for permission first; in the browser the browser itself asks inside getCurrentPosition.
 */
export async function getUserLocation(
  geolocation: GeolocationApi = Geolocation,
  native = Capacitor.isNativePlatform(),
): Promise<LocationResult> {
  try {
    if (native) {
      const permission = await geolocation.requestPermissions();
      if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
        return { status: 'denied' };
      }
    }
    const position = await geolocation.getCurrentPosition({ timeout: 10000 });
    return { status: 'ok', latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch (error) {
    return { status: failureOf(error) };
  }
}

function failureOf(error: unknown): LocationFailure {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === BROWSER_DENIED || DENIED_CODES.includes(String(code))) return 'denied';
  if (DISABLED_CODES.includes(String(code))) return 'disabled';
  return 'unavailable';
}
