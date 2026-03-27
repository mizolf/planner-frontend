import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

// URLs that don't need a Bearer token (public auth endpoints)
const PUBLIC_URLS = ['/auth/login', '/auth/signup', '/auth/verify', '/auth/resend'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Only intercept API requests — let static assets (translations, images, etc.) through
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const authService = inject(AuthService);
  const router = inject(Router);

  // Don't attach token to public auth endpoints
  if (PUBLIC_URLS.some((url) => req.url.includes(url))) {
    return next(req);
  }

  // If token is expired, clear it and redirect to login — don't send a doomed request
  if (authService.checkAndClearExpiredToken()) {
    router.navigate(['/auth/login']);
    return EMPTY;
  }

  // Attach Bearer token if available
  const token = authService.token();
  if (token) {
    const clonedReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next(clonedReq);
  }

  return next(req);
};
