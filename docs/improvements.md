# Improvements & Technical Debt

Comprehensive audit of frontend (Angular 18) and backend (Spring Boot) — April 2026.

---

## Critical

### 1. `getAllUsers()` endpoint exposes all user data
**Backend** — `UserController.java`
- `GET /users/` returns every user (email, fullName, id) to any authenticated user
- **Fix**: Remove endpoint or restrict to admin role

### 2. Test specs out of sync
**Frontend** — `app.component.spec.ts`
- Tests expect `.title` property and `<h1>Hello, planner-frontend</h1>` — component has neither
- Tests will fail on `ng test`
- **Fix**: Rewrite specs to match actual component

### 3. Missing DTO validation (8 DTOs)
**Backend** — `CreateTripDTO`, `UpdateTripDTO`, `CreateTripDayDTO`, `UpdateTripDayDTO`, `CreateActivityDTO`, `UpdateActivityDTO`, `AddTripMemberDTO`, `UpdateTripMemberDTO`
- None have `@NotBlank`, `@NotNull`, `@Email`, `@Min`, `@Size` constraints
- Can create trips with null name, negative budget, empty destination
- **Fix**: Add Jakarta validation annotations to all fields

### 4. No business logic date validation
**Backend** — `TripService`, `ActivityService`
- Can create trip where `endDate < startDate`
- Can create activity where `endTime < startTime`
- TripDay dates not validated to be within trip date range
- **Fix**: Add validation in service layer or custom validators

---

## High

### 5. N+1 query in `getTripDetail()`
**Backend** — `TripService.getTripDetail()`
- Fetches days, then for each day fetches activities = N+1 queries
- 100-day trip = 102 queries instead of 2
- **Fix**: Use `@EntityGraph` or `JOIN FETCH` in repository

### 6. Token blacklist is in-memory only
**Backend** — `TokenBlacklistService`
- Uses `ConcurrentHashMap` — lost on server restart
- All logged-out tokens become valid again after deploy
- **Fix**: Persist to Redis or database table

### 7. Not-found page redirects to login
**Frontend** — `not-found.component.ts:18`
- `this.router.navigate(['/auth/login'])` should be `/home`
- Authenticated users on 404 get sent to login
- **Fix**: Change to `/home`

### 8. Auth pages accessible when logged in
**Frontend** — `auth.routes.ts`
- No guard prevents authenticated users from hitting `/auth/login` or `/auth/register`
- **Fix**: Create `notAuthGuard` that redirects to `/home` if already logged in

### 9. Missing `RuntimeException` handler
**Backend** — `GlobalExceptionHandler`
- Handles specific exceptions but not generic `RuntimeException`
- Services throw `RuntimeException("Trip not found")` — exposes stack trace to client
- **Fix**: Add catch-all `@ExceptionHandler(RuntimeException.class)` returning 500

### 10. setTimeout leak in VerifyEmailComponent
**Frontend** — `verify-email.component.ts`
- Success/already-verified timers not cleared in `ngOnDestroy`
- If user navigates away fast, orphaned timer fires navigation
- **Fix**: Store timer IDs, clear in `ngOnDestroy`

---

## Medium

### 11. Verification code uses `Random` instead of `SecureRandom`
**Backend** — `AuthenticationService.generateVerificationCode()`
- 6-digit code with non-cryptographic random
- No rate limit on `/auth/verify` — brute-forceable in <1M attempts
- **Fix**: Use `SecureRandom`, add rate limiting

### 12. No pagination on list endpoints
**Backend** — `GET /users/`, `GET /trips`
- Returns all records unbounded
- **Fix**: Add `Pageable` parameter, return `Page<T>`

### 13. No rate limiting anywhere
**Backend** — all endpoints
- Brute force login, spam verify, mass create trips — all unthrottled
- **Fix**: Add Spring rate-limiter (Bucket4j, Resilience4j, or API gateway)

### 14. Missing path variable validation
**Backend** — all controllers
- `@PathVariable Long tripId` accepts negative/zero values
- **Fix**: Add `@Positive` annotation

### 15. Mobile responsiveness gaps
**Frontend** — multiple components
- **Stats cards**: jumps from 1→3 columns at `sm:` (640px), no `md:` breakpoint
- **Navbar**: collapses to hamburger at `lg:` — could show links on tablets
- **Upcoming trip cards**: `w-44` image placeholder too wide on small mobile
- **Form inputs**: `pl-12` left padding tight on 320px screens
- **Fix**: Add `md:` breakpoints, test on 375px/768px

