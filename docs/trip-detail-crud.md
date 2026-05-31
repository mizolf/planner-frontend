# Trip Detail — Full CRUD (write features)

## Overview

Trip detail stranica je nakon Phase 1 (read-only) + invite flowa i dalje velikim dijelom read-only. Backend već podržava niz operacija koje frontend ne koristi. Ovaj spec dovršava write funkcionalnost:

1. **Uredi / obriši trip** — `PUT` / `DELETE /trips/{id}` [odrađeno]
2. **Uredi dan + notes** — `PUT /trips/{id}/days/{dayId}` (notes se trenutno prikazuju ali se nikako ne mogu unijeti) [odrađeno]
3. **Upravljanje članovima** — promjena role + izbacivanje (`PUT` / `DELETE /trips/{id}/members/{userId}`)
4. **Povijest tripa (aside feed)** — `GET /trips/{id}/activity-feed`
5. **Leave trip** — član sam napušta trip; **traži novi backend endpoint** [odrađeno]

Ishod: OWNER/EDITOR uređuju trip i dane, OWNER upravlja timom, svi članovi vide povijest izmjena, a ne-vlasnici mogu napustiti trip.

## Odnos prema postojećim docsima

Ovaj dokument je **finalni izvedbeni ugovor** i na sljedećim mjestima **nadmješta** `trip-detail.md`:

| `trip-detail.md` | Status ovdje |
|---|---|
| §2.1 "inline click-to-edit" + Resolved Decision #2 | **Nadmješteno** → trip se uređuje kroz **dialog** (konzistentno s `add-day` / `invite-member`), ne inline |
| §2.4 "Leave trip = `DELETE .../members/{userId}` s vlastitim id-om" | **Ispravljeno** → backend blokira self-removal; uvodi se novi `DELETE /trips/{id}/members/me` |
| §2.4 "Invite member = `POST /trips/{id}/members`" | Već zastarjelo — članstvo ide kroz invite flow (`invite-flow.md`) |
| Resolved Decision #3 "warn-and-prune on shrink" | **Implementira se** (backend orphan pruning + upozorenje u dialogu) |

Reorder dana, move activity i activity kategorije ostaju **izvan opsega** (backend ih još nema).

## Repozitoriji

- **Frontend**: `planner-frontend` (grana `trip-details`)
- **Backend**: `planner-backend` — dvije izmjene (orphan pruning + leave endpoint), na svojoj grani.

## Zaključene odluke (iz konzultacije)

| Odluka | Vrijednost |
|---|---|
| Uredi trip | **Dialog** s formom (svi field-ovi odjednom), ne inline. Header dobiva `✎ Uredi` + `⋮ → Obriši trip`. |
| Izmjena datuma | Dopuštena. Backend u `updateTrip` **briše dane izvan novog raspona** (orphan pruning). Dialog **upozori prije spremanja** ako će neki dan biti obrisan. |
| Povijest tripa | **Aside kolona** na trip-detail stranici, mirror `home-page` layouta (`<aside class="xl:w-80 shrink-0">` + sticky kartica). |
| Leave trip | Novi `DELETE /trips/{id}/members/me`; blokira OWNER-a (owner umjesto toga briše trip). Gumb "Napusti trip" vidljiv samo ne-vlasnicima. |
| `dayNumber` | Ostaje auto-managed, izvan UI-a (izbjegavamo razbijanje redoslijeda). |

## Konvencije koje slijedimo

- Sve mutacije = standalone **dialog** (`isOpen` signal, reactive form, footer Odustani/Spremi, escape handler, fokus management). Referenca: `add-day-dialog`, `edit-activity-dialog`, `cancel-invite-dialog`.
- Destruktivne akcije = `role="alertdialog"` confirm dialog (`delete-day-dialog`, `cancel-invite-dialog`).
- `TripService` radi **optimistični update** `_tripDetail` signala kroz `tap()`; dialog samo zove servis, prikaže toast, zatvori se.
- Moderne Angular API: `input()`, `output()`, `inject()`, signali. Fetch-on-input ide u `ngOnInit`, **ne** u `effect()` (NG0600).
- Greške s backenda: mapiraj `status` + `code`/`fieldErrors` na poruke/kontrole (vidi `invite.service.ts` `mapToErrorKind`).
- i18n: ngx-translate, ključevi u `public/assets/i18n/en.json` i `hr.json`.

