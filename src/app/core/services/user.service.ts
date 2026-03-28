import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';

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
}
