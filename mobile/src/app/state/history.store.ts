import { Injectable, inject, signal } from '@angular/core';
import type { FireHistory } from '../domain/model/risk';
import { FireRepository } from '../domain/repository/repositories';

@Injectable({ providedIn: 'root' })
export class HistoryStore {
  private readonly fireRepository = inject(FireRepository);

  readonly history = signal<FireHistory | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  load(zoneId?: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.fireRepository.history(zoneId).subscribe({
      next: (history) => {
        this.history.set(history);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }
}
