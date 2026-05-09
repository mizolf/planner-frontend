# Edit + Delete Activity

## Overview

Korisnik može uređivati i brisati postojeće aktivnosti iz trip detail stranice. Funkcionalnost se naslanja na već implementirani `add-activity-dialog` i mirrora isti UX language, dok dodaje dvije nove operacije na `TripService`.

| Operacija | HTTP | Endpoint |
|---|---|---|
| Update | PUT | `/trips/{tripId}/days/{dayId}/activities/{activityId}` |
| Delete | DELETE | `/trips/{tripId}/days/{dayId}/activities/{activityId}` |

## UX odluke

| Odluka | Vrijednost |
|---|---|
| Trigger za edit | Klik bilo gdje na activity row |
| Delete confirmation | Inline u istom dialogu (footer swap-a; **bez** drugog stacked modala) |
| Component shape | Novi `edit-activity-dialog` (separat od `add-activity-dialog`) |
| Clear semantika | `description`/`location` se mogu clear-ati slanjem `""`. Vremena se **ne mogu** clear-ati kroz edit (limitacija backend partial-update mappera). |
| i18n | Reuse postojećih `TRIPS.DETAIL.ACTIVITIES.ADD.*` ključeva za labele/placeholdere/error keys; novi samo za EDIT-specifične i DELETE-specifične stringove |

## Backend kontract

`UpdateActivityDTO` ima sva polja opcionalna (`name` također — bez `@NotBlank`). `ActivityMapper.updateEntity` radi partial update — null polja se preskaču. Posljedica: slanje `null` za bilo koje polje znači "ne mijenjaj", a slanje `""` (prazan string) za string polja znači "postavi na empty". `LocalTime` polja ne podržavaju `""` (parse error → 400), pa se vremena clear-aju samo brisanjem aktivnosti.

PUT vraća 200 + `ActivityResponse`. DELETE vraća 204 (no body).

## Plan implementacije

### 1. Model

`src/app/core/models/trip.model.ts` — dodati nakon `CreateTripActivityRequest`:

```ts
export interface UpdateTripActivityRequest {
  name?: string;
  description?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
}
```

### 2. Service — dvije nove metode

`src/app/core/services/trip.service.ts`. Reusati postojeći `compareByStartTime` komparator.

**`updateActivityInDay(tripId, dayId, activityId, request)`**

- HTTP PUT na endpoint
- `tap` ažurira `_tripDetail` signal: nađe pravi `day` po `dayId`, mapira `activities` zamjenjujući onu po `activityId` s rezultatom, **resort-a po `startTime`** (jer korisnik može mijenjati vrijeme).

**`deleteActivityFromDay(tripId, dayId, activityId)`**

- HTTP DELETE na endpoint
- `tap` filtrira aktivnost iz dan-a po `activityId`

Obje metode vraćaju `Observable` koji se subscribe-a u dialog komponenti.

### 3. Novi `edit-activity-dialog` component

**Files:**
- `src/app/features/trips/trip-detail/edit-activity-dialog.component.ts`
- `src/app/features/trips/trip-detail/edit-activity-dialog.component.html`

**Razlike od `add-activity-dialog`:**

| Aspekt | Add | Edit |
|---|---|---|
| Privatni signali | `_tripId`, `_dayId` | `_tripId`, `_dayId`, `_activityId`, `confirmingDelete` |
| `open(...)` | `(tripId, dayId)` | `(tripId, dayId, activity: TripActivityResponse)` — pre-fill forme |
| Submit metoda | POST | PUT |
| Footer | Cancel + Submit | Dva stanja: normalno (Delete + Cancel + Save) i confirming (poruka + Cancel + Yes-delete) |

**Pre-fill logika u `open()`:**

```ts
this.form.reset({
  name: activity.name,
  description: activity.description ?? '',
  location: activity.location ?? '',
  startTime: formatTime(activity.startTime),  // "HH:mm:ss" → "HH:mm"
  endTime: formatTime(activity.endTime),
});
```

`formatTime(null)` već vraća `''` — pokriva null case.

**Submit request shape** (Opcija A clear semantika):

```ts
const v = this.form.getRawValue();
const request: UpdateTripActivityRequest = {
  name: v.name.trim(),
  description: v.description.trim(),  // empty → backend postavlja DB na ""
  location: v.location.trim(),         // empty → backend postavlja DB na ""
};
const start = toBackendTime(v.startTime);
if (start) request.startTime = start;
const end = toBackendTime(v.endTime);
if (end) request.endTime = end;
```

Vremena su conditionally added — prazno polje ne znači "clear", znači "ne mijenjaj".

**Inline delete confirmation:**

