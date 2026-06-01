# Spec: Trip cover image upload

**Status:** approved for implementation
**Scope:** full-stack (Spring Boot backend + Angular frontend) + one-time Supabase setup
**Feature:** let a trip owner/editor set a single cover image per trip, uploaded from the edit-trip dialog, displayed in the trip card and detail header.

---

## 1. Context & motivation

Trips currently have **no image**. The trip card (`trip-card.component.html`) shows a static `NO_IMAGE` placeholder (a `landscape` icon + translated text), and the trip detail header is text-only. There is **no upload infrastructure anywhere** in the app — no `<input type="file">`, no `FormData`, no multipart requests. Images are only ever *displayed* (e.g. explore templates render `<img [src]="imageUrl">`), never uploaded by users. On the backend, the `Trip` entity has no image field, there is no upload endpoint, and no file storage is configured.

A cover image makes trips visually distinguishable in the list and gives the detail page a sense of place. This feature adds the full path: a place to store the file, a backend endpoint to receive and persist it, and frontend UI to upload and display it.

The feature spans **three layers**:

```
Supabase Storage  ←  Spring Boot backend  ←  Angular frontend
(where the file        (upload endpoint +       (file input in edit
 physically lives)      imageUrl column)          dialog + display)
```

---

## 2. Decisions (and why)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Storage = Supabase Storage** (existing project `planner-db`, ref `lxptrhxhtjvrtmfjtibu`, eu-west-1) | The user already has this Supabase project (likely the prod Postgres). Reusing it avoids standing up S3/MinIO for a thesis project. The **dev DB stays local Postgres** — Supabase is introduced *purely as a storage provider*; JPA/Flyway/relational data are untouched. |
| 2 | **Upload path = backend-mediated** (frontend → Spring Boot → Supabase) | The app authenticates with a **Spring-issued JWT, not Supabase Auth**, so Supabase RLS/Auth can't enforce "who may edit this trip." Routing the upload through the backend keeps the `service_role` secret server-side, reuses the existing JWT auth + interceptor, and lets the existing role logic (OWNER/EDITOR) authorize the write. For occasional small cover images, the extra bandwidth through the server is negligible. |
| 3 | **Bucket = public** (`trip-images`) | Trip cover images aren't sensitive. A public bucket means display is a plain `<img [src]>` with a public URL — no signed-URL generation on every render. |
| 4 | **One cover image per trip** | Store the resulting public URL in a new `Trip.imageUrl` string. A gallery (multiple images) is out of scope — much larger (separate storage model, grid UI, per-image delete). |
| 5 | **Entry point = edit-trip dialog only; add/replace, no remove (v1)** | The edit dialog already exists and is the natural place to manage trip metadata. Skipping a "remove" option (and its `DELETE` endpoint) keeps v1 small; it can be added later. |
| 6 | **No activity-feed event on image change** | The image isn't a tracked field; emitting `TRIP_UPDATED` on every upload would add noise to the feed. |
| 7 | **Cache-busting via `?t=<epoch>` on the stored URL** | The object path is stable (`cover.<ext>`, overwritten on replace), so the public URL wouldn't change and browsers/CDN could serve a **stale** image. Appending a timestamp query to the stored `imageUrl` makes the field change on each upload, forcing `<img>` to reload. |
| 8 | **Orphan files accepted (v1)** | Changing extension (e.g. `.jpg` → `.png`) leaves the old object orphaned. Deleting the prior object is a follow-up; for v1 the minor orphan is acceptable. |

---

## 3. Supabase one-time setup (manual)

The project `planner-db` is currently **INACTIVE** and must be resumed before any upload works.

1. Resume `planner-db` in the Supabase dashboard; wait until ACTIVE.
2. **Storage → New bucket:** name `trip-images`, **Public = ON**. (Optional defense-in-depth in the dashboard: 5 MB size limit, allowed MIME `image/jpeg, image/png, image/webp`. Server-side validation remains the source of truth.)
3. Collect three values for the backend:
   - Project URL: `https://lxptrhxhtjvrtmfjtibu.supabase.co`
   - **`service_role` key** (Settings → API → service_role secret) — server-side only, never shipped to the browser.
   - Bucket name: `trip-images`

### Supabase Storage REST API (what the backend calls)

Upload / replace (upsert):

```
PUT  {SUPABASE_URL}/storage/v1/object/{bucket}/trips/{tripId}/cover.{ext}
Headers:
  Authorization: Bearer {service_role}
  apikey:        {service_role}
  Content-Type:  {file MIME, e.g. image/jpeg}
  x-upsert:      true            # overwrite on replace (POST would 400 "already exists")
Body: raw file bytes (binary)
```

