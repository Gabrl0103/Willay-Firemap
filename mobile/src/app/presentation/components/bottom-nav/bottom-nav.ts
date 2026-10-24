import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SearchRequest } from '../../../core/search-request';
import { TranslatePipe } from '../../../i18n/t.pipe';
import { AppIcon } from '../app-icon/app-icon';

@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive, AppIcon, TranslatePipe],
  template: `
    <nav class="bottom-nav anim-sheet" [attr.aria-label]="'nav.label' | t">
      <div class="pill">
        <a routerLink="/home" routerLinkActive="nav-active" class="nav-item" (click)="tap()">
          <app-icon name="home" [size]="24" /><span>{{ 'nav.home' | t }}</span>
        </a>
        <a routerLink="/map" routerLinkActive="nav-active" class="nav-item" (click)="tap()">
          <app-icon name="map" [size]="24" /><span>{{ 'nav.map' | t }}</span>
        </a>
        <a routerLink="/history" routerLinkActive="nav-active" class="nav-item" (click)="tap()">
          <app-icon name="bars" [size]="24" /><span>{{ 'nav.history' | t }}</span>
        </a>
      </div>
      <button type="button" class="search-btn" [attr.aria-label]="'nav.search' | t" (click)="openSearch()">
        <app-icon name="search" [size]="26" />
      </button>
    </nav>
  `,
  styleUrl: './bottom-nav.css',
})
export class BottomNav {
  private readonly router = inject(Router);
  private readonly searchRequest = inject(SearchRequest);

  protected tap(): void {
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  }

  protected openSearch(): void {
    this.tap();
    void this.router.navigateByUrl('/map').then(() => this.searchRequest.request());
  }
}