```ts
readonly confirmingDelete = signal(false);

requestDelete(): void { this.confirmingDelete.set(true); }
cancelDelete(): void { this.confirmingDelete.set(false); }

confirmDelete(): void {
  const tripId = this._tripId();
  const dayId = this._dayId();
  const activityId = this._activityId();
  if (tripId === null || dayId === null || activityId === null) return;

  this.loading.set(true);
  this.tripService.deleteActivityFromDay(tripId, dayId, activityId).subscribe({
    next: () => {
      this.loading.set(false);
      this.close();
      this.toastService.show({
        message: 'TRIPS.DETAIL.ACTIVITIES.DELETE.SUCCESS',
        type: 'success',
      });
    },
    error: () => {
      this.loading.set(false);
      this.toastService.show({
        message: 'TRIPS.DETAIL.ACTIVITIES.DELETE.ERROR_GENERIC',
        type: 'error',
      });
    },
  });
}
```

`close()` mora resetirati `confirmingDelete` zajedno s ostalim cleanup-om.

**Footer template:**

```html
<div class="px-6 py-4 border-t border-outline-variant/10 bg-surface-container-low shrink-0 flex items-center gap-3">
  @if (confirmingDelete()) {
    <p class="flex-1 text-sm font-label text-error">
      {{ 'TRIPS.DETAIL.ACTIVITIES.DELETE.MESSAGE' | translate }}
    </p>
    <button type="button" (click)="cancelDelete()" [disabled]="loading()" class="...">
      {{ 'TRIPS.DETAIL.ACTIVITIES.DELETE.CANCEL' | translate }}
    </button>
    <button type="button" (click)="confirmDelete()" [disabled]="loading()" class="bg-error text-on-error ...">
      {{ 'TRIPS.DETAIL.ACTIVITIES.DELETE.CONFIRM' | translate }}
    </button>
  } @else {
    <button type="button" (click)="requestDelete()" [disabled]="loading()" class="text-error hover:bg-error-container ...">
      {{ 'TRIPS.DETAIL.ACTIVITIES.DELETE.CTA' | translate }}
    </button>
    <div class="flex-1"></div>
    <button type="button" (click)="close()" [disabled]="loading()" class="...">
      {{ 'TRIPS.DETAIL.ACTIVITIES.EDIT.CANCEL' | translate }}
    </button>
    <button type="submit" form="editActivityForm" [disabled]="loading()" class="bg-primary text-on-primary ...">
      {{ 'TRIPS.DETAIL.ACTIVITIES.EDIT.SUBMIT' | translate }}
    </button>
  }
</div>
```

### 4. i18n

Dodati nakon `TRIPS.DETAIL.ACTIVITIES.ADD` blok u oba file-a.

**en.json:**
```json
"EDIT": {
  "TITLE": "Edit activity",
  "SUBTITLE": "Update the activity details.",
  "CANCEL": "Cancel",
  "SUBMIT": "Save changes",
  "SUCCESS": "Activity updated.",
  "ERROR_GENERIC": "Couldn't update the activity. Please try again."
},
"DELETE": {
  "CTA": "Delete activity",
  "MESSAGE": "Delete this activity? This can't be undone.",
  "CONFIRM": "Yes, delete",
  "CANCEL": "Cancel",
  "SUCCESS": "Activity deleted.",
  "ERROR_GENERIC": "Couldn't delete the activity. Please try again."
}
```

**hr.json:**
```json
"EDIT": {
  "TITLE": "Uredi aktivnost",
  "SUBTITLE": "Uredi detalje aktivnosti.",
  "CANCEL": "Odustani",
  "SUBMIT": "Spremi promjene",
  "SUCCESS": "Aktivnost ažurirana.",
  "ERROR_GENERIC": "Ažuriranje aktivnosti nije uspjelo. Pokušaj ponovno."
},
"DELETE": {
  "CTA": "Obriši aktivnost",
  "MESSAGE": "Obrisati ovu aktivnost? Ovo se ne može poništiti.",
  "CONFIRM": "Da, obriši",
  "CANCEL": "Odustani",
  "SUCCESS": "Aktivnost obrisana.",
  "ERROR_GENERIC": "Brisanje aktivnosti nije uspjelo. Pokušaj ponovno."
}
```

`EDIT.ERROR_VALIDATION` se ne dodaje — reusa se postojeći `ADD.ERROR_VALIDATION` u `applyError` mapping-u.

### 5. Wire-up u `trip-detail-page`

`trip-detail-page.component.ts`:
- Import `EditActivityDialogComponent` i `TripActivityResponse`
- Dodati u `imports` array
- Novi `@ViewChild`:
  ```ts
  @ViewChild(EditActivityDialogComponent) editActivityDialog?: EditActivityDialogComponent;
  ```
- Nova metoda:
  ```ts
  openEditActivity(day: TripDayResponse, activity: TripActivityResponse): void {
    const trip = this.trip();
    if (!trip) return;
    this.editActivityDialog?.open(trip.id, day.id, activity);
  }
  ```

