import { formatDateLong, formatDateShort, formatHectares } from './format';

describe('format', () => {
  it('formats ISO dates in Spanish', () => {
    expect(formatDateLong('2026-09-18')).toBe('18 de sept de 2026');
    expect(formatDateShort('2026-01-05')).toBe('5 ene');
  });

  it('formats hectares with one decimal and a comma', () => {
    expect(formatHectares(2.5)).toBe('2,5');
  });
});
