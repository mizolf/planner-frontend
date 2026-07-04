# Onboarding: interest selection after registration

## Context

New users get a full-screen welcome screen on their **first login** where they pick travel
interests (`CULTURE`, `FOOD`, `ADVENTURE`, …). This immediately populates `preferredInterests`,
which already drive the "Recommended for you" section on the home page — so personalization works
from the first minute. Users can also **Skip**.

Registration does not log the user in. The real flow is
**register → verify email → login → `/home`**, so "after registration" effectively means
**on first login** (the first moment the user has a token).

To keep onboarding from reappearing on every login we add a boolean flag
**`onboardingCompleted`** on the user (default `false`). The **frontend** sets it to `true`
after Continue or Skip. The backend must NOT flip it on login — otherwise the frontend would
always read `true` and onboarding would never show.

### Decisions
- **Persistence**: backend flag `onboardingCompleted` (robust, cross-device).
- **Layout**: full-screen welcome screen, no navbar.
- **Continue**: enabled only when ≥1 interest is selected; **Skip** is always available.

## Backend (`planner-backend`)

- `model/User.java` — add `private boolean onboardingCompleted;`.
- `db/migration/V11__add_user_onboarding_completed.sql` — add column (required, `ddl-auto=validate`)
  + backfill existing users who already have interests to `true`.
- `responses/UserResponse.java` — expose `onboardingCompleted` in `from(User)`.
- `service/UserService.java` — `markOnboardingComplete(User)` sets flag `true`, saves, returns `UserResponse`.
- `controller/UserController.java` — `PUT /users/me/onboarding-complete` (bodyless).
- `service/AuthenticationService.signUp` — explicit `setOnboardingCompleted(false)` (default anyway).

### API contract
- `GET /users/me` → `UserResponse` now includes `onboardingCompleted: boolean`.
- `PUT /users/me/onboarding-complete` (no body) → sets flag `true`, returns `UserResponse`.

## Frontend (`planner-frontend`)

- `core/models/user.model.ts` — add `onboardingCompleted: boolean` to `User`.
- `core/services/user.service.ts` — add `setCurrentUser()` and `completeOnboarding()`
  (`PUT /users/me/onboarding-complete`, taps the `currentUser` signal).
- `core/guards/onboarding.guard.ts` — two guards sharing an "ensure user loaded" helper:
  - `onboardingGuard` on the dashboard route: redirect to `/onboarding` when `!onboardingCompleted`.
  - `onboardingRedirectGuard` on the `/onboarding` route: redirect to `/home` when already completed.
- `app.routes.ts` — add `onboardingGuard` to the dashboard parent; add a top-level `/onboarding`
  route (outside the dashboard children → full-screen, no navbar).
- `core/dashboard-layout/dashboard-layout.component.ts` — only `loadCurrentUser()` if the signal
  is still empty (guard has already loaded it).
- `features/onboarding/onboarding-page.component.{ts,html}` — full-screen page reusing
  `<app-interest-chips>`. Continue saves preferences then marks onboarding complete; Skip only
  marks complete. Both navigate to `/home`.
- `public/assets/i18n/{en,hr}.json` — add an `ONBOARDING` block.

## Verification

- Backend boots (`./gradlew bootRun`) with Flyway `V11` applied; `GET /users/me` returns the flag;
  `PUT /users/me/onboarding-complete` sets it.
- New user: register → verify → login → lands on `/onboarding`. Continue (≥1 interest) or Skip →
  `/home`; re-login does not show onboarding again.
- Existing user with interests (backfilled) goes straight to `/home`.
- A completed user manually visiting `/onboarding` is redirected to `/home`.
