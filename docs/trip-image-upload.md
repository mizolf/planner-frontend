# Trip image upload (frontend integration)

## Context

The backend now supports **one image per trip** and this feature wires it through the Angular app:
display the image everywhere trips are shown, and let OWNER/EDITOR upload/replace/delete it from
the trip detail page. Backend contract: `planner-backend/docs/trip-image-upload-frontend.md`.

What the backend gives us:
- `POST /trips/{tripId}/image` — multipart, field name **`file`**; returns the updated `TripResponse`.
- `DELETE /trips/{tripId}/image` — idempotent; returns `TripResponse` with `imageUrl: null`.
- A new **`imageUrl: string | null`** field on `TripResponse`, `TripDetailResponse`,
  `PublicTripSummaryResponse`, `PublicTripDetailResponse`. It's a **permanent public URL** — goes
  straight into `<img [src]>`, no token, no expiry. Each upload returns a **new** URL (new UUID),
  so there's no staleness and no cache-buster needed — just replace the value from the response.
- Allowed: **JPEG / PNG / WebP, max 5 MB**. Only **OWNER / EDITOR** may write (VIEWER → 403;
  non-member / missing trip → 404). Error codes: `INVALID_FILE` (400), `FILE_TOO_LARGE` (413),
  `IMAGE_UPLOAD_FAILED` (502).

Today the frontend ignores images entirely: trips have no `imageUrl`, and cards render a tonal
gradient placeholder (`ph-image`). No file-upload / `FormData` code exists anywhere yet — this is
the first instance.

> **Supersedes** `docs/TRIP-COVER-IMAGE-UPLOAD (at the end).md`, an earlier full-stack draft. The
> backend that was actually built diverged from it: it added a dedicated `DELETE` endpoint, put
> `imageUrl` on the public/community DTOs too, and uses fresh-UUID URLs (no `?t=` cache-buster).
> That draft also assumed upload lived in the edit-trip dialog and a `NO_IMAGE` icon placeholder —
> both no longer match. This doc is the current source of truth for the frontend.

### Decisions

- **UX = Hero + direct overlay.** A full-width cover banner sits at the top of the trip detail
  header (the image, or the existing gradient placeholder when empty). For OWNER/EDITOR, hovering
  the cover reveals **Change** and **Delete** controls; picking a file uploads immediately with a
  spinner over the cover; delete shows a small **inline** confirm on the cover (no separate modal).
  Rejected: a preview-dialog flow (more clicks, extra modal file) — the direct overlay matches a
  "change cover photo" mental model.
- **Display on cards is read-only** — my-trips + community grids show the image; no controls there.
- **`imageUrl` typed as `string | null`** (matches backend; not optional `?`).
- **Cover is its own component** (`app-trip-cover`), self-contained (calls the service + toast
  directly, like the dialog components), so the header component stays almost untouched.
- **Patch only `imageUrl`** into the service signals on upload/delete — never spread the whole
  `TripResponse` into the detail signal (would clobber `days`/`members`).

## Key reuse (don't reinvent)

- **Image-or-placeholder idiom** already used by `template-card.component.html`:
  `[ngClass]="x.imageUrl ? '' : 'ph-image ph-image-' + tone()"` with
  `@if (imageUrl) { <img class="absolute inset-0 w-full h-full object-cover"> } @else { gradient + coverLabel }`.
  Trip card and public card already have the `ph-image` slot + `tone()` / `coverLabel()` helpers.
- **Service pattern**: `updateTrip` / `setVisibility` in `trip.service.ts` use `.pipe(tap(...))` to
  patch both `_tripDetail` and `_trips` signals so every card updates reactively.
- **Role gate**: the header already receives `canEdit` = `canEditContent()` (OWNER/EDITOR) from
  `trip-detail-page.component.ts` — reuse it, no new role logic.
- **Toasts**: `ToastService.show({ message: 'KEY', type: 'success' | 'error' })`.
- **Auth interceptor** attaches `Authorization` without setting `Content-Type`, so a `FormData`
  body gets the correct multipart boundary automatically — **do not set `Content-Type` manually**.
