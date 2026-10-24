import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { FAVORITES_STORAGE, FavoritesStore } from '../../../state/favorites.store';
import { SettingsStore } from '../../../state/settings.store';
import { ZonesStore } from '../../../state/zones.store';
import { SettingsPage } from './settings.page';

const text = (el: Element | null | undefined): string => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

function render(savedFavorites: string | null = null) {
  const zones = { clearCache: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ZonesStore, useValue: zones },
      { provide: FAVORITES_STORAGE, useValue: { read: async () => savedFavorites, write: async () => undefined } },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(SettingsPage);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const settings = TestBed.inject(SettingsStore);
  const radios = (group: string) => [...host.querySelectorAll<HTMLButtonElement>(`[aria-labelledby="${group}"] [role="radio"]`)];
  const checked = (group: string) => radios(group).filter((b) => b.getAttribute('aria-checked') === 'true').map(text);
  return { fixture, host, settings, navigate, radios, checked, zones };
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

  it('reduces the motion of the whole app', async () => {
    const { fixture, settings, radios, checked } = render();
    expect(checked('motion-title')).toEqual(['Automático']);
    radios('motion-title')[1]!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(settings.motion()).toBe('reduced');
    expect(checked('motion-title')).toEqual(['Reducido']);
  });

  it('asks before clearing the favorites, in the same row', async () => {
    const { fixture, host } = render('["pasto","tumaco"]');
    const favorites = TestBed.inject(FavoritesStore);
    await favorites.load();
    fixture.detectChanges();
    const buttons = () => [...host.querySelectorAll<HTMLButtonElement>('[aria-labelledby="data-title"] button')];
    expect(text(host.querySelector('[aria-labelledby="data-title"] .row .hint'))).toBe('2 municipios guardados');

    buttons()[0]!.click(); // «Borrar»
    fixture.detectChanges();
    expect(text(host.querySelector('.confirm p'))).toBe('¿Borrar tus 2 municipios favoritos?');
    host.querySelector<HTMLButtonElement>('.confirm .action:not(.danger)')!.click(); // «Cancelar»
    fixture.detectChanges();
    expect(favorites.ids()).toEqual(['pasto', 'tumaco']);

    buttons()[0]!.click();
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('.confirm .danger')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(favorites.ids()).toEqual([]);
    expect(text(host.querySelector('[aria-labelledby="data-title"] .row .hint'))).toBe('Ningún municipio guardado');
  });

  it('clears the data cache and says it is done', () => {
    const { fixture, host, zones } = render();
    const clearCache = zones.clearCache;
    const rows = host.querySelectorAll('[aria-labelledby="data-title"] .row');
    rows[1]!.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    expect(clearCache).toHaveBeenCalledTimes(1);
    expect(text(rows[1]!.querySelector('.hint'))).toBe('Listo: se volverán a pedir.');
  });

  it('says which language «Automático» is using', () => {
    const { host } = render();
    expect(text(host.querySelector('.hint'))).toBe('Usa el idioma del teléfono: Español.');
  });
});
