import type { FireEvent } from '../../domain/model/FireEvent.js';
import type { Hotspot } from '../../domain/model/Hotspot.js';
import type { WeatherSnapshot } from '../../domain/model/WeatherSnapshot.js';
import type { Zone } from '../../domain/model/Zone.js';
import { NARINO_MUNICIPALITIES } from './narinoMunicipalities.js';

/**
 * DATOS DE PRUEBA (simulados) para clima, incendios y focos. Se reemplazan por Neon/PostGIS y por
 * lo que salga del scraping y de las APIs (Open-Meteo, NASA FIRMS). Solo 12 municipios tienen clima
 * de prueba; los demás aparecen en la API cuando la ingesta de clima les da datos.
 */

/** Las zonas sí son reales: los 64 municipios de Nariño (DIVIPOLA, DANE). */
export const zones: Zone[] = NARINO_MUNICIPALITIES.map(({ id, name, latitude, longitude, aliases }) => ({
  id,
  name,
  latitude,
  longitude,
  aliases,
}));

const weather = (
  zoneId: string,
  temperatureC: number,
  humidityPct: number,
  windKmh: number,
  daysWithoutRain: number,
): WeatherSnapshot => ({ zoneId, temperatureC, humidityPct, windKmh, daysWithoutRain });

export const weatherSnapshots: WeatherSnapshot[] = [
  weather('pasto', 25, 35, 20, 10),
  weather('ipiales', 20, 45, 22, 8),
  weather('tumaco', 29, 60, 10, 3),
  weather('tuquerres', 17, 70, 12, 2),
  weather('la-cruz', 26, 40, 16, 10),
  weather('samaniego', 25, 39, 21, 11),
  weather('sandona', 24, 42, 15, 9),
  weather('chachagui', 26, 36, 19, 12),
  weather('tangua', 21, 52, 14, 5),
  weather('yacuanquer', 23, 48, 13, 6),
  weather('guachucal', 15, 75, 11, 1),
  weather('barbacoas', 28, 55, 9, 4),
];

export const fireEvents: FireEvent[] = [
  { id: 'f01', zoneId: 'pasto', place: 'Morasurco, Pasto', date: '2026-09-18', hectares: 2.5, source: 'news' },
  { id: 'f02', zoneId: 'la-cruz', place: 'El Troje, La Cruz', date: '2026-08-27', hectares: 14.2, source: 'ungrd' },
  { id: 'f03', zoneId: 'ipiales', place: 'Las Cruces, Ipiales', date: '2026-07-09', hectares: 8.1, source: 'news' },
  { id: 'f04', zoneId: 'chachagui', place: 'Pasizara, Chachagüí', date: '2026-06-21', hectares: 5.8, source: 'ungrd' },
  { id: 'f05', zoneId: 'samaniego', place: 'El Motilón, Samaniego', date: '2026-03-14', hectares: 11.4, source: 'news' },
  { id: 'f06', zoneId: 'sandona', place: 'Santa Bárbara, Sandoná', date: '2025-12-02', hectares: 3.7, source: 'ungrd' },
  { id: 'f07', zoneId: 'tumaco', place: 'La Guayacana, Tumaco', date: '2025-10-17', hectares: 6.3, source: 'news' },
  { id: 'f08', zoneId: 'pasto', place: 'Bosque del Carpintero, Pasto', date: '2025-09-05', hectares: 2.2, source: 'news' },
  { id: 'f09', zoneId: 'pasto', place: 'Jongovito, Pasto', date: '2025-08-12', hectares: 4.9, source: 'news' },
  { id: 'f10', zoneId: 'yacuanquer', place: 'San Fernando, Yacuanquer', date: '2025-08-30', hectares: 7.5, source: 'ungrd' },
  { id: 'f11', zoneId: 'samaniego', place: 'La Cañada, Samaniego', date: '2025-02-20', hectares: 9.6, source: 'ungrd' },
  { id: 'f12', zoneId: 'tangua', place: 'Chávez, Tangua', date: '2025-01-15', hectares: 4.1, source: 'ungrd' },
  { id: 'f13', zoneId: 'ipiales', place: 'Yaramal, Ipiales', date: '2024-09-22', hectares: 12.3, source: 'news' },
  { id: 'f14', zoneId: 'chachagui', place: 'Cimarrones, Chachagüí', date: '2024-08-08', hectares: 18.4, source: 'news' },
  { id: 'f15', zoneId: 'la-cruz', place: 'San Bernardo, La Cruz', date: '2023-10-03', hectares: 6.8, source: 'ungrd' },
];

export const hotspots: Hotspot[] = [
  { id: 'h01', latitude: 1.2551, longitude: -77.3012, detectedAt: '2026-09-29T14:20:00Z' },
  { id: 'h02', latitude: 1.3205, longitude: -77.2478, detectedAt: '2026-09-29T14:20:00Z' },
  { id: 'h03', latitude: 1.4102, longitude: -77.3003, detectedAt: '2026-09-29T09:05:00Z' },
  { id: 'h04', latitude: 1.3011, longitude: -77.5442, detectedAt: '2026-09-28T18:40:00Z' },
  { id: 'h05', latitude: 1.2203, longitude: -77.4120, detectedAt: '2026-09-28T18:40:00Z' },
  { id: 'h06', latitude: 1.5522, longitude: -77.0310, detectedAt: '2026-09-28T09:15:00Z' },
  { id: 'h07', latitude: 0.8812, longitude: -77.6012, detectedAt: '2026-09-27T20:10:00Z' },
];
