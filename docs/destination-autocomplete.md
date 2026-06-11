# Destination Autocomplete

## Why

The destination field in the create-trip and edit-trip dialogs is a plain text input. We want typing suggestions so users can pick a real place, and we want to capture the **latitude/longitude** of the picked place — a later feature will show trip destinations on a map using **Leaflet + OpenStreetMap** (free, no API key, no billing). A pin placed by raw coordinates needs no geocoding service at display time, and Photon is OSM data too, so the autocomplete and the future map share the same data source.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Suggestion provider | **Photon** (`https://photon.komoot.io/api/`), called directly from the frontend | Free, no API key, no billing setup, no backend proxy needed |
| Data shape | `destination` stays a display string; trip gains optional `latitude`/`longitude` | Minimal model change; coordinates are all the future map needs |
| Free text | **Allowed** — picking a suggestion is optional | Autocomplete is a typing aid, not a gate; obscure places Photon doesn't know must not block the user |
| Coordinate lifecycle | Pick sets coords; any manual keystroke afterwards clears them | Edited text no longer matches the picked place |
| Backend | Separate Spring Boot repo persists the two new fields later | Spring ignores unknown JSON fields by default, so the frontend ships first |

## Architecture

```
create-trip-dialog ─┐
                    ├─> <app-destination-autocomplete> ──> GeocodingService ──> photon.komoot.io
edit-trip-dialog  ──┘         (shared component)              (core service)
```

Three new/changed units:

1. **`GeocodingService`** (new, `src/app/core/services/geocoding.service.ts`) — wraps the Photon HTTP call, maps GeoJSON to a simple suggestion model.
2. **`DestinationAutocompleteComponent`** (new, `src/app/shared/components/destination-autocomplete/`) — input field with dropdown; mirrors `FormFieldComponent`'s API so the dialogs barely change. `FormFieldComponent` itself stays untouched.
3. **Both trip dialogs** — swap the destination `<app-form-field>` for the new component and track coordinates in a signal.

## GeocodingService

```ts
export interface DestinationSuggestion {
  label: string;      // "Vienna, Austria"
  latitude: number;
  longitude: number;
}

export interface GeoBias { latitude: number; longitude: number; }

search(query: string, bias?: GeoBias): Observable<DestinationSuggestion[]>
```

- `GET https://photon.komoot.io/api/?q={query}&limit=8&lang=en`. The URL is a hardcoded constant — intentionally **not** `environment.apiUrl`, because this is an external service.
- `lang=en` is fixed, **not** wired to the app's language switcher: Photon supports only a few languages (en/de/fr/it — no Croatian), so Croatian users see "Vienna, Austria" rather than "Beč, Austrija". Accepted trade-off.
- When `bias` is provided, add `lat`/`lon` params — Photon then ranks results near that point first. Unused by the trip destination field (global search); built in now for phase 2, where activity-location search is biased toward the trip's coordinates.
- The auth interceptor (`src/app/auth/interceptors/auth.interceptor.ts`) early-returns for any request not starting with `environment.apiUrl`, so the Bearer token is never sent to Photon. **No interceptor change needed.**
- Photon returns a GeoJSON `FeatureCollection`. `geometry.coordinates` is **`[lon, lat]` — must be swapped** when mapping to `latitude`/`longitude`.
- Label building: `[name, city (when present and ≠ name), country].filter(Boolean).join(', ')`.
- Dedupe by lowercased label, keeping the first occurrence (Photon is relevance-ranked); request 8, display at most 5. Features missing `properties.name` or valid coordinates are skipped.
- `catchError(() => of([]))` — Photon being down must never break the form; free text still works.

## DestinationAutocompleteComponent

Mirrors `FormFieldComponent`'s integration pattern (`viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }]` + `controlName`), and copies its template markup/Tailwind classes so it is visually identical. Uses modern APIs only: `inject()`, `input()`, `output()`, `signal()`.

