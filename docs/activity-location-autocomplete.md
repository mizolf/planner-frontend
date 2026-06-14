# Activity Location Autocomplete (Phase 2)

## Why

Phase 1 added a reusable `<app-destination-autocomplete>` component and a `GeocodingService`, and
wired them into the **trip destination** field — capturing optional `latitude`/`longitude` for a
future Leaflet + OpenStreetMap map. Phase 2 gives **activities** the same treatment: an activity
already has a plain `location: string`; it gains optional `latitude`/`longitude`, and the activity
Add/Edit dialogs swap their plain location text input for the autocomplete component.

The new twist is **bias**: when the parent trip has coordinates, activity searches are biased toward
them, so Photon ranks nearby POIs (hotels, restaurants, attractions) first instead of searching the
whole world. Trips with no coordinates (free-text destination) fall back to unbiased global search.
The `bias = input<GeoBias | null>(null)` input on the component was built in Phase 1 specifically for
this phase, so the component and service are **reused unchanged**.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Suggestion provider | **Photon** via the existing `GeocodingService` | Already built and proven in Phase 1; no changes needed |
| Data shape | `location` stays a display string; activity gains optional `latitude`/`longitude` | Minimal model change; mirrors the trip pattern |
| Bias source | The parent trip's `latitude`/`longitude` | Photon ranks results near the trip first; the core reason Phase 1 built the `bias` input |
| Threading bias into dialogs | Add a `bias: GeoBias \| null` param to each dialog's `open()` | Dialogs already use the imperative `@ViewChild` + `open()` pattern; a `bias` param is the minimal consistent extension. **Not** a template `input()`, **not** passing the whole trip object |
| Free text | **Allowed** — picking a suggestion is optional | Same as Phase 1; the autocomplete is a typing aid, not a gate |
| Coordinate lifecycle | Pick sets coords; any manual keystroke clears them (`(cleared)`) | Edited text no longer matches the picked place |
| Add-dialog submit | Add `latitude`/`longitude` **only when coords exist** (omit-if-absent) | Matches existing `location`/`category`/`cost` handling in the same dialog |
| Edit-dialog submit | **Always send** `latitude`/`longitude` (explicit `null` when no coords) | Mirrors the trip edit dialog; forward-looking for when the backend honors `null`. See *Known gaps* |
| Icon | Keep `icon="place"` | Preserves the current activity-location icon (trip uses the component default `location_on`) |
| `location` validator | Keep `Validators.maxLength(255)` | Still free text plus suggestions |
| Backend | Separate Spring Boot repo persists the two new fields later | Spring ignores unknown JSON fields, so the frontend ships first (same as Phase 1) |

## Architecture

```
trip-detail-page ─┬─> openAddActivity(day)  ──> add-activity-dialog.open(tripId, dayId, bias) ─┐
                  └─> openEditActivity(...)  ──> edit-activity-dialog.open(..., bias)          │
                                                                                                ├─> <app-destination-autocomplete> ──> GeocodingService ──> photon.komoot.io
                          trip.latitude/longitude ──> GeoBias | null ──────────────────────────┘        (reused unchanged)              (reused unchanged)
```

The parent (`trip-detail-page`) already holds the full trip via `trip = this.tripService.tripDetail`
(`TripDetailResponse`, which carries `latitude`/`longitude`). It builds a `GeoBias | null` inline and
passes it into `open()`.

## Model changes

`src/app/core/models/trip.model.ts` — coords are added to **all four** activity interfaces in lockstep.

> `ActivityResponse` and `TripActivityResponse` are structurally identical and used interchangeably:
> `TripDayResponse.activities` is typed `ActivityResponse[]`, while the day card declares
> `editActivity = output<TripActivityResponse>()` and emits items from that array. They only assign to
> each other because their shapes match. If only one gains `latitude`/`longitude`, the shapes diverge
> and the day card → edit dialog wiring stops compiling. **Change both response interfaces together.**

```ts
interface CreateTripActivityRequest { /* existing */ latitude?: number;        longitude?: number; }
interface UpdateTripActivityRequest { /* existing */ latitude?: number | null; longitude?: number | null; }
interface TripActivityResponse      { /* existing */ latitude: number | null;  longitude: number | null; }
interface ActivityResponse          { /* existing */ latitude: number | null;  longitude: number | null; }
```

`UpdateTripActivityRequest` allows explicit `null` so the edit dialog can clear coordinates server-side
(once the backend honors it). This is the contract the Spring Boot backend implements later.

## Reused unchanged

- **`GeocodingService`** (`src/app/core/services/geocoding.service.ts`) — already supports `bias`.
- **`DestinationAutocompleteComponent`** (`src/app/shared/components/destination-autocomplete/`) — fully generic; we only bind different inputs.
- **`FormFieldComponent`** — still used by every other field in the dialogs; untouched.
- **`TripService`** — `addActivityToDay` / `updateActivityInDay` pass request objects straight through.

## Dialog integration

Both dialogs (`add-activity-dialog`, `edit-activity-dialog` under
`src/app/features/trips/trip-detail/`) follow the trip-dialog pattern:

