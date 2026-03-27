import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 = token invalid or expired on the server side
      // Clear local auth state and redirect to login (no HTTP call)
      if (error.status === 401) {
        authService.forceLogout();
      }

      // Always rethrow — components handle their own error UX (403, 404, 400, etc.)
      return throwError(() => error);
    }),
  );
};
