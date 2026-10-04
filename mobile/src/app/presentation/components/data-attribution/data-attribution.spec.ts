import { TestBed } from '@angular/core/testing';
import { DataAttribution } from './data-attribution';

describe('DataAttribution', () => {
  it('credits the UNGRD and datos.gov.co with each dataset and its license', () => {
    const fixture = TestBed.createComponent(DataAttribution);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('UNGRD');
    expect(host.textContent).toContain('datos.gov.co');
    const items = [...host.querySelectorAll('li')].map((li) => li.textContent!.replace(/\s+/g, ' ').trim());
    expect(items).toEqual(['2019–2022 · CC BY-SA 4.0', '2023–2024 · CC BY-SA 4.0', '2025 · CC BY 4.0']);
    const links = [...host.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toContain('https://www.datos.gov.co/d/rgre-6ak4');
    expect(links).toContain('https://creativecommons.org/licenses/by/4.0/deed.es');
  });
});