### 16. Accessibility gaps
**Frontend** — multiple components
- Password toggle button: no `aria-label`
- Form inputs: no `aria-invalid` or `aria-describedby` for errors
- Mobile nav backdrop: no semantic `role="dialog"`
- Footer links: `text-on-surface-variant/40` likely fails WCAG AA contrast
- **Fix**: Add ARIA attributes, test with axe DevTools

### 17. Logout has no loading state
**Frontend** — `navbar.component.ts`
- `onLogout()` calls `authService.logout().subscribe()` — button stays clickable
- If backend is slow, user can spam-click
- **Fix**: Add loading signal, disable button during request

### 18. Generic error messages in services
**Frontend** — `UserService`, `TripService`
- Error callback doesn't check HTTP status (401 vs 404 vs 500)
- User sees same "Failed to load" for auth errors and server errors
- **Fix**: Map HTTP status codes to specific i18n keys

### 19. Inconsistent exception types in services
**Backend** — `TripService`, `TripDayService`, `ActivityService`
- Mix of `RuntimeException` and `ResourceNotFoundException`
- Should consistently use custom exceptions
- **Fix**: Replace all `RuntimeException` with specific exception classes

### 20. `UserService` injects unused `EmailService`
**Backend** — `UserService` constructor
- `EmailService` parameter injected but never used
- **Fix**: Remove unused dependency

---

## Low

### 21. No API documentation
**Backend** — no Swagger/OpenAPI
- No auto-generated docs, no `@ApiOperation` annotations
- Frontend devs rely on reading controller code
- **Fix**: Add `springdoc-openapi-starter-webmvc-ui` dependency

### 22. CORS missing PATCH method
**Backend** — `SecurityConfiguration.corsConfigurationSource()`
- Allowed methods: GET, POST, PUT, DELETE — no PATCH
- May need it for partial updates
- **Fix**: Add PATCH or switch to it for updates

### 23. No soft delete
**Backend** — all entities
- `CascadeType.ALL` + `orphanRemoval = true` means hard delete
- No audit trail for deleted trips/days/activities
- **Fix**: Add `deletedAt` field or use Hibernate `@SoftDelete`

### 24. Hardcoded magic numbers
**Frontend** — multiple components
- Verify email cooldown: hardcoded `60` seconds
- Upcoming trips: `.slice(0, 2)` — hardcoded limit
- **Fix**: Extract to named constants

### 25. No test coverage
**Frontend** — only `app.component.spec.ts` and `home-page.component.spec.ts` exist
- No tests for: auth service, guards, interceptors, form components, login/register logic
- **Fix**: Add unit tests for services/guards first, then component tests

### 26. Empty component SCSS files
**Frontend** — `home-page.component.scss` and others
- Files exist but are empty (all styling via Tailwind classes)
- **Fix**: Remove empty SCSS files or configure `styles: []` inline

### 27. No network error detection
**Frontend** — no offline handling
- If user loses internet, gets generic error message
- **Fix**: Add connection status detection, show "No internet" banner

---

## Feature Gaps

| Feature | Status | Notes |
|---------|--------|-------|
| Trip images / cover photos | Missing | Backend has no image field; frontend shows "No image" placeholder |
| Expense tracking | Missing | Trip has `budget` field but no expenses entity |
| Trip invitations workflow | Missing | Can add members but no accept/decline flow |
| Activity assignments | Missing | Activities exist but can't assign to specific members |
| Comments / discussions | Missing | No collaborative notes on trips/days |
| Notifications | Missing | Bell icon in navbar is non-functional |
| Explore / templates | Missing | No backend support for trip templates |
| Search / filtering | Missing | No search on trips list, no filter by status/date |
| Profile settings page | Missing | "My Profile" link in navbar goes nowhere |
| Password reset flow | Missing | "Forgot password?" link is `href="#"` |
| Refresh token | Missing | JWT expires in 1h with no refresh mechanism |

---

## Priority Roadmap

**Immediate** (blocks correct operation):
- Fix test specs (#2)
- Fix 404 redirect (#7)
- Add `notAuthGuard` (#8)

**Sprint 1** (security & stability):
- Add DTO validation (#3)
- Date validation (#4)
- Fix `RuntimeException` handler (#9)
- Remove/secure `getAllUsers()` (#1)

**Sprint 2** (performance & UX):
- Fix N+1 query (#5)
- Add pagination (#12)
- Mobile responsiveness (#15)
- Better error messages (#18)

**Sprint 3** (quality & polish):
- Accessibility (#16)
- Token blacklist persistence (#6)
- Rate limiting (#13)
- Test coverage (#25)
