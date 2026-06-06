import { Routes } from '@angular/router';
import { authGuard } from './auth/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./core/dashboard-layout/dashboard-layout.component').then(m => m.DashboardLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: 'home', loadComponent: () => import('./home-page/home-page.component').then(m => m.HomePageComponent) },
      { path: 'my-trips', loadComponent: () => import('./features/my-trips/my-trips-page.component').then(m => m.MyTripsPageComponent) },
      { path: 'explore', loadComponent: () => import('./features/explore-page/explore-page.component').then(m => m.ExplorePageComponent) },
      { path: 'profile', loadComponent: () => import('./features/profile-page/profile-page.component').then(m => m.ProfilePageComponent) },
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
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes').then(m => m.authRoutes),
  },
  {
    path: 'not-found',
    loadComponent: () => import('./core/not-found/not-found.component').then(m => m.NotFoundComponent),
  },
  { path: '**', redirectTo: '/not-found' },
];
