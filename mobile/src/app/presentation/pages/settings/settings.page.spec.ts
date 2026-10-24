import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SettingsStore } from '../../../state/settings.store';
import { SettingsPage } from './settings.page';

const text = (el: Element | null | undefined): string => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

function render() {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(SettingsPage);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const settings = TestBed.inject(SettingsStore);
  const radios = (group: string) => [...host.querySelectorAll<HTMLButtonElement>(`[aria-labelledby="${group}"] [role="radio"]`)];
  const checked = (group: string) => radios(group).filter((b) => b.getAttribute('aria-checked') === 'true').map(text);
  return { fixture, host, settings, navigate, radios, checked };
}

describe('SettingsPage', () => {
  it('starts on the defaults and goes back to Inicio', () => {
    const { host, navigate, checked } = render();
    expect(text(host.querySelector('h1'))).toBe('Ajustes');
    expect(checked('language-title')).toEqual(['Automático']);
    expect(checked('temperature-label')).toEqual(['°C']);
    expect(checked('wind-label')).toEqual(['km/h']);
    expect(host.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('true');
    host.querySelector<HTMLButtonElement>('.back')!.click();
    expect(navigate).toHaveBeenCalledWith('/home');
  });

  it('switches the whole screen to English at once and saves the choice', async () => {
    const { fixture, host, settings, radios, checked } = render();
    radios('language-title')[2]!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(settings.language()).toBe('en');
    expect(text(host.querySelector('h1'))).toBe('Settings');
    expect(checked('language-title')).toEqual(['English']);
    expect(host.querySelector('.back')!.getAttribute('aria-label')).toBe('Back');
  });

  it('changes the units and the vibration', async () => {
    const { fixture, host, settings, radios } = render();
    radios('temperature-label')[1]!.click();
    radios('wind-label')[1]!.click();
    host.querySelector<HTMLButtonElement>('[role="switch"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(settings.settings()).toMatchObject({ temperature: 'f', wind: 'mph', haptics: false });
    expect(host.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('false');
  });

  it('says which language «Automático» is using', () => {
    const { host } = render();
    expect(text(host.querySelector('.hint'))).toBe('Usa el idioma del teléfono: Español.');
  });
});
