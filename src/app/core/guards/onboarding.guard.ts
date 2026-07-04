import { inject } from '@angular/core';
import { Router, CanActivateFn, UrlTree } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { UserService } from '../services/user.service';
import { User } from '../models/user.model';

/**
 * Ensures the current user is loaded (fetches once if the signal is still empty,
 * e.g. the guard runs before the dashboard layout mounts), then hands the user to
 * `decide` to produce the guard result. On a load failure it allows navigation
 * rather than blocking the app.
 */
function withUser(
  decide: (user: User) => boolean | UrlTree,
): boolean | UrlTree | Observable<boolean | UrlTree> {
  const userService = inject(UserService);

  const cached = userService.currentUser();
  if (cached) {
    return decide(cached);
  }

  return userService.getCurrentUser().pipe(
    tap((user) => userService.setCurrentUser(user)),
    map(decide),
    catchError(() => of(true)),
  );
}

/** Redirects users who haven't finished onboarding to the onboarding screen. */
export const onboardingGuard: CanActivateFn = () => {
  const router = inject(Router);
  return withUser((user) =>
    user.onboardingCompleted ? true : router.createUrlTree(['/onboarding']),
  );
};

/** Keeps users who already finished onboarding out of the onboarding screen. */
export const onboardingRedirectGuard: CanActivateFn = () => {
  const router = inject(Router);
  return withUser((user) =>
    user.onboardingCompleted ? router.createUrlTree(['/home']) : true,
  );
};
