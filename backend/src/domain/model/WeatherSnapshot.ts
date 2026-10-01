export interface WeatherSnapshot {
  readonly zoneId: string;
  readonly temperatureC: number;
  readonly humidityPct: number;
  readonly windKmh: number;
  readonly daysWithoutRain: number;
}
