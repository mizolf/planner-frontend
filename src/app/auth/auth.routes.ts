import { Routes } from '@angular/router';
import { AuthLayoutComponent } from './auth-layout/auth-layout.component';
import { notAuthGuard } from './guards/not-auth.guard';

export const authRoutes: Routes = [
  {
    path: '',
    component: AuthLayoutComponent,
    canActivate: [notAuthGuard],
    children: [
      {
        path: 'login',
        loadComponent: () => import('./login/login.component').then(m => m.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () => import('./register/register.component').then(m => m.RegisterComponent),
      },
      {
        path: 'verify',
        loadComponent: () => import('./verify-email/verify-email.component').then(m => m.VerifyEmailComponent),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },
];