Public URL stored on the trip (with cache-buster):

```
{SUPABASE_URL}/storage/v1/object/public/{bucket}/trips/{tripId}/cover.{ext}?t={epochMillis}
```

---

## 4. Backend design (`/Users/mcesnik/dev/diplomski/planner-backend`)

> **Important constraints discovered in the repo:**
> - `spring.jpa.hibernate.ddl-auto=validate` → the new column **must** exist via a Flyway migration or the app won't boot. Flyway runs before Hibernate validation, so migration + entity field ship together.
> - **No HTTP client exists yet** (no RestTemplate/WebClient/RestClient). Use **`RestClient`** — synchronous, modern, already available through `spring-boot-starter-webmvc` (no new dependency).
> - Migrations live in `src/main/resources/db/migration/`, named `V<n>__snake_case.sql`; latest is `V3__add_member_left_event_type.sql`.
> - Editing a trip is authorized by `TripAuthorizationService.validateEditorOrOwner(...)` (VIEWER → 403 `ForbiddenException`, non-member → 404 `ResourceNotFoundException`), already used by `TripService.updateTrip`.
> - Errors are returned by `GlobalExceptionHandler` (`@RestControllerAdvice`) as `ErrorResponse(status, code, message)`.
> - Secrets are wired with `${ENV_VAR}` in `application.properties` + `spring.config.import=optional:file:.env`, read via `@Value` (see `JwtService`).

### Files to create

- **`src/main/resources/db/migration/V4__add_trip_image_url.sql`**
  ```sql
  ALTER TABLE public.trips ADD COLUMN image_url character varying(2048);
  ```
  Widened past the usual 255 to fit the public URL + cache-buster query.
- **`service/SupabaseStorageService.java`** — `RestClient` PUT to Supabase Storage with the headers above; on 2xx builds and returns the public URL with `?t=<epoch>`; on non-2xx throws `SupabaseStorageException` via `.onStatus(...)`. Config injected with `@Value` (`supabase.storage.url/service-key/bucket`).
- **`exception/InvalidImageException.java`** — maps to **400**, carries a `code` (`IMAGE_TYPE` or `IMAGE_SIZE`).
- **`exception/SupabaseStorageException.java`** — maps to **502**, code `IMAGE_UPLOAD_FAILED`.

### Files to modify

- **`model/Trip.java`** — `@Column(name = "image_url") private String imageUrl;` (Lombok `@Getter/@Setter/@Builder` cover accessors).
- **`responses/TripResponse.java`** — add `private String imageUrl;`.
- **`mapper/TripMapper.java`** — set `imageUrl` in both `toResponse(...)` and `toDetailResponse(...)`. (No change to create/update request DTOs — the image is set only via the dedicated endpoint.)
- **`controller/TripController.java`** — new endpoint (mirrors existing `getCurrentUser()` + `ResponseEntity` style):
  ```java
  @PostMapping(value = "/{tripId}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<TripResponse> uploadCoverImage(
          @PathVariable Long tripId,
          @RequestParam("file") MultipartFile file) {
      return ResponseEntity.ok(tripService.uploadCoverImage(tripId, file, getCurrentUser()));
  }
  ```
  The form-field name `"file"` must match the frontend `FormData` key.
- **`service/TripService.java`** — `uploadCoverImage(Long tripId, MultipartFile file, User currentUser)`:
  1. `authorizationService.validateEditorOrOwner(tripId, currentUser)` (reuse — keeps VIEWER→403 / non-member→404 identical to PUT).
  2. `Trip trip = tripRepository.findById(tripId).orElseThrow(...)`.
  3. Validate the file (see below) — throws `InvalidImageException` on violation.
  4. `String url = supabaseStorageService.uploadCover(...)`.
  5. `trip.setImageUrl(url); tripRepository.save(trip);` — saved **only after** a successful upload, so a storage failure leaves `imageUrl` unchanged (no partial state).
  6. `return tripMapper.toResponse(trip);` (no activity-feed event).
- **`exception/GlobalExceptionHandler.java`** — add handlers: `InvalidImageException` → 400, `SupabaseStorageException` → 502, both using the existing `ErrorResponse` shape with their `code`.
- **`src/main/resources/application.properties`** — add:
  ```properties
  supabase.storage.url=${SUPABASE_URL}
  supabase.storage.service-key=${SUPABASE_SERVICE_KEY}
  supabase.storage.bucket=${SUPABASE_BUCKET:trip-images}
  spring.servlet.multipart.max-file-size=5MB
  spring.servlet.multipart.max-request-size=6MB
  ```
- **backend `.env`** (git-ignored, loaded via `optional:file:.env`) — `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET`.

