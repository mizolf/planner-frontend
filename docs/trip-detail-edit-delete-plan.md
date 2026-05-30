# Plan: Trip Detail — Sekcija A (Uredi / obriši trip)

## Context

Trip detail stranica je nakon Phase 1 + invite flowa i dalje read-only za sam trip. Backend već podržava `PUT /trips/{id}` i `DELETE /trips/{id}`, ali frontend ih ne koristi. Ovaj plan implementira **samo sekciju A** iz `docs/trip-detail-crud.md`: uređivanje tripa kroz dialog i brisanje tripa kroz confirm dialog, s header kontrolama gated po roli (OWNER/EDITOR uređuju, samo OWNER briše).

Backend izmjene (orphan-day pruning, leave endpoint) su izvan opsega ovog plana — pretpostavljamo da orphan pruning na `PUT` postoji/dolazi zasebno. Sekcije B/C/D se rade kasnije.

**Odluke korisnika (iz konzultacije):**
- **Status polje:** izostavljeno iz edit forme (uskladi s create-trip; izbjegavamo borbu s backend auto-derivacijom statusa). `UpdateTripRequest` zato ne šalje `status`.
- **Overflow meni:** zatvara se preko nevidljivog backdrop overlaya (konzistentno s postojećim dialog `(click)="close()"` patternom).
- **Edit dialog baza:** `create-trip-dialog` (identičan set polja, dijeli validatore i shared komponente).
- **Orphan-day izvor:** self-contained — `open(trip)` spremi `trip.days` u signal; warning computed uspoređuje s trenutnim date kontrolama forme.

## Koraci izvođenja

Bez TDD-a i bez per-phase smoke testova (projekt ih izostavlja). Redoslijed: modeli → service → edit dialog → delete dialog → header → page → i18n.

### 1. Model — `src/app/core/models/trip.model.ts`
Dodaj `UpdateTripRequest` (sva polja opcionalna, **bez** `status` po odluci): `name?`, `description?`, `destination?`, `startDate?`, `endDate?`, `budget?`, `interests?: Interest[]`. Smjesti uz `CreateTripRequest`.

### 2. Service — `src/app/core/services/trip.service.ts`
Mirror postojećih optimističnih `tap()` mutatora (`addDayToTrip` ~89–106, `deleteDayFromTrip` ~186–200, `createTrip` ~54–60):
- `updateTrip(tripId, req: UpdateTripRequest): Observable<TripResponse>` → `PUT ${apiUrl}/${tripId}`. U `tap(updated => ...)`:
  - `_tripDetail.update(detail => detail ? { ...detail, ...updated } : detail)` — spread zadržava `days`/`members` (njih `TripResponse` nema).
  - `_trips.update(list => list.map(t => t.id === tripId ? { ...t, ...updated } : t))`.
- `deleteTrip(tripId): Observable<void>` → `DELETE ${apiUrl}/${tripId}`. U `tap()`: `_trips.update(list => list.filter(t => t.id !== tripId))` zatim `clearTripDetail()` (~83–87).
- Importaj `UpdateTripRequest` u postojeći model import blok.

### 3. Edit dialog — `features/trips/trip-detail/edit-trip-dialog.component.ts` (+ `.html`)
Baza: `features/trips/create-trip-dialog/create-trip-dialog.component.ts` (isti field set minus status). Reuse:
- Validatori iz `shared/validators/trip.validators.ts`: `endDateAfterStartDate('startDate','endDate')`, `budgetMaxDigits()`.
- `InterestChipsComponent`, `TextareaFieldComponent`, `FormFieldComponent` (shared).

Razlike:
- `open(trip: TripDetailResponse)`: `form.reset({...})` patcha name/destination/description/startDate/endDate/budget/interests iz `trip` (mirror edit-activity-dialog ~54–69); spremi `tripId` i `trip.days` u signale; postavi `isOpen`, `document.body.style.overflow`, očisti error.
- **Orphan-day warning:** `computed()` koji broji `days` čiji je `date` izvan trenutnog `[startDate, endDate]` iz forme. Reaktivnost na date kontrole preko `toSignal(control.valueChanges)` (NE `effect()` sa signal writeom — NG0600). Inline upozorenje "X dana bit će obrisano…" kad count > 0.
- `onSubmit()`: gradi `UpdateTripRequest` iz `form.getRawValue()`, zove `tripService.updateTrip(tripId, req)`; success → toast `TRIPS.DETAIL.EDIT.SUCCESS` + `close()`; error → `applyError` pattern iz add-day (~117–134): 400 `fieldErrors` → `control.setErrors({server})`, inače toast `TRIPS.DETAIL.EDIT.ERROR_GENERIC`.
- `isOpen`/`loading`/`errorMessage` signali, `@HostListener('document:keydown.escape')`, footer Odustani/Spremi — sve mirror add-day-dialog.

