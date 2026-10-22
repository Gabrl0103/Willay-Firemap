import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import type { MapProjection } from '../presentation/pages/map/map-style';

const KEY = 'map.projection';
const FLAT = 'flat';

/**
 * Recuerda si este celular no mueve bien el globo (menos de 30 fps en la entrada): desde entonces el
 * mapa abre plano, sin giro. Preferences: almacenamiento nativo; localStorage en el navegador.
 */
@Injectable({ providedIn: 'root' })
export class MapProjectionFlag {
  async projection(): Promise<MapProjection> {
    try {
      const { value } = await Preferences.get({ key: KEY });
      return value === FLAT ? 'mercator' : 'globe';
    } catch {
      return 'globe';
    }
  }

  async rememberFlat(): Promise<void> {
    try {
      await Preferences.set({ key: KEY, value: FLAT });
    } catch {
      // Sin almacenamiento se volverá a medir en la próxima sesión; no bloquea el mapa.
    }
  }
}
