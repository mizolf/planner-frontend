import { Routes } from '@angular/router';
import { authGuard } from './auth/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home-page/home-page.component').then(m => m.HomePageComponent),
    canActivate: [authGuard],
  },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes').then(m => m.authRoutes),
  },
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  {
    path: 'not-found',
    loadComponent: () => import('./core/not-found/not-found.component').then(m => m.NotFoundComponent),
  },
  { path: '**', redirectTo: '/not-found' },
];