**Inputs:** `label`, `icon` (default `location_on`), `placeholder`, `controlName`, `errors` — same semantics as `FormFieldComponent` — plus optional `bias = input<GeoBias | null>(null)`, passed through to `GeocodingService.search()` (unused in phase 1; the trip dialogs don't set it).

**Outputs:**
- `selected: DestinationSuggestion` — user picked a suggestion
- `cleared: void` — user typed manually (coordinates are now stale)

**Internal state (signals):** `suggestions`, `dropdownOpen`, `searching`, `noResults`, `activeIndex`.

### Search pipeline

Driven by the DOM `(input)` event, **not** `control.valueChanges`:

> `EditTripDialogComponent.open()` calls `form.reset({...})`, which fires `valueChanges`. If the pipeline listened there, opening the edit dialog would trigger a phantom Photon search and wipe the prefilled coordinates. The `(input)` event only fires on real user keystrokes. **Do not refactor this to `valueChanges`.**

```
(input) ──> Subject<string> ──> debounceTime(300) ──> distinctUntilChanged()
        ──> switchMap(q => q.trim().length < 2 ? of(null) : geocoding.search(q))
        ──> takeUntilDestroyed() ──> update signals
```

Every keystroke also emits `cleared` (the parent nulls its stored coordinates). Signal writes happen in `subscribe`, which is fine — the NG0600 restriction applies only to `effect()`.

### Keyboard & mouse behavior

| Key/action | Dropdown open | Dropdown closed |
|---|---|---|
| ArrowDown / ArrowUp | Move highlight (wraps), `preventDefault()` | — |
| Enter | Pick highlighted item, `preventDefault()` (**prevents dialog form submit**) | Normal form submit |
| Escape | Close dropdown, `stopPropagation()` (**prevents the dialog's `document:keydown.escape` close**) | Dialog closes as usual |
| Click on option | Select — handled via `(mousedown)` + `preventDefault()` so the input doesn't blur first | — |
| Click outside | Close dropdown (`document:click` listener + `ElementRef.contains`) | — |
| Blur (e.g. Tab away) | Close dropdown — safe because option clicks never blur (see `(mousedown)` row) | — |

### Dropdown UI

Absolutely positioned panel under the input within the component's `relative` wrapper: `absolute z-10 top-full mt-1 w-full bg-surface-container-lowest border rounded-lg shadow-lg max-h-60 overflow-auto`. Three row states: searching (`DESTINATION_AUTOCOMPLETE.SEARCHING`), no results (`DESTINATION_AUTOCOMPLETE.NO_RESULTS`), and suggestion rows (`location_on` icon + label, highlight on `activeIndex`/hover).

Accessibility: input `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-activedescendant`; panel `role="listbox"`; rows `role="option"` with per-index ids. `autocomplete="off"` suppresses the browser's native dropdown.

## Model changes

`src/app/core/models/trip.model.ts`:

```ts
interface CreateTripRequest { /* existing */ latitude?: number; longitude?: number; }
interface UpdateTripRequest { /* existing */ latitude?: number | null; longitude?: number | null; }
interface TripResponse      { /* existing */ latitude: number | null; longitude: number | null; }
```

`UpdateTripRequest` allows explicit `null` so the edit dialog can clear coordinates server-side. `TripDetailResponse` inherits from `TripResponse`. This is the contract the Spring Boot backend implements later (two nullable columns + DTO fields).

## Dialog integration

Both dialogs (`create-trip-dialog`, `edit-trip-dialog`):

- New signal: `coords = signal<{ lat: number; lon: number } | null>(null)`.
- `(selected)` sets it; `(cleared)` nulls it.
- Template: replace the destination `<app-form-field>` with `<app-destination-autocomplete>` using the same `label`/`icon`/`controlName`/`placeholder`/`[errors]` bindings plus the two outputs. `FormFieldComponent` stays imported — other fields still use it.

**Create dialog:** `open()` resets `coords`; `onSubmit()` adds `latitude`/`longitude` to the request only when coords exist (matches the existing omit-if-absent style for `description`/`budget`).

**Edit dialog:** `open(trip)` seeds `coords` from `trip.latitude`/`trip.longitude` (prefill survives because `form.reset` doesn't fire `(input)`); `onSubmit()` always sends `latitude: coords?.lat ?? null`, `longitude: coords?.lon ?? null` — the edit payload is a full replace, so typing over a previously geocoded destination clears the stored coordinates.

`TripService` needs no changes — it passes request objects through.

## i18n

New top-level block in `public/assets/i18n/en.json` and `hr.json` (the component is shared, not trip-specific):

```json
"DESTINATION_AUTOCOMPLETE": {
  "SEARCHING": "Searching…",            // hr: "Pretraživanje…"
  "NO_RESULTS": "No matching places found"  // hr: "Nema pronađenih mjesta"
}
```

Existing `TRIPS.CREATE.DESTINATION_*` keys are reused for label, placeholder, and validation errors.

## Verification (manual smoke, frontend-only)

1. `npm start`, log in, open Create Trip.
2. Type `vie` → exactly one request to `photon.komoot.io` after the ~300 ms debounce, **no `Authorization` header**; at most 5 deduped suggestions; brief "Searching…" row.
3. One character → no request. Block Photon in DevTools → "No matching places found"; form still submits with free text.
4. ArrowDown + Enter fills "Vienna, Austria" **without submitting the dialog**; Escape closes only the dropdown, a second Escape closes the dialog; mouse click selects; clicking elsewhere closes the dropdown.
5. Pick a suggestion and submit → `POST /trips` body contains numeric `latitude`/`longitude`; sanity-check the lon/lat swap (Vienna ≈ lat 48.2, lon 16.4). Backend accepts the extra fields (Spring ignores unknown JSON properties) — confirm the trip is created.
6. Free text without picking → payload has no coordinates. Pick, then type one more character → also none.
7. Edit dialog: open → destination prefilled, **no Photon request fires**; save untouched → `PUT` body carries `latitude`/`longitude` (`null` until the backend returns them — known gap, see below).
8. Switch language to HR → dropdown strings translated.

## Phase 2 (separate feature, own spec)

Activity locations get the same treatment: activities already have a `location: string` field; they gain optional `latitude`/`longitude`, and the activity dialogs swap their plain location input for `<app-destination-autocomplete>` with `[bias]` set to the trip's coordinates — Photon then suggests POIs (hotels, restaurants, attractions) near the trip destination instead of worldwide. Trips whose destination was free text (no coords) fall back to unbiased global search. Out of scope for this spec; listed here so phase 1 builds the service/component with bias support from the start.

## Known gaps & risks

- **Edit roundtrip gap:** until the backend persists and returns `latitude`/`longitude`, every edit-save sends `null` coordinates. Once the backend lands, prefill works with zero frontend changes.
- **Photon fair use** (public instance, ~1 req/s guideline): 300 ms debounce + `distinctUntilChanged` + 2-char minimum + `switchMap` cancellation keeps usage well below it.
- **Refactor hazard:** moving the search pipeline to `valueChanges` would silently break edit-dialog prefill (phantom search + coordinate wipe). The `(input)`-event decision is deliberate.
