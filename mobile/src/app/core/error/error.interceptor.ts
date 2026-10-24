import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiError } from './api-error';

/** Global error handling: every HTTP failure reaches the app as an ApiError with a code the screens can name. */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const code = error.status === 0 ? 'network' : error.status === 404 ? 'notFound' : 'server';
        return throwError(() => new ApiError(code, error.status));
      }
      return throwError(() => new ApiError('unexpected', -1));
    }),
  );
