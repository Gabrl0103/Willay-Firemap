import { TestBed } from '@angular/core/testing';
import type { FireEvent } from '../../../domain/model/risk';
import { FireEventTile } from './fire-event-tile';

function render(changes: Partial<FireEvent> = {}): HTMLElement {
  const event: FireEvent = {
    id: 'f1', zoneId: 'pasto', place: 'Obonuco, Pasto', date: '2025-09-02', hectares: 3, source: 'ungrd', ...changes,
  };
  const fixture = TestBed.createComponent(FireEventTile);
  fixture.componentRef.setInput('event', event);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const text = (host: HTMLElement, selector: string): string[] =>
  [...host.querySelectorAll(selector)].map((el) => el.textContent!.replace(/\s+/g, ' ').trim());

describe('FireEventTile', () => {
  it('stacks day, month and year in the date block', () => {
    const host = render();
    expect(text(host, '.date-block > *')).toEqual(['02', 'sept', '2025']);
    expect(host.querySelector('time')!.getAttribute('aria-label')).toBe('2 de sept de 2025');
  });

  it('shows the locality as title and the municipality with the source', () => {
    expect(text(render(), 'h3, .event-copy p')).toEqual(['Obonuco', 'Pasto · UNGRD']);
    expect(text(render({ place: 'Pasto', source: 'news' }), 'h3, .event-copy p')).toEqual(['Pasto', 'Noticias']);
  });

  it('shows the burned area only when the source gives one', () => {
    expect(text(render({ hectares: 1.5 }), '.event-area > *')).toEqual(['1,5 ha', 'aprox.']);
    expect(text(render({ hectares: 3 }), '.event-area b')).toEqual(['3 ha']);
    expect(render({ hectares: 0 }).querySelector('.event-area')).toBeNull();
    expect(render({ hectares: null }).querySelector('.event-area')).toBeNull();
  });
});
