import { TestBed } from '@angular/core/testing';
import { MapOverviewSheet, overviewCounts } from './map-overview-sheet';

function setup(inputs: { zoneCount: number; hotspotCount: number; canZoom?: boolean }) {
  const fixture = TestBed.createComponent(MapOverviewSheet);
  fixture.componentRef.setInput('zoneCount', inputs.zoneCount);
  fixture.componentRef.setInput('hotspotCount', inputs.hotspotCount);
  fixture.componentRef.setInput('updatedLabel', 'Actualizado 06:04 p. m.');
  if (inputs.canZoom !== undefined) fixture.componentRef.setInput('canZoom', inputs.canZoom);
  fixture.detectChanges();
  return { fixture, host: fixture.nativeElement as HTMLElement };
}

const text = (element: Element | null): string => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('MapOverviewSheet', () => {
  it('counts the municipalities and recent hotspots, in singular when there is one', () => {
    expect(overviewCounts(64, 12)).toBe('64 municipios · 12 focos de calor recientes');
    expect(overviewCounts(1, 1)).toBe('1 municipio · 1 foco de calor reciente');
    const { host } = setup({ zoneCount: 64, hotspotCount: 12 });
    expect(text(host.querySelector('h2'))).toBe('Departamento de Nariño');
    expect(text(host.querySelector('.counts'))).toBe('64 municipios · 12 focos de calor recientes');
  });

  it('says it is loading before the zones arrive', () => {
    const { host } = setup({ zoneCount: 0, hotspotCount: 0 });
    expect(text(host.querySelector('.counts'))).toBe('Cargando municipios…');
  });

  it('shows the four risk levels, the hotspot key and the disclaimer', () => {
    const { host } = setup({ zoneCount: 64, hotspotCount: 12 });
    expect([...host.querySelectorAll('app-risk-badge')].map(text)).toEqual(['Bajo', 'Medio', 'Alto', 'Extremo']);
    expect(text(host.querySelector('.hotspot-key'))).toContain('Foco de calor');
    expect(text(host.querySelector('.note'))).toContain('Estimación de riesgo, no predicción exacta');
  });

  it('asks the map to zoom to Nariño, and hides the button when there is no map', () => {
    const { fixture, host } = setup({ zoneCount: 64, hotspotCount: 12 });
    let requests = 0;
    fixture.componentInstance.zoomRequested.subscribe(() => requests++);
    const zoom = host.querySelector<HTMLButtonElement>('.zoom')!;
    expect(text(zoom)).toBe('Acercar a Nariño');
    zoom.click();
    expect(requests).toBe(1);

    expect(setup({ zoneCount: 64, hotspotCount: 12, canZoom: false }).host.querySelector('.zoom')).toBeNull();
  });

  it('folds down to its title with the handle and opens again', () => {
    const { fixture, host } = setup({ zoneCount: 64, hotspotCount: 12 });
    const handle = host.querySelector<HTMLButtonElement>('.handle')!;
    handle.click();
    fixture.detectChanges();
    expect(host.querySelector('.legend')).toBeNull();
    expect(handle.getAttribute('aria-label')).toBe('Mostrar leyenda');
    handle.click();
    fixture.detectChanges();
    expect(host.querySelector('.legend')).not.toBeNull();
  });
});
