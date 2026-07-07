# Account deletion (settings page)

## Context

The backend exposes `DELETE /users/me` (Bearer auth, JSON body `{ "password": "..." }`). The
settings page gets a third **danger card** — "Delete account" — whose button opens a confirm
dialog that summarizes the consequences and requires the user's **current password** (not just an
"Are you sure?"). On success (204) the token is already blacklisted server-side, so the frontend
just clears local auth state and redirects to login.

Deletion also makes chat history **authorless**: `senderId`/`senderName` in chat message
responses are now **nullable** (null = author deleted their account). The chat UI must render a
"Deleted user" placeholder instead of a blank name.

### Decisions

- **Dialog**: new standalone `DeleteAccountDialogComponent`, modeled on `clone-trip-dialog`
  (form-in-dialog + `BodyScrollLockService`) with `delete-trip-dialog`'s danger visuals.
- **Password field**: reuse shared `<app-password-field>` as-is (no changes to shared components).
- **Wrong password** (`400`, `code: INVALID_CURRENT_PASSWORD`): inline error on the field via
  `setErrors({ serverError: true })` — the same pattern as change-password.
- **Success path**: `forceLogout()` (local clear + redirect, no `POST /auth/logout` — the token is
  already dead). No success toast: the toast outlet lives in the dashboard layout, which is gone
  after the redirect.
- **Chat scope included**: nullable model fields, "Deleted user" placeholder, and a null-guard fix
  in `isOwn()`.

## API contract

- `DELETE /users/me`, body `{ "password": "<current password>" }`
  - `204` — account deleted, token blacklisted.
  - `400` `code: "INVALID_CURRENT_PASSWORD"` — inline error on the password field.
  - `400` with `fieldErrors` (blank password) — prevented client-side by a `required` validator.
  - `401` — handled by the existing error interceptor (`forceLogout`).
- Chat messages: `senderId: number | null`, `senderName: string | null`.

## Frontend changes

- `core/services/user.service.ts`
  - `deleteAccount(password)` → `http.delete<void>(`${apiUrl}/me`, { body: { password } })`
    (HttpClient delete-with-body; first use in this codebase).
  - `clearCurrentUser()` → resets `_currentUser` to `null`, `_loading` to `true`, so a later
    login with a different account can't flash the deleted user's cached data.
- `features/settings-page/delete-account-dialog.component.{ts,html}` (new)
  - Signals: `isOpen`, `loading`, `errorMessage`. Form: `{ password: ['', required] }`.
  - `open()` resets form + error, locks body scroll; `close()` refuses while loading, unlocks;
    Escape and backdrop click close; `ngOnDestroy` unlocks if still open (401-mid-dialog backstop).
  - `onSubmit()`: double-submit guard on `loading()`; invalid → `markAllAsTouched()`.
    Success → unlock scroll → `clearCurrentUser()` → `forceLogout()`.
    `INVALID_CURRENT_PASSWORD` → inline field error; anything else → generic banner in the dialog.
  - Content: warning header, intro, 4 consequence bullets (member trips / owned trips /
    sole-member trips / chat messages), password field, Cancel + danger Confirm.
- `features/settings-page/settings-page.component.{ts,html}`
  - Third `<section>` card (danger accent: `bg-error/10` chip, `delete_forever` icon) with a
    right-aligned danger button; dialog opened via `viewChild(DeleteAccountDialogComponent)`.
- `core/models/chat.model.ts` — `senderId`/`senderName` become nullable.
- `features/trips/trip-detail/trip-chat-section.component.{ts,html}`
  - Name renders `senderName` or an italic "Deleted user" placeholder; avatar initials already
    fall back to `?` (`initialsOf` is null-safe).
  - `isOwn()` gains a null guard: `senderId !== null && senderId === currentUserId()` — without
    it, deleted-author messages render as "own" while `currentUserId` is still `null` (loading).
- `public/assets/i18n/{en,hr}.json` — new `SETTINGS.DELETE_ACCOUNT` block +
  `TRIPS.DETAIL.CHAT.DELETED_USER`.

## i18n wording (for review)

| Key (`SETTINGS.DELETE_ACCOUNT.`) | EN | HR |
|---|---|---|
| `TITLE` | Delete account | Brisanje računa |
| `SUBTITLE` | Permanently delete your account and personal data. | Trajno izbrišite svoj račun i osobne podatke. |
| `BUTTON` | Delete account | Izbriši račun |
| `DIALOG.TITLE` | Delete your account? | Izbrisati račun? |
| `DIALOG.INTRO` | This can't be undone. Here's what happens: | Ovo se ne može poništiti. Evo što će se dogoditi: |
| `DIALOG.CONSEQ_MEMBER` | Trips you're a member of continue without you. | Putovanja na kojima ste član nastavljaju se bez vas. |
| `DIALOG.CONSEQ_OWNED` | Trips you own are handed over to their longest-standing member. | Vlasništvo nad vašim putovanjima prenosi se na najdugovječnijeg člana. |
| `DIALOG.CONSEQ_SOLE` | Trips where you're the only member are permanently deleted, including their cover image. | Putovanja na kojima ste jedini član trajno se brišu, uključujući naslovnu sliku. |
| `DIALOG.CONSEQ_CHAT` | Your chat messages remain, shown as written by a deleted user. | Vaše poruke u razgovorima ostaju, prikazane kao poruke izbrisanog korisnika. |
| `PASSWORD_LABEL` | Confirm with your password | Potvrdite lozinkom |
| `PASSWORD_PLACEHOLDER` | Your current password | Vaša trenutna lozinka |
| `PASSWORD_REQUIRED` | Password is required. | Lozinka je obavezna. |
| `INVALID_PASSWORD` | Password is incorrect. | Lozinka nije točna. |
| `CANCEL` | Cancel | Odustani |
| `CONFIRM` | Delete my account | Izbriši moj račun |
| `ERROR_GENERIC` | Couldn't delete your account. Please try again. | Brisanje računa nije uspjelo. Pokušajte ponovno. |

`TRIPS.DETAIL.CHAT.DELETED_USER`: EN "Deleted user" / HR "Izbrisani korisnik".

## Verification (manual, at the end)

- `ng build` clean — strict null checks surface any missed `senderName`/`senderId` usages.
- Settings: danger card renders; dialog opens and locks scroll; Escape / backdrop / Cancel close it.
- Empty password → inline "required" error, no request sent.
- Wrong password → inline "incorrect" error; close and reopen → clean form, no stale error.
- Correct password → redirected to `/auth/login`; `auth_token`, `auth_login_timestamp`,
  `auth_expires_in` removed from localStorage; login page scrolls normally.
- From a second account sharing a trip: the deleted user's messages show "Deleted user" with a
  `?` avatar, left-aligned, without edit/delete actions; owned trip shows the transferred owner;
  sole-member trip is gone.
- Switch language to HR → all new strings translated.
