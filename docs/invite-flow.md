# Invite Flow + Notifications

## Overview

Owner može pozvati registriranog korisnika na trip preko emaila s rolom EDITOR ili VIEWER. Pozvani korisnici vide bell badge u navbaru i upravljaju pozivima na novoj `/invites` stranici (accept/decline). Phase 1 je **in-app only** — bez email obavijesti, bez real-time push-a.

Backend je već implementirao 6 endpoint-a pod JWT auth-om. Cijeli ugovor je dokumentiran u backend repo-u: `planner-backend/docs/invite-flow-frontend.md`. Stari `POST /trips/{id}/members` više ne postoji — članstvo se sada dodaje isključivo preko invite + accept toka.

| Operacija | HTTP | Endpoint |
|---|---|---|
| Create / resend invite (OWNER only) | POST | `/trips/{tripId}/invites` |
| List trip invites (OWNER only) | GET | `/trips/{tripId}/invites?status=PENDING` |
| Cancel invite (OWNER only) | DELETE | `/trips/{tripId}/invites/{inviteId}` |
| List my pending invites | GET | `/me/invites` |
| Accept invite | POST | `/me/invites/{inviteId}/accept` |
| Decline invite | POST | `/me/invites/{inviteId}/decline` |

## UX odluke

| Odluka | Vrijednost |
|---|---|
| Smještaj owner UI-ja | Sve unutar trip detail stranice — invite button u members section-u + nova "Pending invites" sekcija ispod (samo OWNER, samo ako ima ≥1 pending) |
| Notification UX | MVP — bell u navbaru s badge count; klik vodi direktno na `/invites` (bez dropdown-a) |
| Post-accept ponašanje | Stay on `/invites`, prikaži toast s action linkom "View trip" → `/trips/{tripId}` (user može accept-ati više poziva u nizu) |
| Refresh strategija | On-demand only — `loadMyInvites()` jednom u `DashboardLayoutComponent.ngOnInit`; nakon accept/decline lokalna mutacija preko `tap()` (bez dodatnih HTTP poziva) |
| 409 Concurrent modification | Silent auto-retry jednom kod `accept` (decline nema retry); ako i drugi pokušaj faila → toast |
| Identifier | Email (case-insensitive na backendu); frontend trim-a whitespace prije slanja |
| Default role u modalu | EDITOR |
| Role gating | `isOwner = computed(...)` u `TripDetailPageComponent`; non-owner ne vidi invite UI |
| Owner pending list nakon invitee accept-a | Phase 1: stale (osvježava se na trip detail reload); Phase 2 može SSE |
| Status filter | Phase 1 prikazuje samo PENDING; ostali statusi (DECLINED, EXPIRED, CANCELLED) nisu prikazani u UI-ju |

## Backend kontract

### Tipovi (kopirat-spremno)

```ts
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
export type TripRole = MemberRole; // reuse 'OWNER' | 'EDITOR' | 'VIEWER' iz trip.model.ts

export interface CreateInviteRequest {
  email: string;
  role: 'EDITOR' | 'VIEWER';
}

export interface TripInviteResponse {
  id: number;
  email: string;
  role: TripRole;
  status: InviteStatus;
  inviterName: string;
  createdAt: string;
  expiresAt: string;
}

export interface MyInviteResponse {
  id: number;
  tripId: number;
  tripName: string;
  tripDestination: string | null;
  inviterName: string;   // "Deleted user" je validna vrijednost
  role: TripRole;
  expiresAt: string;
}

export type InviteErrorCode =
  | 'CONCURRENT_MODIFICATION'
  | 'SELF_INVITE'
  | 'ALREADY_MEMBER'
  | 'INVITE_NOT_PENDING'
  | 'INVITE_EXPIRED';

// Reuse postojeći shared error shape (ako ne postoji u app-u, dodati u core models).
// `code` polje popunjeno je samo na 409 invite endpoint-ima; ostali statusi ga mogu izostaviti.
export interface ErrorResponse {
  status: number;
  code?: InviteErrorCode | string;
  message: string;
  fieldErrors?: Record<string, string>;  // samo na 400
  timestamp?: string;
}
```

### Ponašanja koja frontend mora razumjeti

