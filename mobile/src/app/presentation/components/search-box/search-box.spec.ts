import { TestBed } from '@angular/core/testing';
import type { ZoneRiskSummary } from '../../../domain/model/risk';
import { SearchBox } from './search-box';

const ZONES: ZoneRiskSummary[] = [
  { id: 'pasto', name: 'Pasto', latitude: 1.21, longitude: -77.28, score: 33, level: 'medium' },
  { id: 'chachagui', name: 'Chachagüí', latitude: 1.36, longitude: -77.28, score: 58, level: 'high' },
];

async function setup() {
  const fixture = TestBed.createComponent(SearchBox);
  fixture.componentRef.setInput('zones', ZONES);
  document.body.append(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;
  const input = host.querySelector('input')!;
  const type = async (text: string): Promise<void> => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { fixture, host, input, type };
}

describe('SearchBox', () => {
  afterEach(() => document.body.replaceChildren());

  it('opens with the keyboard up (the field has the focus)', async () => {
    const { input } = await setup();
    expect(document.activeElement).toBe(input);
  });

  it('finds municipalities without caring about accents and emits the one picked', async () => {
    const { fixture, host, type } = await setup();
    const picked: ZoneRiskSummary[] = [];
    fixture.componentInstance.selected.subscribe((zone) => picked.push(zone));

    await type('chachagui');
    const results = [...host.querySelectorAll<HTMLButtonElement>('.result')];
    expect(results.map((button) => button.querySelector('span')?.textContent)).toEqual(['Chachagüí']);
    results[0]!.click();
    expect(picked.map((zone) => zone.id)).toEqual(['chachagui']);
  });

  it('says when nothing matches', async () => {
    const { host, type } = await setup();
    await type('bogotá');
    expect(host.querySelector('.empty')?.textContent).toContain('No encontramos ese municipio.');
  });

  it('cancels with «Cancelar» and with Escape', async () => {
    const { fixture, host, input } = await setup();
    let cancelled = 0;
    fixture.componentInstance.cancelled.subscribe(() => cancelled++);

    host.querySelector<HTMLButtonElement>('.cancel')!.click();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cancelled).toBe(2);
  });
});