### 4. Delete dialog — `features/trips/trip-detail/delete-trip-dialog.component.ts` (+ `.html`)
Kopiraj `delete-day-dialog.component.ts`: `role="alertdialog"`, `_trip` signal, `isOpen = computed(() => _trip() !== null)`, `open(trip)`, escape handler, body-overflow.
- `confirm()` → `tripService.deleteTrip(trip.id)`; success → inject `Router`, `router.navigate(['/home'])`, toast `TRIPS.DETAIL.DELETE.SUCCESS`; error → toast `TRIPS.DETAIL.DELETE.ERROR_GENERIC`.

### 5. Header — `trip-detail-header.component.ts` (+ `.html`)
Trenutno čisto prezentacijska (`trip = input.required<TripDetailResponse>()`, root `<header class="relative">`).
- Dodaj: `canEdit = input(false)`, `canDelete = input(false)`, `edit = output<void>()`, `delete = output<void>()`, `menuOpen = signal(false)`, `toggleMenu()`/`closeMenu()`.
- `.html` (gornji desni blok uz avatare): `✎ Uredi` gumb gated `@if (canEdit())` → emit `edit`; `⋮` gumb gated `@if (canDelete())` → toggle menu. Meni stavka "Obriši trip" emit `delete` + close. **Backdrop overlay**: nevidljivi full-screen `<div>` iza menija, `(click)="closeMenu()"`, dok klik na meni `$event.stopPropagation()`.

### 6. Page — `trip-detail-page.component.ts` (+ `.html`)
Permission computeds već postoje (`isOwner` ~66, `canEditContent` ~68–71).
- `.ts`: importaj + dodaj u `imports` `EditTripDialogComponent` i `DeleteTripDialogComponent`; `@ViewChild` refovi (mirror ~75–89); `openEditTrip()` → `editTripDialog?.open(trip()!)`, `openDeleteTrip()` → `deleteTripDialog?.open(trip()!)`, oba uz `if (!this.trip()) return;`.
- `.html`: header → `<app-trip-detail-header [trip]="t" [canEdit]="canEditContent()" [canDelete]="isOwner()" (edit)="openEditTrip()" (delete)="openDeleteTrip()" />`; instanciraj oba dijaloga unutar postojećeg `@if (trip(); as t)` dialog bloka (~114–126).

### 7. i18n — `public/assets/i18n/en.json` + `hr.json`
Prefix je **`TRIPS.DETAIL.*`** (ne `TRIP_DETAIL.*`). Mirror susjeda `TRIPS.DETAIL.DAYS.ADD/DELETE.*` i `TRIPS.DETAIL.ACTIVITIES.EDIT.*`:
- `TRIPS.DETAIL.EDIT.*`: TITLE, SUBTITLE, field labeli (ili reuse `TRIPS.CREATE.*`), orphan-warning string s `{{count}}`, SUBMIT, CANCEL, SUCCESS, ERROR_VALIDATION, ERROR_GENERIC.
- `TRIPS.DETAIL.DELETE.*`: TITLE, MESSAGE, CONFIRM, CANCEL, SUCCESS, ERROR_GENERIC.
- Header CTA ključevi: `EDIT_CTA`, `DELETE_CTA`, `MENU_ARIA`.

Oba locale fajla držati u sinkroniziranom obliku.

## Datoteke

**Novo:**
- `src/app/features/trips/trip-detail/edit-trip-dialog.component.ts` (+ `.html`)
- `src/app/features/trips/trip-detail/delete-trip-dialog.component.ts` (+ `.html`)

**Izmjene:**
- `src/app/core/models/trip.model.ts`
- `src/app/core/services/trip.service.ts`
- `src/app/features/trips/trip-detail/trip-detail-header.component.ts` (+ `.html`)
- `src/app/features/trips/trip-detail/trip-detail-page.component.ts` (+ `.html`)
- `public/assets/i18n/en.json`, `public/assets/i18n/hr.json`

**Reuse bez izmjena:** `shared/validators/trip.validators.ts` (`endDateAfterStartDate`, `budgetMaxDigits`), `interest-chips.component.ts`, `textarea-field.component.ts`, `form-field.component.ts`, `toast.service.ts` (napomena: `Toast.type` je samo `'success' | 'error'`).

## Verifikacija (manualni smoke)

Backend `./mvnw spring-boot:run`, frontend `npm start`.
- **Uredi trip:** kao OWNER/EDITOR otvori `✎ Uredi` dialog, promijeni ime/budžet/interese → Spremi → header se ažurira bez reloada. VIEWER ne vidi `✎ Uredi`.
- **Datumi + orphan:** skrati raspon tako da postojeći dan ispadne → dialog upozori ("X dana bit će obrisano") → Spremi → dan nestane iz itinerara.
- **Obriši trip:** samo OWNER vidi `⋮ → Obriši trip`; backdrop klik zatvara meni → confirm → redirect na `/home`, trip nestao s liste.
- **i18n:** prebaci EN↔HR, provjeri da nema sirovih ključeva.