### File validation (in the service, before upload)

- Reject `file.isEmpty()`.
- **Content type** ∈ {`image/jpeg`, `image/png`, `image/webp`} (from `file.getContentType()`); map type → extension (`jpg`/`png`/`webp`). **Do not** trust the client filename for the extension.
- **Size** ≤ 5 MB. The `spring.servlet.multipart.*` limits make oversized bodies fail cleanly rather than as a raw 500.
- On violation → `InvalidImageException` with code `IMAGE_TYPE` or `IMAGE_SIZE`.

### No change needed

`SecurityConfiguration` — `/trips/**` is already `authenticated()`; CORS already allows POST and `Content-Type`. (Supabase CORS is irrelevant since the upload is backend-mediated.)

---

## 5. Frontend design (`/Users/mcesnik/dev/diplomski/planner-frontend`)

> **Project conventions honored:** modern signal APIs (`input()`/`output()`/`inject()`); **no signal writes inside `effect()`** (NG0600) — use lifecycle/handler methods; don't modify working shared components. On the multipart request, **do not set `Content-Type` manually** — pass `FormData` and let the browser set the boundary. The `authInterceptor` attaches the JWT automatically (it keys off `environment.apiUrl`), and ignores absolute Supabase image URLs (they don't start with `apiUrl`).

### Files to modify

- **`src/app/core/models/trip.model.ts`** — add `imageUrl?: string;` to `TripResponse` (`TripDetailResponse extends TripResponse`, so it inherits the field).
- **`src/app/core/services/trip.service.ts`** — new method, mirroring the existing `updateTrip` signal-merge pattern:
  ```ts
  uploadCoverImage(tripId: number, file: File): Observable<TripResponse> {
    const formData = new FormData();
    formData.append('file', file);                 // key matches @RequestParam("file")
    return this.http.post<TripResponse>(`${this.apiUrl}/${tripId}/image`, formData).pipe(
      tap((updated) => {
        this._tripDetail.update((d) => (d ? { ...d, ...updated } : d));
        this._trips.update((trips) =>
          trips.map((t) => (t.id === tripId ? { ...t, ...updated } : t)));
      }),
    );
  }
  ```
- **`src/app/features/trips/trip-detail/edit-trip-dialog.component.ts`** — add local image signals, set in `open()` and the file handler (plain methods, never inside `effect()`):
  - `currentImageUrl = signal<string | null>(null)` — set from `trip.imageUrl ?? null` in `open()`.
  - `selectedFile = signal<File | null>(null)` — newly picked file (null = unchanged).
  - `previewUrl = signal<string | null>(null)` — `URL.createObjectURL(file)`.
  - `imageError = signal<string | null>(null)` — client-validation i18n key.
  - `displayImageUrl = computed(() => previewUrl() ?? currentImageUrl())`.
  - `onFileSelected(event)`: read `files?.[0]`, validate type + size mirroring the backend; on success revoke any previous object URL, set `previewUrl` + `selectedFile`, clear `imageError`; on failure set `imageError`, clear selection.
  - `close()`: `URL.revokeObjectURL(previewUrl())` and reset the image signals (avoid a memory leak).
  - `onSubmit()`: sequence PUT → upload with `switchMap` (add `switchMap`, `of` imports):
    ```ts
    this.tripService.updateTrip(tripId, request).pipe(
      switchMap((trip) => {
        const f = this.selectedFile();
        return f ? this.tripService.uploadCoverImage(tripId, f) : of(trip);
      }),
    ).subscribe({ next: () => { /* close + toast */ }, error: (err) => this.applyError(err) });
    ```
    Reuse the existing `loading` signal across both calls. Extend `applyError` to special-case `err.error?.code` ∈ {`IMAGE_TYPE`, `IMAGE_SIZE`, `IMAGE_UPLOAD_FAILED`} → matching i18n message; otherwise fall through to the existing branches. **If the PUT succeeds but the upload fails:** the text is already saved — show the image error and keep the dialog open for retry (no rollback).
- **`src/app/features/trips/trip-detail/edit-trip-dialog.component.html`** — add an image section: `<img [src]="displayImageUrl()">` in a fixed-aspect box (placeholder reusing the `landscape` icon when null); a hidden `<input type="file" accept="image/jpeg,image/png,image/webp">` triggered by a "Choose / Replace" button; an inline `@if (imageError())` line styled like existing field errors.
- **`src/app/features/trips/trip-detail/trip-detail-header.component.html`** — add a cover banner at the top of `<header>`: `@if (trip().imageUrl)` → `<img [src]="trip().imageUrl" [alt]="trip().name" class="... object-cover">` in a rounded fixed-height box. No TS change.
- **`src/app/features/trips/trip-card/trip-card.component.html`** — inside the placeholder div (lines 6–9): `@if (trip().imageUrl)` → `<img [src]="trip().imageUrl" [alt]="trip().name" class="w-full h-full object-cover" />`; `@else` → keep the current `landscape` icon + `HOME.NO_IMAGE`. No TS change.
- **`public/assets/i18n/en.json` + `hr.json`** — add `TRIPS.DETAIL.EDIT.IMAGE.{LABEL, CHOOSE, REPLACE, NONE, TYPE, SIZE, UPLOAD_FAILED}`. Reuse `HOME.NO_IMAGE` for the card.

