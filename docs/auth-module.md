# Auth Module

Authentication module for the Plannr frontend application. Handles user registration, login, email verification, and JWT token management.

## File Structure

```
src/app/auth/
  auth.routes.ts                          # Lazy-loaded child routes
  auth-layout/
    auth-layout.component.ts              # Split-screen layout (hero + form)
    auth-layout.component.html
  login/
    login.component.ts                    # Login form
    login.component.html
  register/
    register.component.ts                 # Registration form
    register.component.html
  verify-email/
    verify-email.component.ts             # 6-digit email verification
    verify-email.component.html
  services/
    auth.service.ts                       # HTTP calls + JWT token management
  interceptors/
    auth.interceptor.ts                   # Attaches Bearer token to API requests
    error.interceptor.ts                  # Handles 401 responses globally
  models/
    auth.models.ts                        # Request/response DTOs, type guards
```

## Routing

Auth routes are lazy-loaded from `app.routes.ts`:

```
/auth          -> AuthLayoutComponent (wrapper)
/auth/login    -> LoginComponent
/auth/register -> RegisterComponent
/auth/verify   -> VerifyEmailComponent
```

All three screens render inside `AuthLayoutComponent` via `<router-outlet />`. The default route (`/`) and wildcard (`**`) both redirect to `/auth/login`.

## Auth Layout

`AuthLayoutComponent` provides the split-screen layout used by all auth screens:

- **Left half** (desktop only, `lg+`): brand hero with gradient background, app name "plannr.", headline text, and description.
- **Right half**: form area with `<router-outlet />` for the active auth screen.
- **Footer**: language switcher (EN/HR) and links (Sustainability, Privacy, Terms, Support).

The component injects `TranslateService` and calls `translate.use('en')` on init. The `switchLang()` method allows toggling between `en` and `hr`.

## Screens

### Login

- **Form fields**: email, password
- **Validation**: required, email format, password min 8 chars
- **Error handling**:
  - `401` -> "Invalid email or password"
  - `403` -> redirects to `/auth/verify` (account not verified)
  - `404` -> "No account found with this email"
  - Other -> generic error
- **On success**: stores JWT token and redirects to `/`
- Google Sign-In button present (not yet implemented)

### Register

- **Form fields**: full name, email, password, confirm password
- **Validation**: required fields, name min 2 chars, password min 8 chars, passwords must match (cross-field validator)
- **Error handling**:
  - `400` with `fieldErrors` -> maps server validation errors to individual form controls via `setErrors({ serverError: message })`
  - `500` -> "An account with this email already exists" (database constraint violation)
  - Other -> generic error
- **On success**: redirects to `/auth/verify?email=...`

### Verify Email

- **Guard**: if no `email` query param, redirects to `/auth/register`
- **Form fields**: 6-digit verification code
- **Resend code**: 60-second cooldown timer, interval-based countdown
- **Error handling**:
  - `400` -> "Invalid or expired verification code"
  - `404` -> "No account found"
  - `409` (on resend) -> "Already verified", redirects to login
- **On success**: shows success message, redirects to `/auth/login` after 2 seconds
- Implements `OnDestroy` to clean up the cooldown interval

## Auth Service

`AuthService` (`providedIn: 'root'`) manages all auth HTTP calls and JWT token state.

### State Management

Uses Angular signals for reactive state:

- `_token` (private) -> `token` (public computed)
- `_loginTimestamp` (private)
- `_expiresIn` (private)
- `isAuthenticated` (public computed) -> `true` when token exists and is not expired

Token is persisted in `localStorage` under keys: `auth_token`, `auth_login_timestamp`, `auth_expires_in`. On app startup, the constructor attempts to restore state from localStorage and clears it if expired.

### API Endpoints

All endpoints are relative to `environment.apiUrl + '/auth'`:

| Method | Endpoint   | Request DTO         | Response              |
|--------|------------|---------------------|-----------------------|
| POST   | `/login`   | `LoginRequest`      | `LoginResponse` (JSON)|
| POST   | `/signup`  | `SignupRequest`     | `SignupResponse` (JSON)|
| POST   | `/verify`  | `VerifyEmailRequest`| `string` (text)       |
| POST   | `/resend`  | `ResendCodeRequest` | `string` (text)       |
| POST   | `/logout`  | `null`              | `string` (text)       |

### Token Expiry

Expiry is calculated client-side: `Date.now() > loginTimestamp + expiresIn`. The `expiresIn` value comes from the backend `LoginResponse` (milliseconds).

## Interceptors

### Auth Interceptor (`authInterceptor`)

Functional interceptor registered in `app.config.ts`.

1. **Non-API requests** (e.g. `/assets/i18n/en.json`): passed through immediately. Only requests starting with `environment.apiUrl` are intercepted.
2. **Public auth endpoints** (`/auth/login`, `/auth/signup`, `/auth/verify`, `/auth/resend`): passed through without token.
3. **Expired token**: clears token, redirects to `/auth/login`, returns `EMPTY` (cancels request).
4. **Valid token**: clones request with `Authorization: Bearer <token>` header.
5. **No token**: passes request through as-is.

### Error Interceptor (`errorInterceptor`)

Catches `401` responses from the backend, calls `authService.forceLogout()` (clears token + redirects to login), then rethrows the error so components can handle their own error UI.

## DTOs

Defined in `auth.models.ts`:

```typescript
// Requests
LoginRequest      { email, password }
SignupRequest     { fullName, email, password }
VerifyEmailRequest { email, verificationCode }
ResendCodeRequest  { email }

// Responses
LoginResponse     { token, expiresIn }
SignupResponse    { id, fullName, email }

// Errors
ApiError           { status, message, timestamp }
ApiValidationError { ...ApiError, fieldErrors: Record<string, string> }
```

`isValidationError()` type guard checks if an error response contains `fieldErrors`.

## Shared Components

Both components use the `ControlContainer` / `FormGroupDirective` pattern to connect to the parent `formGroup` without needing explicit form control passing.

### FormFieldComponent

Generic text/email input with icon, label, and validation errors.

**Inputs:**
- `label` (required) - translation key for label
- `icon` (required) - Material Symbols icon name
- `type` - input type, defaults to `'text'`
- `placeholder` - translation key for placeholder
- `controlName` (required) - form control name in parent formGroup
- `errors` - `Record<string, string>` mapping error keys to translation keys

### PasswordFieldComponent

Password input with lock icon, visibility toggle, and optional "Forgot password?" link.

**Inputs:**
- `label` (required) - translation key for label
- `placeholder` - translation key for placeholder
- `controlName` (required) - form control name in parent formGroup
- `errors` - `Record<string, string>` mapping error keys to translation keys
- `showForgotLink` - shows "Forgot password?" link, defaults to `false`

**Internal state:**
- `showPassword` signal - toggles input type between `password` and `text`

## i18n

All user-facing strings use `ngx-translate`. Translation keys are namespaced under `AUTH.*`:

- `AUTH.COMMON.*` - shared strings (Google sign-in, divider, email/password labels, loading)
- `AUTH.LAYOUT.*` - hero section and footer
- `AUTH.LOGIN.*` - login-specific strings
- `AUTH.REGISTER.*` - register-specific strings
- `AUTH.VERIFY.*` - verification-specific strings

Translation files: `public/assets/i18n/en.json`, `public/assets/i18n/hr.json`.

## Environment

```typescript
// src/environments/environment.ts (dev)
{ production: false, apiUrl: 'http://localhost:8080' }

// src/environments/environment.prod.ts
{ production: true, apiUrl: 'https://api.plannr.com' }
```

File replacement for production builds is configured in `angular.json`.