- New signals: `coords = signal<{ lat: number; lon: number } | null>(null)` and
  `bias = signal<GeoBias | null>(null)`.
- `(selected)` sets `coords`; `(cleared)` nulls `coords`.
- Template: replace the location `<app-form-field>` with `<app-destination-autocomplete>` using the
  same `label`/`icon="place"`/`controlName="location"`/`placeholder`/`[errors]` bindings, plus
  `[bias]="bias()"` and the two outputs. The field stays inside the existing `<form [formGroup]="form">`,
  which the component requires (`viewProviders` → `FormGroupDirective`).
- The dropdown's search pipeline is driven by the DOM `(input)` event, **not** `valueChanges`, so
  `form.reset()` in `open()` does not fire a phantom Photon search or clear seeded coords.

**Add dialog** (`add-activity-dialog.component.ts/.html`):
- `open(tripId, dayId, bias)` sets `bias`, resets `coords` to `null`; `close()` also resets both.
- `onSubmit()` adds `latitude`/`longitude` to the request **only when `coords` exist** (the existing
  omit-if-absent style used for `location`/`category`/`cost`).

**Edit dialog** (`edit-activity-dialog.component.ts/.html`):
- `open(tripId, dayId, activity, bias)` sets `bias` and seeds `coords` from
  `activity.latitude`/`activity.longitude` (prefill survives `form.reset` — pipeline is `(input)`-driven).
- `onSubmit()` **always** sends `latitude: coords()?.lat ?? null`, `longitude: coords()?.lon ?? null`.
  Existing `category`/`cost` stay conditional.

**Parent** (`trip-detail-page.component.ts`): `openAddActivity` / `openEditActivity` build the bias
inline and pass it through:

```ts
const bias = trip.latitude != null && trip.longitude != null
  ? { latitude: trip.latitude, longitude: trip.longitude } : null;
this.addActivityDialog?.open(trip.id, day.id, bias);
this.editActivityDialog?.open(trip.id, day.id, activity, bias);
```

## i18n

No new keys. The location field reuses the existing `TRIPS.DETAIL.ACTIVITIES.ADD.LOCATION_LABEL`,
`LOCATION_PLACEHOLDER`, `LOCATION_MAX`, and `ERROR_VALIDATION` keys (the edit dialog already reuses the
`ADD.*` location keys). The dropdown strings come from the top-level `DESTINATION_AUTOCOMPLETE`
(`SEARCHING`, `NO_RESULTS`) block added in Phase 1 — present in both `en.json` and `hr.json`.

## Verification (manual smoke, frontend-only)

1. `npm start`, log in, open a trip, Add activity → type ≥2 chars → exactly one debounced request to
   `photon.komoot.io`, **no `Authorization` header**; ≤5 deduped suggestions; brief "Searching…" row.
2. Pick a suggestion → input fills, dropdown closes → submit → `POST .../activities` body has numeric
   `latitude`/`longitude`; backend accepts (ignores unknown fields), activity is created.
3. Free text without picking → payload omits coords; `location` sent as typed.
4. Keyboard/mouse: ArrowDown + Enter selects **without submitting the dialog**; Escape closes only the
   dropdown, a second Escape closes the dialog; click-outside closes the dropdown.
5. Edit dialog: open an activity → location prefilled, **no Photon request fires**; save untouched →
   `PUT` body carries `latitude`/`longitude` (`null` until the backend returns coords — known gap).
6. Re-pick a suggestion in edit → `PUT` sends the new coords. `location` >255 chars → `maxlength` error
   shows, submit blocked.
7. Bias: observable only once trip coords are persisted (backend gap). Until then `bias` is `null` →
   global search; can be spot-checked by temporarily seeding `trip.latitude`/`trip.longitude`.
8. Day list still renders activities and edit still opens after the model change (confirms the
   `ActivityResponse` / `TripActivityResponse` lockstep edit).
9. Switch language to HR → dropdown strings translated.

## Backend follow-up (separate Spring Boot repo — not done here)

Not required to **ship** this frontend: Spring's Jackson ignores unknown JSON fields, so the extra
`latitude`/`longitude` are dropped without error. For the feature to work **end-to-end** the backend
later needs: two nullable columns on the activity table, the two fields on the activity create/update
request DTOs + the response DTO, and entity/mapper wiring.

## Known gaps & risks

- **Coords not persisted yet:** until the backend lands, the coords we send are dropped and
  `TripActivityResponse.latitude/longitude` return `null` → edit-prefill shows no coords.
- **Bias does nothing yet:** it depends on the *trip's* coords, whose backend persistence is also
  pending. Once both backends land, prefill and bias work with zero further frontend changes.
- **Edit clear-on-retype:** we always send `null` when coords are cleared, but the activity update
  endpoint currently *ignores nulls*, so retyping free text over a geocoded location won't clear the
  stored coords until the backend treats `null` as "clear" (or the field becomes a full replace).
- **Photon fair use:** unchanged from Phase 1 — 300 ms debounce + `distinctUntilChanged` + 2-char
  minimum + `switchMap` cancellation keep usage well within the public instance's ~1 req/s guideline.
```
