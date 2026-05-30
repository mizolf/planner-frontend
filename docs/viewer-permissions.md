# Trip Detail — Role-Based UX Permissions

## Overview

Backend već provodi role-based authorizaciju (OWNER / EDITOR / VIEWER) i odbija write requeste s 403 za nedovoljne ovlasti. UI to trenutno ne reflektira — vieweri i editori vide iste buttone i dialoge kao owner, kliknu ih, ispune formu, pošalju i tek tada saznaju da nemaju pravo. Ovaj spec polira frontend tako da svaki user vidi samo akcije koje smije izvršiti.

Scope je isključivo **trip detail stranica i njene child komponente**. Backend, service sloj, dialog komponente i `/invites` (accept/decline) flow ostaju nepromijenjeni.

## Permission matrix

| Akcija | OWNER | EDITOR | VIEWER |
|---|---|---|---|
| Add day | ✓ | ✓ | ✗ |
| Delete day | ✓ | ✓ | ✗ |
| Add activity | ✓ | ✓ | ✗ |
| Edit activity | ✓ | ✓ | ✗ |
| Delete activity (inside edit dialog) | ✓ | ✓ | ✗ |
| Invite member | ✓ | ✗ | ✗ |
| View pending invites sekcija | ✓ | ✗ | ✗ |
| Cancel invite | ✓ | ✗ | ✗ |
| Accept / decline svoj invite (na `/invites`) | n/a | n/a | n/a (odvojen flow) |
| Pregled tripa (read) | ✓ | ✓ | ✓ |

## UX odluke

| Odluka | Vrijednost |
|---|---|
| Vizualna strategija | Potpuno sakriti buttone na koje user nema pristup — bez disable + tooltip, bez info banera. Konzistentno s postojećim `@if (isOwner())` patternom za invite member. |
| Empty-state za viewera (trip bez dana) | Prikazati read-only poruku `TRIPS.DETAIL.DAYS.EMPTY_READONLY` ("Organizator još nije dodao dane na ovaj put.") umjesto Add Day buttona. |
| Defensive guardovi u handlerima | **Ne dodajemo.** Buttoni su skriveni, pa su `open*` handleri nedohvatljivi za nedovoljne role — guard (`if (!this.canEditContent()) return;`) bio bi mrtav kod koji se nikad ne izvrši. Pravu autorizaciju radi backend (403). Postojeći `if (!trip) return;` null-checkovi ostaju netaknuti. |
| Backend 403 na write | Već pokriven postojećim `ERROR_GENERIC` branchom u dialozima (rubni slučaj: role promijenjena u stale tabu → submit vrati 403 → dialog pokaže generičku grešku, spinner stane). Ne dodajemo permission-specifičnu poruku — dialozi su izvan opsega, slučaj je rijedak. |
| Cancel invite | Sekcija je već owner-only kroz `@if (isOwner())` nad cijelim sekcijskim wrapper-om — handler je nedohvatljiv za non-ownere. Bez dodatnog guarda. |
| Toast na permission denial | Ne koristimo. Buttoni su skriveni → user nedovoljne role nikad ne pokrene write akciju. Pravi 403 sa servera (stale tab) pokriva generička dialog poruka (vidi red iznad). |
| Apstrakcija | `canEditContent` je 4-linijski `computed` direktno u `trip-detail-page.component.ts`. Bez novog `PermissionsService` ili helper file-a — YAGNI. |
| Reuse postojećeg | Sve child komponente (`trip-day-picker`, `trip-day-card`) već primaju gating inpute (`canAddDay`, `canDelete`, `canAddActivity`, `canEditActivity`). Gateiramo na call-site (parent template), child komponente se ne diraju. |

## Trenutno stanje

| Akcija | Gdje je gate | Što treba |
|---|---|---|
| Invite member button | `trip-detail-page.html` + `trip-members-section.html` — `@if (isOwner())` ✓ | bez promjene |
| Pending invites sekcija | `pending-invites-section.ts` — `computed visible = isOwner() && length > 0` ✓ | bez promjene |
| Cancel invite handler | `pending-invites-section.ts:openCancel()` — sekcija već owner-only kroz `@if (isOwner())` | bez promjene |
| Add day (picker) | `[canAddDay]="true"` — hardkodirano ❌ | `[canAddDay]="canEditContent()"` |
| Add day (empty state) | bez gate-a ❌ | wrappati u `@if (canEditContent()) { ... } @else { <readonly empty> }` |
| Delete day | `[canDelete]="true"` — hardkodirano ❌ | `[canDelete]="canEditContent()"` |
| Add activity | `[canAddActivity]="true"` — hardkodirano ❌ | `[canAddActivity]="canEditContent()"` |
| Edit activity (klik na card) | `[canEditActivity]="true"` — hardkodirano ❌ | `[canEditActivity]="canEditContent()"` |
| Delete activity unutar edit dialoga | bez gate-a | nedostupno tranzitivno — edit dialog se ne otvara vieweru |

