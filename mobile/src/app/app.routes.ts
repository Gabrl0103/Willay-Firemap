import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'map' },
  {
    path: 'map',
    loadComponent: () => import('./presentation/pages/map/map.page').then((m) => m.MapPage),
  },
  {
    path: 'history',
    loadComponent: () => import('./presentation/pages/history/history.page').then((m) => m.HistoryPage),
  },
  { path: '**', redirectTo: 'map' },
];
