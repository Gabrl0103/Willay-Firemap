import { TestBed } from '@angular/core/testing';
import type { FireEvent } from '../../../domain/model/risk';
import { FireEventTile } from './fire-event-tile';

function areaText(hectares: number | null): string {
  const event: FireEvent = { id: 'f1', zoneId: 'pasto', place: 'Pasto', date: '2026-08-22', hectares, source: 'news' };
  const fixture = TestBed.createComponent(FireEventTile);
  fixture.componentRef.setInput('event', event);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('.event-copy span')!.textContent!.trim();
}

describe('FireEventTile', () => {
  it('shows the burned area when the source gives one', () => {
    expect(areaText(2.5)).toBe('2,5 ha afectadas');
  });

  it('shows "Sin dato" instead of 0,0 ha', () => {
    expect(areaText(0)).toBe('Sin dato de hectáreas');
    expect(areaText(null)).toBe('Sin dato de hectáreas');
  });
});
