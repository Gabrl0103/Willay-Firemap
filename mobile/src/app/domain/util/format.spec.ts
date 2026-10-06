import {
  dateParts, formatDateLong, formatDateMedium, formatDecimal, formatTimeAgo, formatUpdatedDay,
} from './format';

describe('format', () => {
  it('formats ISO dates in Spanish', () => {
    expect(formatDateLong('2026-09-18')).toBe('18 de sept de 2026');
    expect(formatDateMedium('2019-01-01')).toBe('1 ene 2019');
    expect(dateParts('2024-09-09')).toEqual({ day: '09', month: 'sept', year: '2024' });
  });

  it('writes at most one decimal, none for whole numbers', () => {
    expect(formatDecimal(3)).toBe('3');
    expect(formatDecimal(1.5)).toBe('1,5');
    expect(formatDecimal(3.5714)).toBe('3,6');
  });

  it('names the day of an update', () => {
    const now = new Date(2026, 9, 6, 9, 0);
    expect(formatUpdatedDay(new Date(2026, 9, 6, 0, 5), now)).toBe('hoy');
    expect(formatUpdatedDay(new Date(2026, 9, 5, 23, 59), now)).toBe('ayer');
    expect(formatUpdatedDay(new Date(2026, 9, 3, 12, 0), now)).toBe('3 oct');
  });

  it('says how long ago something was detected', () => {
    const now = new Date('2026-10-04T12:00:00Z');
    expect(formatTimeAgo('2026-10-04T11:30:00Z', now)).toBe('hace menos de 1 h');
    expect(formatTimeAgo('2026-10-04T07:00:00Z', now)).toBe('hace 5 h');
    expect(formatTimeAgo('2026-10-03T10:00:00Z', now)).toBe('hace 1 día');
    expect(formatTimeAgo('2026-09-30T18:53:00Z', now)).toBe('hace 3 días');
    expect(formatTimeAgo('2026-10-05T00:00:00Z', now)).toBe('hace menos de 1 h');
  });
});
