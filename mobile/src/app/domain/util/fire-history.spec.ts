import type { FireEvent, FireSource } from '../model/risk';
import {
  averagePerYear, countsByYear, coverageNote, hasHectares, keepYearRangesTogether, peakYear, recordPeriod, sortByDateDesc,
  splitPlace, toIsoDate, WORD_JOINER,
} from './fire-history';

let nextId = 0;
const fire = (date: string, source: FireSource, hectares: number | null = 1): FireEvent => ({
  id: `f${nextId++}`,
  zoneId: 'pasto',
  place: 'Pasto',
  date,
  hectares,
  source,
});

describe('fire history', () => {
  const events = [
    fire('2020-03-01', 'ungrd'),
    fire('2026-07-18', 'news', 750),
    fire('2019-01-10', 'ungrd', 0),
    fire('2022-08-30', 'ungrd', 2.5),
    fire('2026-08-22', 'news', null),
  ];

  it('sorts newest first without changing the input', () => {
    expect(sortByDateDesc(events).map((e) => e.date)).toEqual([
      '2026-08-22', '2026-07-18', '2022-08-30', '2020-03-01', '2019-01-10',
    ]);
    expect(events[0]?.date).toBe('2020-03-01');
  });

  it('treats 0 and null hectares as unknown', () => {
    expect(hasHectares(0)).toBe(false);
    expect(hasHectares(null)).toBe(false);
    expect(hasHectares(undefined)).toBe(false);
    expect(hasHectares(0.4)).toBe(true);
  });

  it('covers from 1 ene 2019 to today', () => {
    expect(recordPeriod(new Date(2026, 9, 6, 23, 30))).toEqual({ from: '1 ene 2019', to: '6 oct 2026' });
    expect(toIsoDate(new Date(2025, 0, 9))).toBe('2025-01-09');
  });

  it('counts every year from 2019 to the current one, with empty years at 0', () => {
    expect(countsByYear(events, new Date(2026, 9, 6))).toEqual([
      { year: 2019, count: 1 },
      { year: 2020, count: 1 },
      { year: 2021, count: 0 },
      { year: 2022, count: 1 },
      { year: 2023, count: 0 },
      { year: 2024, count: 0 },
      { year: 2025, count: 0 },
      { year: 2026, count: 2 },
    ]);
    expect(countsByYear([], new Date(2026, 0, 1)).map((c) => c.year)).toEqual([
      2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
    ]);
  });

  it('picks the year with the most fires, the latest on a tie', () => {
    const counts = countsByYear(events, new Date(2026, 9, 6));
    expect(peakYear(counts)).toEqual({ year: 2026, count: 2 });
    expect(peakYear([{ year: 2021, count: 3 }, { year: 2023, count: 3 }, { year: 2024, count: 1 }])).toEqual({
      year: 2023,
      count: 3,
    });
    expect(peakYear(countsByYear([], new Date(2026, 0, 1)))).toBeNull();
  });

  it('averages the fires per year elapsed since 2019, like the backend', () => {
    // 2019-01-01 to 2023-01-01 is 4 years (365.25 days each, within an hour).
    const now = new Date('2023-01-01T06:00:00Z');
    const fires = [fire('2019-05-01', 'ungrd'), fire('2020-05-01', 'ungrd'), fire('2022-12-31', 'ungrd')];
    expect(averagePerYear(fires, now)).toBeCloseTo(0.75, 2);
    expect(averagePerYear([...fires, fire('2023-02-01', 'news')], now)).toBeCloseTo(0.75, 2);
    expect(averagePerYear([], now)).toBe(0);
  });

  it('splits the locality from the municipality', () => {
    expect(splitPlace('Aminda, Cumbitara')).toEqual({ name: 'Aminda', municipality: 'Cumbitara' });
    expect(splitPlace('Pasto')).toEqual({ name: 'Pasto', municipality: null });
    expect(splitPlace('Vereda El Rosal, sector 2, Pasto')).toEqual({ name: 'Vereda El Rosal, sector 2', municipality: 'Pasto' });
  });

  it('names each source with its years and the empty years', () => {
    expect(coverageNote(events)).toBe(
      'Fuentes: UNGRD (2019–2022) y noticias locales (2026). Sin datos de 2021 y 2023–2025.',
    );
  });

  it('keeps year ranges on one line', () => {
    expect(keepYearRangesTogether('Sin datos de 2023–2025.')).toBe(`Sin datos de 2023–${WORD_JOINER}2025.`);
  });

  it('leaves out the gap sentence when every year has records', () => {
    expect(coverageNote([fire('2025-01-01', 'ungrd'), fire('2026-01-01', 'news')])).toBe(
      'Fuentes: UNGRD (2025) y noticias locales (2026).',
    );
    expect(coverageNote([])).toBe('');
  });
});
