import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { errorInterceptor } from './core/error/error.interceptor';
import { HttpFireRepository, HttpHotspotRepository, HttpZoneRepository } from './data/http-repositories';
import { FireRepository, HotspotRepository, ZoneRepository } from './domain/repository/repositories';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideIonicAngular({ mode: 'md' }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([errorInterceptor])),
    // Dependency Injection: the app depends on the abstract repositories, not on HTTP.
    { provide: ZoneRepository, useClass: HttpZoneRepository },
    { provide: FireRepository, useClass: HttpFireRepository },
    { provide: HotspotRepository, useClass: HttpHotspotRepository },
  ],
};
