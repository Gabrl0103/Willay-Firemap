import { celsiusToFahrenheit, formatTemperature, formatWind, kmhToMph } from './units';

describe('units', () => {
  it('converts °C to °F and km/h to mph only to show them', () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(100)).toBe(212);
    expect(kmhToMph(1.609344)).toBeCloseTo(1, 10);
  });

  it('writes the temperature in the chosen unit and the language format', () => {
    expect(formatTemperature(18.4, 'c', 'es')).toBe('18 °C');
    expect(formatTemperature(18.4, 'f', 'es')).toBe('65 °F');
    expect(formatTemperature(18.4, 'c', 'en')).toBe('18°C');
    expect(formatTemperature(18.4, 'f', 'en')).toBe('65°F');
  });

  it('writes the wind in the chosen unit and the language format', () => {
    expect(formatWind(9.7, 'kmh', 'es')).toBe('10 km/h');
    expect(formatWind(9.7, 'kmh', 'en')).toBe('10 km/h');
    expect(formatWind(9.7, 'mph', 'en')).toBe('6 mph');
    expect(formatWind(9.7, 'mph', 'es')).toBe('6 mi/h');
  });
});