- **Resend = isti POST endpoint** — backend prepoznaje postojeći PENDING invite za (trip, email) i update-a ga (nije potreban poseban "resend" endpoint).
- **Lazy expiry** — `GET /me/invites` automatski filtrira expired PENDING; frontend ne treba računati `expiresAt < now` u UI-ju (osim za prikaz "expires in X days").
- **204 No Content** — accept, decline, cancel vraćaju 204 bez body-ja; ne pokušavati parse JSON.
- **Email case-insensitive** — backend normalizira; frontend samo trim-a.
- **`tripDestination`** može biti `null` (fallback "Destination not specified").
- **`inviterName`** može biti string "Deleted user" — renderirati doslovno.
- **409 ima stabilan `code`** — sve 409 odgovore prati `err.error.code: InviteErrorCode`. Match **samo na `code`**, nikad na `message` — poruke su informativne (mogu se mijenjati zbog lokalizacije ili refactor-a), `code` je ugovor. 400/403/404 u Phase 1 nemaju structured `code` field, pa za njih i dalje fallback na status + message text.

### Error matrica

| Status | Razlog | UI handling |
|---|---|---|
| 400 + fieldErrors | Validation (invalid email) | Field-level error u modal-u |
| 403 | OWNER check failed (create/list/cancel) | Toast `INVITES.ERRORS.NO_PERMISSION` (ne bi se desilo s UI gating-om) |
| 403 | "Invite is not for you" | Toast + `loadMyInvites()` refresh |
| 403 | "Verify your email before accepting" | Toast s linkom na verify flow (ako ruta postoji) |
| 404 | User not registered | Field-level `INVITES.ERRORS.NOT_FOUND_USER` |
| 404 | Invite ne postoji | Toast + refresh liste |
| 409 | `code: SELF_INVITE` — owner pokušao pozvati sebe | Field-level `INVITES.ERRORS.SELF_INVITE` |
| 409 | `code: ALREADY_MEMBER` — user je već član trip-a | Field-level `INVITES.ERRORS.ALREADY_MEMBER` |
| 409 | `code: INVITE_NOT_PENDING` — invite u terminal stanju (ACCEPTED/DECLINED/CANCELLED/EXPIRED) | Toast `INVITES.ERRORS.NOT_PENDING` + refresh liste |
| 409 | `code: INVITE_EXPIRED` — invite je istekao između prikaza i klika | Toast `INVITES.ERRORS.EXPIRED` + refresh liste |
| 409 | `code: CONCURRENT_MODIFICATION` — optimistic lock konflikt | Silent auto-retry jednom (samo na `accept`); ako opet faila, toast `INVITES.ERRORS.RETRY` |

## Plan implementacije

Šest faza, svaka završava commit-om s manualnim smoke testom prije sljedeće. Slijedi obrazac postojećih commit-ova na `trip-details` branch-u.

### 1. Modeli + InviteService

**Files:**
- `src/app/core/models/invite.model.ts` (new) — sve tipove iznad. `TripRole` je alias na postojeći `MemberRole` iz `trip.model.ts`.
- `src/app/core/services/invite.service.ts` (new) — slijedi `TripService` pattern.

**Shape `InviteService`:**

```ts
@Injectable({ providedIn: 'root' })
export class InviteService {
  private http = inject(HttpClient);
  private baseTripsUrl = `${environment.apiUrl}/trips`;
  private baseMyUrl = `${environment.apiUrl}/me/invites`;

  private _myPendingInvites = signal<MyInviteResponse[]>([]);
  private _loading = signal(false);
  private _error = signal<string | null>(null);

  readonly myPendingInvites = this._myPendingInvites.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly pendingCount = computed(() => this._myPendingInvites().length);

  loadMyInvites(): void { /* fire-and-forget, populira signal */ }

  acceptInvite(inviteId: number): Observable<void> {
    // POST → tap(() => removeFromLocal(inviteId))
    // retry jednom ako je 409 "Concurrent modification"
  }

  declineInvite(inviteId: number): Observable<void> {
    // POST → tap(() => removeFromLocal(inviteId)) — bez retry-a
  }

  createInvite(tripId: number, req: CreateInviteRequest): Observable<TripInviteResponse> {
    // POST — owner action, ne dira myPendingInvites signal
  }

  listTripInvites(tripId: number, status: InviteStatus = 'PENDING'): Observable<TripInviteResponse[]> {
    // GET — owner action
  }

  cancelInvite(tripId: number, inviteId: number): Observable<void> {
    // DELETE — owner action
  }

  // Helper sličan TripService.mapToErrorKind — vraća i18n string ključeve.
  // Za 409, switch-a na err.error.code (InviteErrorCode); za 400/403/404 fallback na status + message.
  private mapToErrorKind(err: HttpErrorResponse): string { /* ... */ }
}
```

