# Profil – proširenje: promjena lozinke + putne preferencije

Spec za dovršetak profila: dodavanje **promjene lozinke** i **spremljenih putnih
preferencija (interesa)** kroz backend i frontend, te zasebne `/settings` stranice.

## Kontekst

Read-only `/profile` stranica je gotova (identitet + statistika + nedavna putovanja +
activity feed). Ovaj dokument pokriva dio koji je tada bio odgođen jer je tražio backend.

Backend trenutno nudi samo `GET /users/me` (vraća cijeli `User` entity) i nema endpointe
za mutiranje korisnika. `Interest` enum postoji i već se koristi na putovanjima
(`Trip.interests`), pa preferencije korisnika gradimo zrcaljenjem tog obrasca.

## Opseg i odluke

**Gradimo:**
- Promjenu lozinke (`currentPassword` + `newPassword`).
- Putne preferencije = **samo interesi** (spremljeni po korisniku).
- Zasebnu `/settings` stranicu sa sekcijama: lozinka + preferencije.
- Read-only prikaz interesa na `/profile` + link na postavke.

**Ne gradimo (izvan opsega):**
- Izmjenu imena.
- Izmjenu emaila — email je login identitet (`User.getUsername()` vraća email), pa bi
  tražila ponovnu verifikaciju i invalidaciju tokena. Odgođeno.
- App-postavke (jezik, tema, notifikacije) — frontend-only, zasebna buduća faza.

**Usputni cleanup:** `GET /users/me` vraća cijeli `User` entity, pa Jackson serijalizira i
`password` hash (samo `userTrips` je `@JsonIgnore`). Prelaskom na prošireni `UserResponse`
DTO to rješavamo i dobivamo mjesto za `preferredInterests`.

---

## Backend (`/Users/mcesnik/dev/diplomski/planner-backend`)

Paket: `com.mcesnik.planner_backend`.

### 1. Entity — `model/User.java`

Dodati polje, zrcaljeći `Trip.interests` (`Trip.java:44-48`):

```java
@ElementCollection
@CollectionTable(name = "user_interests", joinColumns = @JoinColumn(name = "user_id"))
@Enumerated(EnumType.STRING)
@Column(name = "interest")
private Set<Interest> preferredInterests = new HashSet<>();
```

`Interest` je u `model/Enums/Interest.java` (CULTURE, FOOD, ADVENTURE, NATURE, NIGHTLIFE,
SHOPPING, RELAXATION, HISTORY).

### 2. Migracija — `src/main/resources/db/migration/V4__add_user_interests.sql`

Flyway je u `validate` modu, pa migracija mora odgovarati entitetu. Zrcaliti `trip_interests`
iz `V1__baseline.sql:93` (tablica + CHECK na enum + FK na `users`):

```sql
CREATE TABLE public.user_interests (
    user_id bigint NOT NULL,
    interest character varying(255),
    CONSTRAINT user_interests_interest_check CHECK (
        (interest)::text = ANY ((ARRAY[
            'CULTURE','FOOD','ADVENTURE','NATURE',
            'NIGHTLIFE','SHOPPING','RELAXATION','HISTORY'
        ])::text[])
    )
);

ALTER TABLE ONLY public.user_interests
    ADD CONSTRAINT fk_user_interests_user
    FOREIGN KEY (user_id) REFERENCES public.users(id);
```

### 3. DTO-ovi (`DTO/`)

Mirror `RegisterUserDTO` (Jakarta validacija):

```java
// ChangePasswordDTO
@NotBlank(message = "Current password is required")
private String currentPassword;

@NotBlank(message = "New password is required")
@Size(min = 8, message = "Password must be at least 8 characters")
private String newPassword;
```

```java
// UpdatePreferencesDTO
private Set<Interest> interests;   // null/prazno = obriši sve preferencije
```

### 4. Response — `responses/UserResponse.java`

Dodati `private Set<Interest> preferredInterests;` i statički helper da se izbjegne
duplikacija mapiranja:

```java
public static UserResponse from(User u) {
    return UserResponse.builder()
        .id(u.getId())
        .fullName(u.getFullName())
        .email(u.getEmail())
        .preferredInterests(u.getPreferredInterests())
        .build();
}
```

### 5. Service — `service/UserService.java`

Dodati mutacijske `@Transactional` metode (inject `UserRepository`, `PasswordEncoder`):

```java
public void changePassword(User user, ChangePasswordDTO dto) {
    if (!passwordEncoder.matches(dto.getCurrentPassword(), user.getPassword())) {
        throw new InvalidPasswordException("Current password is incorrect");
    }
    user.setPassword(passwordEncoder.encode(dto.getNewPassword()));
    userRepository.save(user);
}

public UserResponse updatePreferences(User user, Set<Interest> interests) {
    user.setPreferredInterests(interests != null ? interests : new HashSet<>());
    userRepository.save(user);
    return UserResponse.from(user);
}
```

### 6. Controller — `controller/UserController.java`

- `GET /me` → vraća `UserResponse.from(currentUser)` umjesto `User` entity-ja.
- `PUT /me/password` → `@Valid @RequestBody ChangePasswordDTO`; usera dohvati iz
  `SecurityContextHolder` (kao postojeći `/me`); poziv servisa; **`204 No Content`**.
- `PUT /me/preferences` → `@Valid @RequestBody UpdatePreferencesDTO`; vrati ažurirani
  `UserResponse`.

Napomena: JWT ostaje valjan nakon promjene lozinke (stateless dizajn, nema token-verzioniranja).
Svjesno ne forsiramo re-login — usklađeno s postojećim ponašanjem.