`trip-detail-page.component.html`:
- Dodati `<app-edit-activity-dialog />` ispod `<app-add-activity-dialog />`
- Bind output i input na `app-trip-day-card`:
  ```html
  <app-trip-day-card
    [day]="d"
    [canDelete]="true"
    [canAddActivity]="true"
    [canEditActivity]="true"
    (deleteDay)="openDeleteDay(d)"
    (addActivity)="openAddActivity(d)"
    (editActivity)="openEditActivity(d, $event)" />
  ```

### 6. Activity row clickable

`trip-day-card.component.ts`:
```ts
readonly canEditActivity = input(false);
readonly editActivity = output<TripActivityResponse>();
```

`trip-day-card.component.html` — `<li>` za activity:
```html
<li
  [class.cursor-pointer]="canEditActivity()"
  [attr.role]="canEditActivity() ? 'button' : null"
  [attr.tabindex]="canEditActivity() ? 0 : null"
  [attr.aria-label]="canEditActivity() ? (('TRIPS.DETAIL.ACTIVITIES.EDIT.TITLE' | translate) + ': ' + activity.name) : null"
  (click)="canEditActivity() && editActivity.emit(activity)"
  (keydown.enter)="canEditActivity() && editActivity.emit(activity)"
  (keydown.space)="canEditActivity() && editActivity.emit(activity); canEditActivity() && $event.preventDefault()"
  class="flex items-start gap-4 sm:gap-5 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
  [class.hover:bg-surface-container-low]="canEditActivity()"
  [class.focus-visible:ring-2]="canEditActivity()"
  [class.focus-visible:ring-primary]="canEditActivity()"
  [class.focus-visible:outline-none]="canEditActivity()">
```

Kad `canEditActivity()` je `false`, row se ponaša kao prije (bez interakcije, bez fokusa).

## Reused funkcije i komponente

| Što | Gdje |
|---|---|
| `formatTime(value)` | `src/app/shared/utils/format-time.ts` — pre-fill `"HH:mm:ss"` → `"HH:mm"` |
| `toBackendTime(value)` | `src/app/shared/utils/format-time.ts` — submit `"HH:mm"` → `"HH:mm:ss"` |
| `compareByStartTime` | `src/app/core/services/trip.service.ts:155` — resort nakon update-a |
| `FormFieldComponent` | `src/app/shared/components/form-field/form-field.component.ts` |
| `ToastService.show` | `src/app/shared/services/toast.service.ts` |
| `applyError` mapping pattern | postoji u `add-activity-dialog.component.ts` — kopirati u edit |

## Verifikacija (end-to-end)

Pokreni `ng serve` u `planner-frontend` i prođi:

**Edit happy paths:**
1. Klik bilo gdje na activity row → edit dialog s pre-filled vrijednostima
2. Promjena `startTime` → save → dialog zatvori, toast, aktivnost se rerorder-a u listi
3. Promjena samo `description` → save → nova vrijednost u prikazu
4. Save bez izmjena → idempotent, aktivnost ista

**Edit clear semantika:**
5. Aktivnost s description "X" → očisti polje → save → description nestaje (DB `""`)
6. Aktivnost s endTime 14:00 → očisti polje → save → endTime ostaje 14:00 (limitacija)

**Delete inline confirmation:**
7. Klik "Delete activity" → footer swap u confirm message + Cancel/Yes-delete
8. Klik Cancel u confirm → vrati se na normalni footer
9. Klik "Yes, delete" → DELETE, dialog zatvori, aktivnost nestaje, toast
10. Tijekom delete loading-a, gumbi disabled

**Validation & errors:**
11. Očisti `name` → save → required error inline
12. `name` 256+ znakova → maxlength error
13. Server 400 sa fieldErrors → mapped na server error per polje
14. Server 500 → generic error banner

**A11y:**
15. Tab kroz aktivnosti → fokus ring vidljiv, Enter otvara dialog
16. Space na aktivnosti → otvara dialog (bez scroll-a)
17. Screen reader najavljuje aria-label

**Cross-midnight (regresija):**
18. Aktivnost 21:00 → 01:00 — open edit, save bez promjene → backend prihvaća

**Promjena dana:**
19. Promijeni dan kroz day picker → klik aktivnost → edit dialog s pravim `dayId`

## Limitacije i follow-ups

| Limitacija | Obrazloženje | Mogući follow-up |
|---|---|---|
| Vremena se ne mogu clear-ati kroz edit | `LocalTime.parse("")` → 400. Mapper preskače `null`. | Backend mapper podrška za eksplicitno `clearStartTime: boolean` flag, ili promjena DTO u `Optional<LocalTime>`. |
| Nema permission gating-a | Hardkodirano `canEditActivity = true` | Centralni role-based gate kad doda role check svih mutacija (kao planirano za delete day, add day). |
| Nema "form dirty" detekcije | Save je uvijek enabled, čak i ako se ništa nije promijenilo | Dodati `form.dirty` provjeru ili custom dirty signal koji uspoređuje s initial values. Nice-to-have. |