**Retry logika za 409 Concurrent modification (accept):** koristi RxJS `retry({ count: 1, delay: (err) => err instanceof HttpErrorResponse && err.status === 409 && err.error?.code === 'CONCURRENT_MODIFICATION' ? of(0) : throwError(() => err) })`. Match na stabilan `code` field, ne na `message` tekst — to je backend ugovor.

**Smoke test:** privremeni `console.log` u `DashboardLayoutComponent.ngOnInit` koji poziva `loadMyInvites()` → provjera u network tab-u + signal vrijednost.

### 2. Owner: Invite Member dialog

**Files:**
- `src/app/features/trips/trip-detail/invite-member-dialog.component.{ts,html}` (new) — slijedi `AddActivityDialogComponent` pattern (signal-based open, Escape close, body scroll lock, FormFieldComponent, error mapping). Exposira `@Output() invited = new EventEmitter<TripInviteResponse>()` koji se emit-a nakon uspješnog `createInvite` poziva — parent (`TripDetailPageComponent`) ga sluša da bi update-ao pending invites sekciju (vidi Faza 3).
- `src/app/features/trips/trip-detail/trip-detail-page.component.ts` (modify) — dodati `currentUser` inject, `currentUserRole = computed(...)`, `isOwner = computed(...)`, `@ViewChild(InviteMemberDialogComponent)`, `openInviteMember()`.
- `src/app/features/trips/trip-detail/trip-members-section.component.{ts,html}` (modify) — primati `isOwner` input, render "Invite member" button ako owner, emit `(invite)` event.
- `public/assets/i18n/{en,hr}.json` (modify) — `INVITES.DIALOG.*`, `INVITES.ROLES.*`, `INVITES.ERRORS.*`, `INVITES.SUCCESS.SENT`.

**Forma:**
- `email`: required, `Validators.email`, `Validators.maxLength(255)`, trim na submit
- `role`: select EDITOR / VIEWER, default EDITOR

**Submit:**
```ts
const req: CreateInviteRequest = {
  email: this.form.controls.email.value.trim(),
  role: this.form.controls.role.value,
};
this.inviteService.createInvite(this.tripId, req).subscribe({
  next: (created) => {
    this.toast.show({ message: 'INVITES.SUCCESS.SENT', type: 'success' });
    this.invited.emit(created);
    this.close();
  },
  error: (err) => this.handleError(err),
});
```

**Smoke test:** uspješan poziv → toast + dialog se zatvori; nepostojeći email → field error; self-invite → field error; already member → field error.

### 3. Owner: Pending Invites sekcija

**Files:**
- `src/app/features/trips/trip-detail/pending-invites-section.component.{ts,html}` (new) — inputs `tripId: number`, `isOwner: boolean`. Lokalni signali (`_invites`, `_loading`, `_error`). U `ngOnInit` (ili `effect()` ako se input lazy-set-a) pozvati `inviteService.listTripInvites(tripId, 'PENDING')`. Renderira email, role badge, "expires in X days", cancel button. Exposira public metodu `addInvite(invite: TripInviteResponse)` koju parent zove nakon uspješnog invite-a (vidi "Post-invite koordinacija" niže).
- `src/app/features/trips/trip-detail/cancel-invite-dialog.component.{ts,html}` (new) — confirm dialog, po uzoru na `DeleteDayDialogComponent`.
- `src/app/features/trips/trip-detail/trip-detail-page.component.{ts,html}` (modify) — render `<app-pending-invites-section>` ispod `<app-trip-members-section>`, conditional na `isOwner()`. Dodati `@ViewChild(PendingInvitesSectionComponent)` i handler `onInvited(created)` koji poziva `pendingInvitesSection?.addInvite(created)`. Hook `(invited)="onInvited($event)"` na `<app-invite-member-dialog>`.
- `public/assets/i18n/{en,hr}.json` (modify) — `INVITES.PENDING.*`, `INVITES.SUCCESS.CANCELLED`.

**Cancel flow:** klik na cancel → confirm dialog → `cancelInvite(tripId, inviteId)` → lokalna mutacija (`_invites.update(arr => arr.filter(i => i.id !== inviteId))`) + toast.

**Post-invite koordinacija:** kad owner uspješno pošalje invite, `InviteMemberDialogComponent` emit-a `(invited)` event s `TripInviteResponse`. Parent (`TripDetailPageComponent`) handle-a event i poziva `pendingInvitesSection?.addInvite(created)`. `addInvite` provjeri postoji li invite s istim `id` u lokalnom signal-u — ako da (resend slučaj — backend update-a postojeći PENDING umjesto kreiranja novog), zamijeni; inače prepend-a na vrh liste. Opcionalni chain je defenzivan: sekcija je conditional na `isOwner()` pa ViewChild može biti `undefined` u edge case-u.

