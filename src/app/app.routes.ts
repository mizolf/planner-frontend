import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes').then(m => m.authRoutes),
  },
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
  {
    path: 'not-found',
    loadComponent: () => import('./core/not-found/not-found.component').then(m => m.NotFoundComponent),
  },
  { path: '**', redirectTo: '/not-found' },
];