- Styling: Tailwind M3 tokens (`surface-*`, `on-*`, `primary`, `error`…), `rounded-hero` /
  `rounded-card`, Material Symbols icons (`photo_camera` / `add_photo_alternate` / `delete`). No
  spinner component exists — use an overlay + `animate-pulse` or the label-swap convention.

## Frontend implementation (`planner-frontend`)

### 1. Models — add `imageUrl`
- `core/models/trip.model.ts` — add `imageUrl: string | null;` to `TripResponse`
  (automatically covers `TripDetailResponse`, which `extends TripResponse`).
- `core/models/community.model.ts` — add `imageUrl: string | null;` to both
  `PublicTripSummaryResponse` and `PublicTripDetailResponse` (neither extends anything).

### 2. Validation helper — new `shared/utils/image-file.ts`
```ts
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// returns a translation KEY describing the problem, or null when valid
export function validateImageFile(file: File): string | null { ... }
```
Pre-check before upload (UX only; backend re-validates the actual file content anyway).

### 3. Service methods — `core/services/trip.service.ts`
Mirror `setVisibility`'s single-field patch:
```ts
uploadTripImage(tripId: number, file: File): Observable<TripResponse> {
  const formData = new FormData();
  formData.append('file', file);                       // field name MUST be "file"
  return this.http.post<TripResponse>(`${this.apiUrl}/${tripId}/image`, formData)
    .pipe(tap((updated) => this.patchImageUrl(tripId, updated.imageUrl)));
}
deleteTripImage(tripId: number): Observable<TripResponse> {
  return this.http.delete<TripResponse>(`${this.apiUrl}/${tripId}/image`)
    .pipe(tap((updated) => this.patchImageUrl(tripId, updated.imageUrl)));
}
private patchImageUrl(tripId: number, imageUrl: string | null): void {
  this._tripDetail.update((d) => d && d.id === tripId ? { ...d, imageUrl } : d);
  this._trips.update((ts) => ts.map((t) => t.id === tripId ? { ...t, imageUrl } : t));
}
```

### 4. Cover component — new `features/trips/trip-detail/trip-cover.component.{ts,html}`
Self-contained; injects `TripService` + `ToastService`.
- **Inputs** (signal API): `tripId = input.required<number>()`,
  `imageUrl = input.required<string | null>()`, `tripName = input.required<string>()`,
  `canManage = input(false)`. **State**: `uploading = signal(false)`, `confirmingDelete = signal(false)`.
- **Template**: full-width cover (`rounded-hero`/`rounded-card`, ~`h-56`/`h-64`, `overflow-hidden`).
  Reuse the template-card idiom: `<img object-cover>` when `imageUrl()`, else `ph-image` gradient +
  a short cover label. Hidden `<input #fileInput type="file" accept="image/jpeg,image/png,image/webp">`.
- **Controls** (only when `canManage()`): hover-revealed cluster (top-right of the cover) —
  **Change/Add** → `fileInput.click()`; **Delete** (only when an image exists) → sets
  `confirmingDelete`. While `uploading()`: dim the cover, show a spinner/pulse overlay, disable
  controls. The delete confirm is a small centered overlay on the cover (Cancel / Remove).
- **Handlers**:
  - `onFileSelected(e)`: read `file`; `const err = validateImageFile(file)`; if `err` →
    `toast(err, 'error')` + reset input; else `upload(file)`.
  - `upload(file)`: `uploading.set(true)`; `uploadTripImage(...).subscribe({ next → success toast,
    error → mapError, finalize → uploading.set(false) + reset input.value })`.
  - `confirmDelete()`: `deleteTripImage(...).subscribe(...)`, toast, close confirm.
  - `mapError(err: HttpErrorResponse)` → toast key:
    `403`→FORBIDDEN · `404`→NOT_FOUND ·
    `413` / `code==='FILE_TOO_LARGE'` / `status===0`→TOO_LARGE (spec note: very large files may
    drop the connection instead of a clean 413) · `400` / `code==='INVALID_FILE'`→INVALID ·
    `502` / `code==='IMAGE_UPLOAD_FAILED'`→UPLOAD_FAILED · else GENERIC.

