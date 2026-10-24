import type { MessageKey } from '../../i18n/translate';

/** What went wrong with a request; the screens say it in the app's language (so it follows a language change). */
export type ApiErrorCode = 'network' | 'notFound' | 'server' | 'unexpected';

export const API_ERROR_KEYS: Record<ApiErrorCode, MessageKey> = {
  network: 'error.network',
  notFound: 'error.notFound',
  server: 'error.server',
  unexpected: 'error.unexpected',
};

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status: number,
  ) {
    super(`API error: ${code} (${status})`);
    this.name = 'ApiError';
  }
}

/** The code of any failure: an ApiError's own, or 'unexpected' for anything else. */
export function apiErrorCode(error: unknown): ApiErrorCode {
  return error instanceof ApiError ? error.code : 'unexpected';
}
