import type { PermissionStatus, Position } from '@capacitor/geolocation';
import { type GeolocationApi, getUserLocation, locationMessage } from './user-location';

const POSITION = { timestamp: 0, coords: { latitude: 1.21, longitude: -77.28 } } as Position;

function permission(state: PermissionStatus['location']): PermissionStatus {
  return { location: state, coarseLocation: state };
}

function fakeGeolocation(overrides: Partial<Record<keyof GeolocationApi, ReturnType<typeof vi.fn>>> = {}) {
  return {
    requestPermissions: vi.fn().mockResolvedValue(permission('granted')),
    getCurrentPosition: vi.fn().mockResolvedValue(POSITION),
    ...overrides,
  };
}

/** Errors as the Capacitor plugin rejects them on Android. */
function pluginError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

describe('getUserLocation on Android', () => {
  it('asks for permission first and returns the position when granted', async () => {
    const geo = fakeGeolocation();
    const result = await getUserLocation(geo as unknown as GeolocationApi, true);
    expect(result).toEqual({ status: 'ok', latitude: 1.21, longitude: -77.28 });
    expect(geo.requestPermissions).toHaveBeenCalledBefore(geo.getCurrentPosition);
  });

  it('accepts approximate location only', async () => {
    const geo = fakeGeolocation({
      requestPermissions: vi.fn().mockResolvedValue({ location: 'denied', coarseLocation: 'granted' }),
    });
    expect((await getUserLocation(geo as unknown as GeolocationApi, true)).status).toBe('ok');
  });

  it('reports denied without asking for the position when permission is refused', async () => {
    const geo = fakeGeolocation({ requestPermissions: vi.fn().mockResolvedValue(permission('denied')) });
    expect(await getUserLocation(geo as unknown as GeolocationApi, true)).toEqual({ status: 'denied' });
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('reports denied when the position call is refused', async () => {
    const geo = fakeGeolocation({ getCurrentPosition: vi.fn().mockRejectedValue(pluginError('OS-PLUG-GLOC-0003')) });
    expect(await getUserLocation(geo as unknown as GeolocationApi, true)).toEqual({ status: 'denied' });
  });

  it('reports disabled when the GPS is off', async () => {
    const geo = fakeGeolocation({ requestPermissions: vi.fn().mockRejectedValue(pluginError('OS-PLUG-GLOC-0007')) });
    expect(await getUserLocation(geo as unknown as GeolocationApi, true)).toEqual({ status: 'disabled' });
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('reports disabled when the user refuses to turn the GPS on', async () => {
    const geo = fakeGeolocation({ getCurrentPosition: vi.fn().mockRejectedValue(pluginError('OS-PLUG-GLOC-0009')) });
    expect(await getUserLocation(geo as unknown as GeolocationApi, true)).toEqual({ status: 'disabled' });
  });

  it('reports unavailable on a timeout', async () => {
    const geo = fakeGeolocation({ getCurrentPosition: vi.fn().mockRejectedValue(pluginError('OS-PLUG-GLOC-0010')) });
    expect(await getUserLocation(geo as unknown as GeolocationApi, true)).toEqual({ status: 'unavailable' });
  });
});

describe('getUserLocation in the browser', () => {
  it('asks the browser directly for the position', async () => {
    const geo = fakeGeolocation();
    const result = await getUserLocation(geo as unknown as GeolocationApi, false);
    expect(result.status).toBe('ok');
    expect(geo.requestPermissions).not.toHaveBeenCalled();
  });

  it('reports denied when the browser blocks location', async () => {
    const geo = fakeGeolocation({ getCurrentPosition: vi.fn().mockRejectedValue({ code: 1, message: 'User denied' }) });
    expect(await getUserLocation(geo as unknown as GeolocationApi, false)).toEqual({ status: 'denied' });
  });
});

describe('locationMessage', () => {
  it('explains each failure in Spanish', () => {
    expect(locationMessage('denied')).toContain('permiso de ubicación');
    expect(locationMessage('disabled')).toContain('GPS');
    expect(locationMessage('unavailable')).toContain('No pudimos obtener tu ubicación');
  });
});
