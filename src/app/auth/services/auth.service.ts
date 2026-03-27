import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  LoginRequest,
  LoginResponse,
  SignupRequest,
  SignupResponse,
  VerifyEmailRequest,
  ResendCodeRequest,
} from '../models/auth.models';

// localStorage keys — centralized to avoid typos
const TOKEN_KEY = 'auth_token';
const TIMESTAMP_KEY = 'auth_login_timestamp';
const EXPIRES_KEY = 'auth_expires_in';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  // Private signals — only this service can write to these
  private readonly _token = signal<string | null>(null);
  private readonly _loginTimestamp = signal<number | null>(null);
  private readonly _expiresIn = signal<number | null>(null);

  // Public computed signals — components read these, they auto-update when private signals change
  readonly token = computed(() => this._token());
  readonly isAuthenticated = computed(() => this._token() !== null && !this.isTokenExpired());

  constructor() {
    // On app startup, try to restore auth state from localStorage
    const token = localStorage.getItem(TOKEN_KEY);
    const timestamp = localStorage.getItem(TIMESTAMP_KEY);
    const expiresIn = localStorage.getItem(EXPIRES_KEY);

    if (token && timestamp && expiresIn) {
      this._token.set(token);
      this._loginTimestamp.set(Number(timestamp));
      this._expiresIn.set(Number(expiresIn));

      // If the restored token is already expired, clean up immediately
      if (this.isTokenExpired()) {
        this.clearToken();
      }
    }
  }

  // ── HTTP Methods ──
  // Each returns an Observable. Components subscribe and handle success/errors themselves.

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, request).pipe(
      // tap = side effect without changing the data flowing through the Observable
      tap((response) => this.storeToken(response.token, response.expiresIn)),
    );
  }

  register(request: SignupRequest): Observable<SignupResponse> {
    return this.http.post<SignupResponse>(`${this.apiUrl}/signup`, request);
  }

  verifyEmail(request: VerifyEmailRequest): Observable<string> {
    // responseType: 'text' because backend returns a plain string, not JSON
    return this.http.post(`${this.apiUrl}/verify`, request, { responseType: 'text' });
  }

  resendCode(request: ResendCodeRequest): Observable<string> {
    return this.http.post(`${this.apiUrl}/resend`, request, { responseType: 'text' });
  }

  loginWithGoogle(): void {
    // TODO: Implement Google OAuth redirect flow when backend supports it
    console.warn('Google OAuth not yet implemented');
  }

  logout(): Observable<string> {
    return this.http.post(`${this.apiUrl}/logout`, null, { responseType: 'text' }).pipe(
      tap(() => {
        this.clearToken();
        this.router.navigate(['/auth/login']);
      }),
    );
  }

  // ── Token Management ──

  /** Returns true if token was expired (and cleared). Used by the auth interceptor. */
  checkAndClearExpiredToken(): boolean {
    if (this.isTokenExpired()) {
      this.clearToken();
      return true;
    }
    return false;
  }

  /** Clears auth state locally and redirects to login. No HTTP call.
   *  Used by the error interceptor when a 401 is received. */
  forceLogout(): void {
    this.clearToken();
    this.router.navigate(['/auth/login']);
  }

  /** Removes token from signals and localStorage. */
  clearToken(): void {
    this._token.set(null);
    this._loginTimestamp.set(null);
    this._expiresIn.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TIMESTAMP_KEY);
    localStorage.removeItem(EXPIRES_KEY);
  }

  /** Saves token + expiry to signals and localStorage. */
  private storeToken(token: string, expiresIn: number): void {
    const now = Date.now();
    this._token.set(token);
    this._loginTimestamp.set(now);
    this._expiresIn.set(expiresIn);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TIMESTAMP_KEY, String(now));
    localStorage.setItem(EXPIRES_KEY, String(expiresIn));
  }

  /** Checks if the stored token has expired based on login timestamp + expiresIn. */
  private isTokenExpired(): boolean {
    const timestamp = this._loginTimestamp();
    const expiresIn = this._expiresIn();
    if (timestamp === null || expiresIn === null) return true;
    return Date.now() > timestamp + expiresIn;
  }
}