### 7. Exception (`exception/`)

`InvalidPasswordException extends RuntimeException` + handler u `GlobalExceptionHandler`
→ `400` s `code = "INVALID_CURRENT_PASSWORD"` (mirror postojećih conflict handlera koji
koriste `ErrorResponse.code`). Time frontend razlikuje "kriva trenutna lozinka" od
bean-validacijskih `fieldErrors`.

---

## Frontend (`/Users/mcesnik/dev/diplomski/planner-frontend`)

### 1. Modeli — `core/models/user.model.ts`

```ts
import { Interest } from './trip.model';

export interface User {
  id: number;
  fullName: string;
  email: string;
  preferredInterests: Interest[];   // novo
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdatePreferencesRequest {
  interests: Interest[];
}
```

### 2. `core/services/user.service.ts`

Dodati (vraćaju Observable; `updatePreferences` ažurira `_currentUser` preko `tap`):

```ts
changePassword(req: ChangePasswordRequest): Observable<void> {
  return this.http.put<void>(`${this.apiUrl}/me/password`, req);
}

updatePreferences(req: UpdatePreferencesRequest): Observable<User> {
  return this.http.put<User>(`${this.apiUrl}/me/preferences`, req)
    .pipe(tap((user) => this._currentUser.set(user)));
}
```

### 3. Ruta — `app.routes.ts`

Dodati child rutu pod dashboard-layout (uz `/profile`):

```ts
{ path: 'settings', loadComponent: () =>
    import('./features/settings-page/settings-page.component')
      .then(m => m.SettingsPageComponent) },
```

### 4. Nova `features/settings-page/` — `SettingsPageComponent`

Standalone, signal API. Dvije kartice, obje prate obrazac iz
`features/trips/create-trip-dialog/create-trip-dialog.component.ts` (FormBuilder,
`loading`/`errorMessage` signali, submit → service → toast):

**Kartica "Promjena lozinke"**
- Reaktivna forma: `currentPassword`, `newPassword`, `confirmPassword`.
- Reuse `PasswordFieldComponent`; cross-field `passwordsMatch` validator (mirror
  `auth/register/register.component.ts`).
- Submit → `userService.changePassword(...)`:
  - uspjeh → reset forme + `toastService.show({ message: 'SETTINGS.PASSWORD.SUCCESS', type: 'success' })`.
  - 400 s `err.error?.code === 'INVALID_CURRENT_PASSWORD'` → greška ispod `currentPassword`.
  - ostali 400 `fieldErrors` → standardni prikaz; ostalo → generička poruka.

**Kartica "Putne preferencije"**
- Forma s kontrolom `interests` (`Interest[]`).
- Reuse `InterestChipsComponent`: `<app-interest-chips label="SETTINGS.PREFERENCES.LABEL" controlName="interests" />`.
- U `ngOnInit` predpuniti iz `userService.currentUser()?.preferredInterests ?? []`.
- Submit → `userService.updatePreferences({ interests })` → success toast.

### 5. `/profile` (read-only dodatak)

U `features/profile-page/profile-page.component.html`:
- Mala "Travel style" sekcija: prikaži `user()?.preferredInterests` kao chipove
  (reuse `'TRIPS.INTERESTS.' + interest` ključeva). Ako je prazno, kratak hint.
- Gumb/link "Postavke" → `routerLink="/settings"` (npr. u header kartici).

### 6. Navbar — `shared/components/navbar/navbar.component.html`

Dodati "Settings" stavku u profile dropdown (iznad dividera, gear ikona) →
`routerLink="/settings"`.

### 7. i18n — `public/assets/i18n/en.json` + `hr.json`

- `NAV.SETTINGS`.
- `SETTINGS` namespace:
  - naslov/podnaslov stranice,
  - `PASSWORD.*`: labeli polja, validacijske poruke (required, minlength, mismatch),
    `INVALID_CURRENT`, `SUCCESS`,
  - `PREFERENCES.*`: `LABEL`, `SAVE`, `SUCCESS`.
- Nazive interesa **ne** dodavati — reuse `TRIPS.INTERESTS.*`.

---

## Reuse (ne pisati iznova)

- `PasswordFieldComponent`, `FormFieldComponent`, `InterestChipsComponent` (`shared/components/`).
- `passwordsMatch` cross-field validator obrazac iz `auth/register/register.component.ts`.
- Forma + toast obrazac iz `features/trips/create-trip-dialog/`.
- `ToastService` (`shared/services/toast.service.ts`).
- Backend: `RegisterUserDTO` (validacija lozinke), `Trip.interests` mapping + `trip_interests`
  migracija, `GlobalExceptionHandler` obrazac.

---

## Verifikacija (end-to-end)

**Backend** (`planner-backend`):
1. `./gradlew build` — migracija V4 prolazi (Flyway `validate`), app se digne.
2. `PUT /users/me/password`: kriva trenutna → `400 INVALID_CURRENT_PASSWORD`; ispravna → `204`;
   zatim login novom lozinkom radi.
3. `PUT /users/me/preferences` → `200` s `preferredInterests`; `GET /users/me` vraća iste i
   **ne** sadrži `password`.

**Frontend** (`planner-frontend`):
4. `npx ng build` — bez grešaka.
5. `npm start`, prijava → otvoriti `/settings` (navbar dropdown + gumb na `/profile`).
6. Promjena lozinke: kriva trenutna → poruka greške; ispravna → success toast; odjava i
   prijava novom lozinkom.
7. Odabir interesa → save → success; provjeriti read-only prikaz na `/profile`.
8. Jezik `hr` — svi novi tekstovi prevedeni (nema sirovih ključeva).
```