---

## Backend izmjene (prvo — frontend ovisi o njima)

### B1. Orphan-day pruning u `updateTrip`

`planner-backend/.../service/TripService.java` (`updateTrip`, ~129–155): nakon validacije `end ≥ start` i primjene novih datuma, ukloni dane izvan raspona. `Trip` ima `@OneToMany(cascade=ALL, orphanRemoval=true)` za dane, pa je dovoljno:

```java
trip.getDays().removeIf(d -> d.getDate().isBefore(newStart) || d.getDate().isAfter(newEnd));
```

`orphanRemoval` ih obriše. Po želji publishaj `DAY_DELETED` event po obrisanom danu (radi točnosti feeda) — mirror postojećeg publishanja u `TripDayService`.

### B2. Leave-trip endpoint

- `controller/TripMemberController.java`: novi `@DeleteMapping("/me")` → `leaveTrip(tripId, currentUser)`, vraća `204`. Mapping `/me` deklarirati eksplicitno uz postojeći `@DeleteMapping("/{userId}")` (literal "me" se ne parsira kao `Long userId`; Spring preferira exact match, ali budimo eksplicitni).
- `service/TripMemberService.java`: nova `leaveTrip(Long tripId, User currentUser)`:
  - `UserTrip ut = authorizationService.validateMembership(tripId, currentUser)` (bilo koja rola).
  - ako je `ut.getRole() == OWNER` → baci `ForbiddenException("Owner cannot leave trip — transfer ownership or delete it instead")`.
  - publishaj `MEMBER_REMOVED` event (mirror `removeMember`, ~88–110).
  - `userTripRepository.delete(ut)`.

---

## Frontend

### A. Uredi / obriši trip

**Modeli** — `core/models/trip.model.ts`: `UpdateTripRequest` (sva polja opcionalna: `name`, `description`, `destination`, `startDate`, `endDate`, `status`, `budget`, `interests`).

**TripService** — `core/services/trip.service.ts`:

- `updateTrip(tripId, req: UpdateTripRequest): Observable<TripResponse>` — `PUT /trips/{id}`; `tap()` spaja odgovor u `_tripDetail` (zadrži `days`/`members`) i ažurira unos u `_trips`.
- `deleteTrip(tripId): Observable<void>` — `DELETE /trips/{id}`; `tap()` makne iz `_trips` i `clearTripDetail()`.

**`edit-trip-dialog.component.ts`** (nova, `features/trips/trip-detail/`) — mirror `add-day-dialog` + `edit-activity-dialog`:

- `open(trip: TripDetailResponse)` puni reactive form:

| Polje | Validacija |
|---|---|
| `name` | required, max 255 |
| `destination` | required, max 255 |
| `description` | max 255 |
| `startDate`, `endDate` | end ≥ start (cross-field validator) |
| `budget` | optional, ≥ 0 |
| `status` | jedan od `PLANNING / UPCOMING / IN_PROGRESS / COMPLETED` |
| `interests` | multi-chip `Interest` enuma |

- **Orphan-day upozorenje**: computed nad `_tripDetail.days` koji broji dane s `date` izvan novog `[startDate, endDate]`; ako > 0, inline upozorenje ("X dana bit će obrisano…") prije `Spremi`.
- `onSubmit` → `tripService.updateTrip()`, toast, `close()`. Mapiranje `fieldErrors` → kontrole.

**`delete-trip-dialog.component.ts`** (nova) — `role="alertdialog"`, mirror `delete-day-dialog`: `open(trip)`; `confirm()` → `tripService.deleteTrip()` → inject `Router`, navigiraj `/home`, toast.

**Header** — `trip-detail-header.component.ts` / `.html`: dodaj `canEdit = input(false)`, `canDelete = input(false)`, outpute `edit`/`delete`. Render `✎ Uredi` (gated `canEdit`) i overflow `⋮ → Obriši trip` (gated `canDelete`) — overflow kao signal-toggled mali meni s click-outside zatvaranjem.