**Smoke test:** owner vidi listu; cancel uz potvrdu; non-owner ne vidi sekciju; nakon novog invite-a iz dialog-a, sekcija odmah prikazuje novi invite bez page reload-a; resend istog emaila ne dodaje duplikat, samo update-a postojeći.

### 4. Invitee: bell badge + /invites ruta (skeleton)

**Files:**
- `src/app/core/dashboard-layout/dashboard-layout.component.ts` (modify) — uz postojeći `userService.loadCurrentUser()` dodati `inviteService.loadMyInvites()`.
- `src/app/shared/components/navbar/navbar.component.{ts,html}` (modify) — bell button postaje `routerLink="/invites"`; dodati badge (mali crveni krug s `pendingCount()`) preko bell ikone ako `pendingCount() > 0`. A11y: `aria-label="..."`, `aria-live="polite"`, `role="status"` na badge-u.
- `src/app/app.routes.ts` (modify) — dodati `/invites` rutu ispod `authGuard`, lazy load `InvitesPageComponent`.
- `src/app/features/invites/invites-page.component.{ts,html}` (new) — **minimalna verzija** u ovoj fazi: header, container, čita `inviteService.loading()` i `inviteService.myPendingInvites()`. Tri vizualna stanja: loading skeleton (`loading() === true`), empty state (`loading() === false && myPendingInvites().length === 0`), i jednostavan placeholder za listu (samo trip name-ovi, bez actions). Full card layout, Accept + Decline buttoni i decline dialog dolaze u Fazi 5.
- `public/assets/i18n/{en,hr}.json` (modify) — `NAVBAR.NOTIFICATIONS_ARIA`, `INVITES.MINE.TITLE`, `INVITES.MINE.LOADING`, `INVITES.MINE.EMPTY`.

**Loading state guard:** uvijek čitati `loading()` zajedno s listom — ako je `loading() === true`, prikaži skeleton; tek kad `loading() === false && lista prazna`, prikaži empty state. Time se izbjegava flash empty state-a kad korisnik direktno otvori `/invites` deep link prije nego `loadMyInvites` HTTP odgovor stigne.

**Smoke test:** invitee s pending invite-om vidi badge "1" na bell-u; klik vodi na `/invites`; page se renderira ispravno u sva tri stanja (loading skeleton → placeholder s listom ili empty); deep link na `/invites` (čak i prije nego HTTP završi) pokazuje skeleton, ne empty state.

### 5. Invitee: list rendering + accept/decline

**Files:**
- `src/app/features/invites/invites-page.component.{ts,html}` (modify) — zamijeniti placeholder iz Faze 4 s full list rendering-om. Po itemu: trip name, destination (fallback ako null), inviter name, role badge, "expires in X days", Accept + Decline buttoni. Loading skeleton i empty state guard moraju ostati iz Faze 4.
- `src/app/features/invites/decline-invite-dialog.component.{ts,html}` (new) — confirm dialog, po uzoru na `DeleteDayDialogComponent`.
- `src/app/core/services/toast.service.ts` (modify, ako treba) — provjeriti podržava li `action?: { label: string; onClick: () => void }`; ako ne, proširiti API.
- `public/assets/i18n/{en,hr}.json` (modify) — preostali `INVITES.MINE.*` ključevi (npr. `VIEW_TRIP`, `EXPIRES_IN`, `ACCEPT`, `DECLINE`, `DESTINATION_FALLBACK`, `INVITER`), `INVITES.SUCCESS.ACCEPTED`, `INVITES.SUCCESS.DECLINED`.

**Accept flow:**
```ts
this.inviteService.acceptInvite(invite.id).subscribe({
  next: () => {
    this.toast.show({
      message: 'INVITES.SUCCESS.ACCEPTED',
      type: 'success',
      action: { label: 'INVITES.MINE.VIEW_TRIP', onClick: () => this.router.navigate(['/trips', invite.tripId]) },
    });
  },
  error: (err) => this.handleError(err),
});
```

**Smoke test:** invitee accept-a → invite makne iz liste, toast s linkom navigira na trip; decline → confirm → invite nestaje; badge se update-a; brzi double-click na accept proizvodi samo jedan rezultat (silent retry pokriva 409).

