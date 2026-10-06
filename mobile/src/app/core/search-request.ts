import { Injectable, signal } from '@angular/core';

/** Permite que el botón de búsqueda de la barra inferior active el buscador del mapa. */
@Injectable({ providedIn: 'root' })
export class SearchRequest {
  readonly pending = signal(false);

  request(): void {
    this.pending.set(true);
  }

  consume(): void {
    this.pending.set(false);
  }
}
