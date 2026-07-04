import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, ChangePasswordRequest, UpdatePreferencesRequest } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/users`;

  private readonly _currentUser = signal<User | null>(null);
  private readonly _loading = signal(true);
  private readonly _error = signal<string | null>(null);

  readonly currentUser = this._currentUser.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`);
  }

  setCurrentUser(user: User): void {
    this._currentUser.set(user);
  }

  loadCurrentUser(): void {
    this._loading.set(true);
    this._error.set(null);

    this.getCurrentUser().subscribe({
      next: (user) => {
        this._currentUser.set(user);
        this._loading.set(false);
      },
      error: () => {
        this._loading.set(false);
        this._error.set('HOME.ERROR_LOADING_USER');
      },
    });
  }

  changePassword(req: ChangePasswordRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/me/password`, req);
  }

  updatePreferences(req: UpdatePreferencesRequest): Observable<User> {
    return this.http
      .put<User>(`${this.apiUrl}/me/preferences`, req)
      .pipe(tap((user) => this._currentUser.set(user)));
  }

  completeOnboarding(): Observable<User> {
    return this.http
      .put<User>(`${this.apiUrl}/me/onboarding-complete`, {})
      .pipe(tap((user) => this._currentUser.set(user)));
  }
}