## Postojeća infrastruktura za reuse

- `MemberRole` tip: `src/app/core/models/trip.model.ts:44` — `"OWNER" | "EDITOR" | "VIEWER"`
- `currentUserRole` & `isOwner` computeds: `trip-detail-page.component.ts:59-66`
- `UserService.currentUser()` signal: `src/app/core/services/user.service.ts`
- `ToastService`: `src/app/shared/services/toast.service.ts` (postoji za success/error, ne koristimo za permission gate)

## Implementacijski koraci

### 1. Dodati `canEditContent` computed

**File:** `src/app/features/trips/trip-detail/trip-detail-page.component.ts`

Ispod postojećeg `isOwner` (linija ~66) dodati:

```ts
readonly canEditContent = computed(() => {
  const role = this.currentUserRole();
  return role === 'OWNER' || role === 'EDITOR';
});
```

`isOwner` ostaje netaknut — koristi se za member-management akcije. Ne uvoditi `isEditor`/`isViewer` ako nigdje ne trebaju.

### 2. Gateirati day & activity buttone u template-u

**File:** `src/app/features/trips/trip-detail/trip-detail-page.component.html`

Zamijeniti hardkodirane vrijednosti (linije ~78–90):

```html
[canAddDay]="canEditContent()"
[canDelete]="canEditContent()"
[canAddActivity]="canEditContent()"
[canEditActivity]="canEditContent()"
```

Empty-state "Add Day" button (linije ~66–72) — wrappati cijeli button u `@if (canEditContent())` i dodati `@else` block s read-only porukom (vidi korak 4 za i18n key).

### 3. Activity card cursor verifikacija (no code change očekivan)

**File:** `src/app/features/trips/trip-detail/trip-day-card.component.html`

Activity item već koristi `[class.cursor-pointer]="canEditActivity()"` i `(click)="canEditActivity() && editActivity.emit(activity)"`. Kad `canEditActivity` postane `false` (viewer), cursor i klik već su correctno disable-ani. Verificirati u browseru — bez izmjena ako se ponaša točno.

### 4. i18n key za read-only empty state

**Files:** `public/assets/i18n/en.json` i `public/assets/i18n/hr.json` (učitavaju se preko `provideTranslateHttpLoader`, default jezik `en`)

Dodati pod `TRIPS.DETAIL.DAYS` kao ravni susjedni ključ uz postojeći `EMPTY` objekt:

```json
// hr.json
"EMPTY_READONLY": "Organizator još nije dodao dane na ovaj put."

// en.json
"EMPTY_READONLY": "The organizer hasn't added any days to this trip yet."
```

Engleski je fallback za sve jezike, pa ga obavezno dodati uz hrvatski.

## Files koji se mijenjaju

- `src/app/features/trips/trip-detail/trip-detail-page.component.ts` — dodati `canEditContent` computed (bez novih guardova)
- `src/app/features/trips/trip-detail/trip-detail-page.component.html` — zamijeniti 4 hardkodirana `true` + wrappati empty-state Add Day + dodati `@else` s read-only porukom
- `public/assets/i18n/en.json` i `public/assets/i18n/hr.json` — novi `TRIPS.DETAIL.DAYS.EMPTY_READONLY` key

## Što SE NE mijenja (eksplicitno)

- `MemberRole` tip i `currentUserRole` computed
- Child komponente (`trip-day-picker`, `trip-day-card`) i njihovi `canX` inputi — gateiramo na call-site
- Backend, service sloj, dialog komponente
- `/invites` accept/decline flow (potpuno odvojena stranica)
- `ToastService` integracija

## Verifikacija (manualni smoke kroz 3 user-a)

Preduvjet: backend pokrenut sa seed podacima koji imaju isti trip s 3 različita member-a (OWNER, EDITOR, VIEWER).

1. **OWNER login → trip detail:** vidljivi Add Day (picker), Delete Day, Add Activity, Edit Activity (cursor-pointer + klik otvara dialog), Invite Member, Pending Invites sekcija s Cancel buttonima.
2. **EDITOR login → isti trip:** vidljivi Add Day, Delete Day, Add Activity, Edit Activity. **Skriveno**: Invite Member button, cijela Pending Invites sekcija.
3. **VIEWER login → isti trip:** svi write buttoni skriveni. Klik na activity item ne otvara dialog, nema cursor-pointer. Ako trip nema dana → vidljiva `EMPTY_READONLY` poruka umjesto Add Day buttona. Pending invites sekcija skrivena.
4. **No regressions:** navigacija po danima, prikaz aktivnosti za sve tri role rade isto kao prije. Accept/decline na `/invites` stranici funkcionira nezavisno.

Ako sve gore prođe → polish je gotov.
