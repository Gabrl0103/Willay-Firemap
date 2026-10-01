import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiError } from './api-error';

/** Global error handling: every HTTP failure reaches the app as an ApiError with a readable message. */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const message =
          error.status === 0
            ? 'No se pudo conectar con el servidor.'
            : error.status === 404
              ? 'No encontramos lo que buscabas.'
              : 'Ocurrió un error en el servidor.';
        return throwError(() => new ApiError(message, error.status));
      }
      return throwError(() => new ApiError('Ocurrió un error inesperado.', -1));
    }),
  );