**Page** — `trip-detail-page.component.*`: `@ViewChild` `editTripDialog`/`deleteTripDialog`; `openEditTrip()`/`openDeleteTrip()`; `[canEdit]="canEditContent()"` `[canDelete]="isOwner()"`; instanciraj dijaloge.

### B. Uredi dan + notes

**Modeli** — `UpdateTripDayRequest` (`dayNumber?`, `date?`, `title?`, `notes?`). `CreateTripDayRequest` već ima `notes`.

**add-day-dialog** — dodaj `notes` kontrolu (textarea, max 255) u formu i template (sad samo `title` + `date`).

**TripService** — `updateDay(tripId, dayId, req): Observable<TripDayResponse>` — `PUT /trips/{id}/days/{dayId}`; `tap()` zamijeni dan u `_tripDetail.days`, sort po `dayNumber` (mirror `updateActivityInDay`).

**`edit-day-dialog.component.ts`** (nova) — mirror `add-day-dialog`: `open(tripId, day, tripStartDate, tripEndDate, existingDays)` puni `title`, `date`, `notes`; reuse `dateInRange` validator; `onSubmit` → `tripService.updateDay()`. `dayNumber` izvan UI-a.

**trip-day-card** — `trip-day-card.component.ts` (već ima `canDelete`/`deleteDay`, `canAddActivity`/`addActivity`, `canEditActivity`/`editActivity`): dodaj `canEditDay = input(false)` + `editDay = output<void>()`, gumb `✎` u zaglavlju kartice.

**Page** — `@ViewChild editDayDialog`; `openEditDay(day)`; proslijedi `[canEditDay]="canEditContent()"`, veži `(editDay)`.

### C. Upravljanje članovima + Leave trip

**Modeli** — `UpdateMemberRoleRequest { role: MemberRole }`. Promjena role samo `EDITOR ↔ VIEWER` (backend blokira `OWNER`, mijenjanje sebe i ownerove role).

**TripService** (članovi žive u `_tripDetail.members`):

- `updateMemberRole(tripId, userId, role): Observable<TripMemberResponse>` — `PUT /trips/{id}/members/{userId}` body `{role}`; `tap()` ažurira člana u `_tripDetail.members`.
- `removeMember(tripId, userId): Observable<void>` — `DELETE /trips/{id}/members/{userId}`; `tap()` filtrira iz `_tripDetail.members`.
- `leaveTrip(tripId): Observable<void>` — `DELETE /trips/{id}/members/me`; `tap()` → navigiraj `/home`, makni iz `_trips`, `clearTripDetail()`.

**trip-members-section** — `trip-members-section.component.ts`:

- Dodaj `currentUserId = input<number | null>(null)` (za prepoznavanje "sebe"); inject `TripService`.
- Po članu, kad `isOwner()` && nije self && `role !== 'OWNER'`: role `<select>` (EDITOR/VIEWER, bind na `member.role` da se vrati na staro pri grešci) → `(change)` zove `updateMemberRole` (optimistično, error toast); te `✕` gumb koji otvara remove confirm.
- Za ne-vlasnika člana: gumb **"Napusti trip"** → otvara leave confirm.
- Nove confirm komponente (mirror `cancel-invite-dialog`): `remove-member-dialog.component.ts` i `leave-trip-dialog.component.ts` (ili jedan generički confirm s `input` porukom). `@ViewChild` u sekciji.

**Page** — proslijedi `[currentUserId]="userService.currentUser()?.id ?? null"`.

### D. Povijest tripa (aside feed)

**Modeli** — `core/models/activity.model.ts`:

- `TripActivityItem` = `DashboardActivityItem` bez `tripId`/`tripName` (`id`, `eventType`, `entityType`, `entityId`, `entityName`, `actorName`, `actorId`, `changes`, `createdAt`).
- Proširi `ActivityEventType` s `INVITE_SENT|ACCEPTED|DECLINED|CANCELLED|EXPIRED` i `EntityType` s `INVITE` (trip feed sadrži invite evente kojih dashboard nema).

