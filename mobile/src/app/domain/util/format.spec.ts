import { formatDateLong, formatDateShort, formatHectares, formatTimeAgo } from './format';

describe('format', () => {
  it('formats ISO dates in Spanish', () => {
    expect(formatDateLong('2026-09-18')).toBe('18 de sept de 2026');
    expect(formatDateShort('2026-01-05')).toBe('5 ene');
  });

  it('formats hectares with one decimal and a comma', () => {
    expect(formatHectares(2.5)).toBe('2,5');
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