### No change needed

`auth.interceptor.ts`, environment files, `trip-card.component.ts`, `trip-detail-header.component.ts`.

---

## 6. Data flow

**Happy path:**

1. User opens the edit dialog → `currentImageUrl` shows the existing image.
2. User picks a file → validated → `previewUrl` set → preview renders instantly (local object URL, no network).
3. Save → PUT `/trips/{id}` → `switchMap` → POST `/trips/{id}/image` (multipart; JWT auto-attached; browser sets the boundary).
4. Backend: authz EDITOR/OWNER → validate type + size → `RestClient` PUT bytes to Supabase (`x-upsert: true`) → build public URL + cache-buster → save `imageUrl` → return `TripResponse`.
5. `TripService.tap` merges the updated trip into `_tripDetail` + `_trips`.
6. Dialog closes, success toast; header and card `<img>` re-render.

**Error paths:**

| Situation | Behavior |
|-----------|----------|
| Client validation fails (type/size) | Inline error in dialog, no request sent |
| 403 (VIEWER) / 404 (non-member) | Existing generic error handling |
| 400 `IMAGE_TYPE` / `IMAGE_SIZE` | Mapped i18n message in dialog |
| 502 `IMAGE_UPLOAD_FAILED` (Supabase down/inactive) | Message shown, dialog stays open, DB unchanged |
| PUT ok but upload fails | Text saved; image error shown; dialog stays open for retry |

---

## 7. Edge cases & risks

1. **Supabase INACTIVE** — must be resumed and the bucket created before testing; until then every upload returns 502.
2. **Stale image after replace** — handled by the `?t=<epoch>` cache-buster baked into the stored `imageUrl`.
3. **Orphaned old file** on extension change — accepted for v1; deleting the prior object is a follow-up.
4. **`ddl-auto=validate`** — the `V4` migration must ship with the entity field, or boot fails.
5. **Prod vs dev config** — dev DB stays local Postgres; the 3 Supabase env vars must exist wherever the backend runs (dev `.env` now, prod env later). Frontend needs no env change.
6. **Multipart limits** — `spring.servlet.multipart.*` set so oversized uploads fail cleanly with a mapped error.
7. **`apikey` header** — Supabase Storage expects both `Authorization: Bearer` and `apikey` set to the service_role key.

---

## 8. Verification (end-to-end, manual)

1. Resume Supabase, create the `trip-images` public bucket, set the 3 env vars in the backend `.env`.
2. Start backend (`./gradlew bootRun`, dev profile) — confirm Flyway applies `V4` and the app boots (validate passes).
3. Start frontend (`npm start`), open a trip you own → edit dialog.
4. Pick a JPG/PNG/WebP → preview appears immediately. Save → toast; image shows in the header and on the trip card.
5. Re-open, pick a different image, save → new image replaces old (the `?t=` cache-buster forces a reload, not a stale image).
6. Negative: try a > 5 MB file and a non-image → inline `IMAGE_SIZE` / `IMAGE_TYPE` error, no upload.
7. Negative: as a VIEWER member → upload returns 403, handled gracefully.
8. Confirm in the Supabase dashboard the object exists at `trips/{tripId}/cover.{ext}` and the stored `imageUrl` opens publicly in a browser.

---

## 9. Files touched (summary)

**Backend — create:** `db/migration/V4__add_trip_image_url.sql`, `service/SupabaseStorageService.java`, `exception/InvalidImageException.java`, `exception/SupabaseStorageException.java`.
**Backend — modify:** `model/Trip.java`, `responses/TripResponse.java`, `mapper/TripMapper.java`, `controller/TripController.java`, `service/TripService.java`, `exception/GlobalExceptionHandler.java`, `application.properties`, `.env`.

**Frontend — modify:** `core/models/trip.model.ts`, `core/services/trip.service.ts`, `trip-detail/edit-trip-dialog.component.ts` + `.html`, `trip-detail/trip-detail-header.component.html`, `trip-card/trip-card.component.html`, `i18n/en.json` + `hr.json`.
