import { Routes } from '@angular/router';
import { authGuard } from './auth/guards/auth.guard';
import { onboardingGuard, onboardingRedirectGuard } from './core/guards/onboarding.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./core/dashboard-layout/dashboard-layout.component').then(m => m.DashboardLayoutComponent),
    canActivate: [authGuard, onboardingGuard],
    children: [
      { path: 'home', loadComponent: () => import('./features/home-page/home-page.component').then(m => m.HomePageComponent) },
      { path: 'my-trips', loadComponent: () => import('./features/my-trips/my-trips-page.component').then(m => m.MyTripsPageComponent) },
      { path: 'explore', loadComponent: () => import('./features/explore-page/explore-page.component').then(m => m.ExplorePageComponent) },
      { path: 'explore/community', data: { tab: 'COMMUNITY' }, loadComponent: () => import('./features/explore-page/explore-page.component').then(m => m.ExplorePageComponent) },
      { path: 'profile', loadComponent: () => import('./features/profile-page/profile-page.component').then(m => m.ProfilePageComponent) },
      { path: 'settings', loadComponent: () => import('./features/settings-page/settings-page.component').then(m => m.SettingsPageComponent) },
      {
        path: 'trips/:id',
        loadComponent: () =>
          import('./features/trips/trip-detail/trip-detail-page.component')
            .then(m => m.TripDetailPageComponent),
      },
      {
        path: 'invites',
        loadComponent: () =>
          import('./features/invites/invites-page.component')
            .then(m => m.InvitesPageComponent),
      },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
  {
    path: 'onboarding',
    canActivate: [authGuard, onboardingRedirectGuard],
    loadComponent: () =>
      import('./features/onboarding/onboarding-page.component').then(m => m.OnboardingPageComponent),
  },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes').then(m => m.authRoutes),
  },
  {
    path: 'privacy',
    loadComponent: () => import('./features/legal/privacy-page/privacy-page.component').then(m => m.PrivacyPageComponent),
  },
  {
    path: 'terms',
    loadComponent: () => import('./features/legal/terms-page/terms-page.component').then(m => m.TermsPageComponent),
  },
  {
    path: 'support',
    loadComponent: () => import('./features/legal/support-page/support-page.component').then(m => m.SupportPageComponent),
  },
  {
    path: 'not-found',
    loadComponent: () => import('./core/not-found/not-found.component').then(m => m.NotFoundComponent),
  },
  { path: '**', redirectTo: '/not-found' },
];
