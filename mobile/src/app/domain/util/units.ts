import { LOCALES, type Language } from '../../i18n/translate';
import type { TemperatureUnit, WindUnit } from '../../state/settings.store';

/** The API sends °C and km/h; Ajustes only changes how they are shown. */
export const celsiusToFahrenheit = (celsius: number): number => (celsius * 9) / 5 + 32;
export const kmhToMph = (kmh: number): number => kmh / 1.609344;

const formatUnit = (value: number, unit: string, language: Language): string =>
  new Intl.NumberFormat(LOCALES[language], { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: 0 })
    .format(value)
    .replace(/[  ]/g, ' ');

/** 18 -> "18 °C" (es) | "18°C" (en), or "64 °F" | "64°F", rounded to whole degrees. */
export function formatTemperature(celsius: number, unit: TemperatureUnit, language: Language): string {
  return unit === 'f'
    ? formatUnit(celsiusToFahrenheit(celsius), 'fahrenheit', language)
    : formatUnit(celsius, 'celsius', language);
}

/** 9.7 -> "10 km/h", or "6 mph" | "6 mi/h", rounded to whole units. */
export function formatWind(kmh: number, unit: WindUnit, language: Language): string {
  return unit === 'mph' ? formatUnit(kmhToMph(kmh), 'mile-per-hour', language) : formatUnit(kmh, 'kilometer-per-hour', language);
}