### 6. Polish: edge cases + a11y

**Files:**
- `src/app/core/services/invite.service.ts` (refine) — finalizirati `mapToErrorKind` za sve case-ove iz error matrice.
- `src/app/features/invites/invites-page.component.ts` (refine) — handle 403 "Verify your email before accepting" s toast-om + linkom (ako verify ruta postoji u app-u; u protivnom samo toast).
- A11y prolaz: `aria-label` na svim buttonima, role-ovi na liste, focus management u dialog-ima.

**Smoke test:** sve edge cases iz tablice ispod ručno provjeriti.

## Edge cases

- **`tripDestination === null`** → fallback string (i18n `INVITES.MINE.DESTINATION_FALLBACK`).
- **`inviterName === "Deleted user"`** → render kako jest.
- **Stale invite list** (owner cancel-a + invitee accept-a paralelno) → 409 → toast + refresh.
- **Optimistic lock 409 na accept** → silent retry jednom (decline ne retry).
- **Owner pending lista postaje stale kad invitee accept-a** → Phase 1 prihvati (reload trip detail-a fix-a); Phase 2 može SSE.
- **Refresh `/invites` stranice direktno (deep link)** → komponenta čita iz signal-a; ako je prazan (npr. tab restored), `DashboardLayoutComponent.ngOnInit` ga je već populirao na app boot.
- **Mobile** → badge mora biti vidljiv, buttoni dovoljno veliki (Tailwind classes konzistentne s ostatkom app-a).
- **Empty states:**
  - Owner: pending sekcija nije vidljiva uopće ako lista prazna.
  - Invitee: `/invites` prikazuje explicit empty state.

## Rizici

| Rizik | Mitigacija |
|---|---|
| Stale state između bell badge-a i /invites | Jedan source of truth — `InviteService.myPendingInvites` signal |
| Role gating se pokvari ako user/trip nisu još load-ani | Defensive: ne renderiraj UI dok oba signal-a nisu populated (postojeći loading state) |
| i18n ključevi nedostaju u hr.json | Code review checklist — ažurirati EN i HR istovremeno |
| Bell ikona "spam" | Backend ima lazy expiry → lista se prirodno čisti |
| Token expired tijekom open `/invites` | `errorInterceptor` već handle-a 401 (force logout) |

## Verification (manual smoke)

1. **Owner happy path:**
   - Otvori trip kao OWNER → vidi "Invite member" button
   - Pozovi registriranog korisnika (EDITOR) → toast success + pending invites sekcija prikazuje invite
   - Cancel invite → confirm → invite nestaje

2. **Invitee happy path:**
   - Login kao pozvani user → badge "1" na bell-u
   - Klik na bell → `/invites` lista s detaljima
   - Accept → toast s linkom "View trip" → klik vodi na trip; badge "0"
   - Self-pozovi se ponovo, decline → confirm → invite nestaje

3. **Error paths:**
   - Self-invite → field error u modal-u
   - Invite postojećeg člana → field error
   - Invite nepostojećeg user-a → field error
   - VIEWER otvori trip → ne vidi invite button niti pending sekciju
   - Rapid double-click na accept → samo jedan rezultat (retry pokriva)

4. **Edge:**
   - Trip s `destination: null` → fallback tekst
   - HR i EN locale — sve poruke se prevode

5. **Network tab provjera:**
   - `loadMyInvites` se zove jednom na dashboard layout init
   - Accept/decline rade lokalni `tap()` update (nema dodatnog GET-a)
   - Svi pozivi imaju `Authorization: Bearer ...`

## Reuse postojećih obrazaca

| Obrazac | Postojeći primjer | Reuse za |
|---|---|---|
| Service signals + Observable returns | `TripService` | `InviteService` |
| Error mapping na i18n keys | `TripService.mapToErrorKind` | `InviteService.mapToErrorKind` |
| Modal s formom | `AddActivityDialogComponent` | `InviteMemberDialogComponent` |
| Confirm dialog | `DeleteDayDialogComponent` | `CancelInviteDialogComponent`, `DeclineInviteDialogComponent` |
| FormField + server error mapping | `FormFieldComponent` + `err.error.fieldErrors` | Invite modal forma |
| Toast notifikacija | `ToastService.show(...)` | Sve success/error confirmacije |
| Lazy load route ispod auth guarda | `app.routes.ts` `/trips/:id` | `/invites` ruta |
| Role enum | `MemberRole` u `trip.model.ts` | Alias `TripRole = MemberRole` |
