import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { BottomNav } from './presentation/components/bottom-nav/bottom-nav';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet, BottomNav],
  template: `
    <div class="app-stage">
      <div class="phone-shell">
        <ion-app>
          <ion-router-outlet />
          <app-bottom-nav />
        </ion-app>
      </div>
    </div>
  `,
})
export class App {}