### 5. Wire the cover into the header — `features/trips/trip-detail/trip-detail-header.component.{ts,html}`
Import `TripCoverComponent`, add to `imports`, render as the first child of `<header>`:
```html
<app-trip-cover [tripId]="trip().id" [imageUrl]="trip().imageUrl"
                [tripName]="trip().name" [canManage]="canEdit()" />
```
`canEdit` is already bound to `canEditContent()` (OWNER/EDITOR) — no page/parent change needed.

### 6. Card display (read-only image)
Swap the gradient-only cover for the image-or-gradient idiom, keeping existing chips/overlays:
- `features/trips/trip-card/trip-card.component.html` — my-trips / home "Upcoming" / profile all
  reuse this card, so they update for free.
- `features/explore/public-trip-card/public-trip-card.component.html` — the community grid
  ("main visual use"); drop the stale "community has no uploads" comment.
- `features/explore/community-preview-dialog/community-preview-dialog.component.html` — if it
  renders a cover for `PublicTripDetailResponse`, wire `imageUrl` the same way (confirm its template).

### 7. i18n
Add `TRIPS.DETAIL.IMAGE.*` to the ngx-translate JSON files (`public/assets/i18n/{en,hr}.json`,
Croatian-first): `CHANGE`, `ADD`, `DELETE`, `UPLOADING`, `HINT` ("JPEG, PNG ili WebP · najviše 5 MB"),
`UPLOAD_SUCCESS`, `DELETE_SUCCESS`, `DELETE_CONFIRM`, and
`ERRORS.{INVALID_TYPE, TOO_LARGE, FORBIDDEN, NOT_FOUND, UPLOAD_FAILED, GENERIC}`. Mirror existing nesting.

## Data flow

**Upload (happy path):** hover cover → Change → OS file picker → `validateImageFile` →
`uploading=true`, spinner over cover → `POST /trips/{id}/image` (multipart; JWT auto-attached;
browser sets boundary) → 200 `TripResponse` → `patchImageUrl` updates `_tripDetail` + `_trips` →
cover `<img>` and every card re-render → success toast.
**Replace:** identical — same endpoint, new URL; backend deletes the old file.
**Delete:** Delete → inline confirm → `DELETE /trips/{id}/image` → `imageUrl: null` patched →
cover + cards revert to the gradient placeholder → success toast.

| Situation | Behavior |
|-----------|----------|
| Client validation fails (type/size) | Error toast, no request sent |
| 400 `INVALID_FILE` / 413 `FILE_TOO_LARGE` / network abort >5 MB | Mapped error toast |
| 403 (VIEWER) / 404 (non-member) | Mapped error toast (controls normally hidden for VIEWER) |
| 502 `IMAGE_UPLOAD_FAILED` | "try later" toast; `imageUrl` unchanged |

## Verification (manual smoke — `npm start`, backend on `:8080`)

1. **Upload** — open a trip you OWN → hover cover → Change → pick a JPEG/PNG/WebP < 5 MB → spinner →
   cover shows the image + success toast. Check my-trips + community: image appears on the cards.
2. **Replace** — Change with a different file → new image (new URL) renders.
3. **Delete** — Delete → inline confirm → Remove → cover + cards revert to the gradient placeholder.
4. **Client validation** — pick a `.gif`/`.pdf` or a > 5 MB file → error toast, no request sent
   (verify in the Network tab).
5. **Role gating** — open a trip where you're VIEWER → no Change/Delete controls; image still displays.
6. **Backend errors** (optional) — VIEWER forcing an upload → 403 toast; a server/oversize path
   shows the mapped message.
7. `npm run build` compiles with no type errors (models + service typed against the new `imageUrl`).

## Files

**New:** `shared/utils/image-file.ts`, `features/trips/trip-detail/trip-cover.component.{ts,html}`.
**Edit:** `core/models/trip.model.ts`, `core/models/community.model.ts`,
`core/services/trip.service.ts`, `features/trips/trip-detail/trip-detail-header.component.{ts,html}`,
`features/trips/trip-card/trip-card.component.html`,
`features/explore/public-trip-card/public-trip-card.component.html`,
(maybe) `features/explore/community-preview-dialog/community-preview-dialog.component.html`,
`public/assets/i18n/{en,hr}.json`.
