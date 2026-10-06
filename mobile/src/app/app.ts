import { Component, inject, signal } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { OnboardingFlag } from './core/onboarding-flag';
import { BottomNav } from './presentation/components/bottom-nav/bottom-nav';
import { Onboarding } from './presentation/components/onboarding/onboarding';
import { Splash } from './presentation/components/splash/splash';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet, BottomNav, Onboarding, Splash],
  template: `
    <div class="app-stage">
      <div class="phone-shell">
        <!-- La app carga por detrás mientras la splash o la introducción están encima. -->
        <ion-app [attr.inert]="showSplash() || showOnboarding() ? '' : null">
          <ion-router-outlet />
          <app-bottom-nav />
        </ion-app>
        @if (showOnboarding()) {
          <app-onboarding (finished)="showOnboarding.set(false)" />
        }
        @if (showSplash()) {
          <app-splash (finished)="showSplash.set(false)" />
        }
      </div>
    </div>
  `,
})
export class App {
  protected readonly showSplash = signal(true);
  protected readonly showOnboarding = signal(false);

  constructor() {
    // Se resuelve mucho antes de que termine la splash, así que la introducción ya está debajo al desvanecerse.
    void inject(OnboardingFlag)
      .isDone()
      .then((done) => this.showOnboarding.set(!done));
  }
}
