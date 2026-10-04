import type { FireEvent, FireSource } from '../model/risk';
import {
  coverageNote, hasHectares, keepYearRangesTogether, recordsRangeLabel, sortByDateDesc, totalHectaresLabel, WORD_JOINER,
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

  it('adds only the known hectares, or says there is no data', () => {
    expect(totalHectaresLabel(events)).toBe('753,5');
    expect(totalHectaresLabel([fire('2026-01-01', 'news', 0), fire('2026-01-02', 'news', null)])).toBe('Sin dato');
    expect(totalHectaresLabel([])).toBe('Sin dato');
  });

  it('builds the records range from the real dates', () => {
    expect(recordsRangeLabel(events)).toBe('Registros 2019–2026');
    expect(recordsRangeLabel([fire('2026-05-01', 'news')])).toBe('Registros 2026');
    expect(recordsRangeLabel([])).toBe('Sin registros');
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