**ActivityFeedService** — `core/services/activity-feed.service.ts`: dodaj **zasebne** signale `_tripActivities`/`_tripLoading`/`_tripError` (+ readonly) i `loadTripFeed(tripId, size = 30): void` → `GET /trips/{id}/activity-feed?page=0&size={size}`. Dashboard metoda ostaje netaknuta.

**Shared** — izvuci `EVENT_TRANSLATION_KEYS`, `AVATAR_COLORS`, `getAvatarColor` iz `features/activity-feed/activity-feed.component.ts` u `shared/` const/util pa ih koriste obje komponente (DRY). Reuse `RelativeTimePipe` (`shared/pipes/relative-time.pipe.ts`) bez izmjena.

**`trip-activity-feed.component.ts`** (nova) — `tripId = input.required<number>()`; `ngOnInit` → `feedService.loadTripFeed(tripId())`. Mirror dashboard template: header, loading skeleton, error+retry, empty, lista s `relativeTime` + avatar bojama + event prijevodima. Dodaj invite-event prijevode.

**Layout** — `trip-detail-page.component.html`: omotaj loaded sadržaj u flex red `<main>` + `<aside class="xl:w-80 shrink-0">` sa sticky karticom (mirror `home-page.component.html` ~155–161) koja drži `<app-trip-activity-feed [tripId]="t.id" />`.

### Cross-cutting

- **i18n** (`en.json` + `hr.json`): ključevi za nove dijaloge/sekcije — `TRIP_DETAIL.EDIT.*`, `TRIP_DETAIL.DELETE.*`, `MEMBERS.ROLE.*`, `MEMBERS.REMOVE.*`, `MEMBERS.LEAVE.*`, `ACTIVITY_FEED.EVENTS.INVITE_*`.
- **Router**: inject `Router` za navigaciju na `/home` nakon delete/leave.
- **Greške članova**: mali `mapToErrorKind` za member operacije (403 → no-permission, 404 → not-found, ostalo → generic) ili generički toast.

---

## Redoslijed izvođenja

1. **Backend** B1 + B2 (orphan pruning, leave endpoint).
2. **A** Uredi/obriši trip (modeli → service → dialozi → header → page).
3. **B** Uredi dan + notes (model → add-day notes → service → edit-day-dialog → card → page).
4. **C** Upravljanje članovima + Leave (modeli → service → section + confirm dialozi → page).
5. **D** Povijest tripa aside (modeli/enumi → shared extract → service → komponenta → layout).
6. i18n ključevi usput za svaku značajku.

## Verifikacija (manualni smoke)

Backend: `./mvnw spring-boot:run` u `planner-backend`. Frontend: `npm start` u `planner-frontend`.

- **Uredi trip**: kao OWNER/EDITOR otvori dialog, promijeni ime/budžet/status/interese → spremi → header se ažurira bez reloada. VIEWER ne vidi `✎ Uredi`.
- **Datumi + orphan**: skrati raspon tako da postojeći dan ispadne → dialog upozori → spremi → dan nestane iz itinerara.
- **Obriši trip**: samo OWNER vidi `⋮ → Obriši trip` → confirm → redirect na `/home`, trip nestao s liste.
- **Uredi dan**: `✎` na kartici → promijeni title/date/notes → spremi → ažurirano. Provjeri da se **notes sad mogu unijeti i kroz add-day i kroz edit-day**.
- **Članovi**: kao OWNER promijeni rolu (EDITOR↔VIEWER) preko dropdowna → odmah vidljivo; izbaci člana → confirm → nestane. OWNER ne može mijenjati/brisati sebe ni druge ownere.
- **Leave**: kao EDITOR/VIEWER "Napusti trip" → confirm → redirect na `/home`, trip nestao. Kao OWNER gumb se ne prikazuje; direktan `/me` zahtjev vraća 403.
- **Povijest (aside)**: izvedi nekoliko izmjena (dodaj dan, uredi, promijeni rolu, pošalji invite) → aside feed prikazuje evente s relativnim vremenom i imenom aktera; invite eventi imaju prijevode.
- **i18n**: prebaci EN↔HR i provjeri da nema sirovih ključeva.
