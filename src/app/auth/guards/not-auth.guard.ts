import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const notAuthGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  authService.checkAndClearExpiredToken();

  if (authService.isAuthenticated()) {
    return router.createUrlTree(['/home']);
  }

  return true;
};
