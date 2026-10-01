import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AppIcon } from '../app-icon/app-icon';

@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive, AppIcon],
  template: `
    <nav class="bottom-nav" aria-label="Navegación principal">
      <a routerLink="/map" routerLinkActive="nav-active" class="nav-item">
        <app-icon name="map" [size]="20" /><span>Mapa</span>
      </a>
      <a routerLink="/history" routerLinkActive="nav-active" class="nav-item">
        <app-icon name="history" [size]="20" /><span>Historial</span>
      </a>
    </nav>
  `,
  styleUrl: './bottom-nav.css',
})
export class BottomNav {}
