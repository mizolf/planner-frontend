# Zajednica — Javna putovanja (Faza 2A)

> **Status:** spec za implementaciju. Ovo je razrada **Faze 2A** iz `docs/explore-page.md` (§6).
> Pokriva **frontend + backend ugovor** (backend je zaseban Spring Boot servis — ovdje je
> definiran samo ugovor: endpointi, DTO oblici, DB promjena; ne Java kod).

## 1. Kontekst i cilj

`/explore` trenutno ima dvije "Coming soon" teaser kartice (Zajednica, Destinacije) bez
funkcionalnosti (`explore-page.component.html:118-168`). Ova faza pretvara **Zajednicu** u pravu
značajku:

1. Korisnik objavi svoje putovanje kao **PUBLIC**.
2. Drugi ga pronađu u novom **"Zajednica" tabu** na `/explore`.
3. Pregledaju cijeli itinerar i **kloniraju ga u svoja** (privatna kopija).

**Ključna ideja:** javna putovanja su **user-generated ekvivalent** trenutno hardkodiranih explore
template-a. Zato frontend **namjerno preslikava postojeći `applyTemplate` flow** umjesto da izmišlja
novi. Jedini stvarno nov obrazac u aplikaciji je **infinite scroll**.

**Zaključane odluke:**
- Clone preslikava `applyTemplate` semantiku (korisnik bira datum u dijalogu, dani se pomaknu).
- Clone **NE kopira budžet** izvora (kopija počinje s `budget=null` — budžet je u javnom pregledu skriven).
- Cover slika = placeholder (gradijent + ikona + destinacija); **bez uploada**.
- UI = **tab na `/explore`** (ne zasebna stranica) + deep-link ruta.
- Popis javnih putovanja = **numerirana paginacija** (ne infinite scroll) — leži na postojećem `PageResponse<T>`.
- Filteri = **samo pretraga** (destinacija/naziv).
- Spec pokriva **FE + BE ugovor**.

---

## 2. Backend ugovor

### 2.1 DB promjena
`trips` tablica dobiva:
```
visibility VARCHAR(10) NOT NULL DEFAULT 'PRIVATE'   -- enum: PRIVATE | PUBLIC
```
- Index `(visibility, updated_at DESC)` za efikasno paginiranje javnog popisa bez skeniranja privatnih.
- Postojeći redovi → `PRIVATE` preko defaulta (siguran default — ništa se slučajno ne objavi).
- Nema novih tablica, nema cover-image kolone.

### 2.2 Endpointi

| Endpoint | Tko smije | Ponašanje |
|---|---|---|
| `PATCH /trips/{id}/visibility` body `{ "visibility": "PUBLIC"\|"PRIVATE" }` | **samo OWNER** (editor/viewer/ne-član → 403) | postavi vidljivost; idempotentno; vraća `TripResponse` (s novim `visibility`) |
| `GET /trips/public?page&size&search` | bilo koji auth korisnik | `PageResponse<PublicTripSummaryResponse>`; samo `visibility=PUBLIC`; `search` = name ILI destination (case-insensitive contains); sort `updated_at DESC` |
| `GET /trips/public/{id}` | bilo koji auth korisnik, **samo ako PUBLIC** | `PublicTripDetailResponse`; PRIVATE/nepostojeći → **404** |
| `POST /trips/{id}/clone` body `{ "startDate": "YYYY-MM-DD", "name"?: string }` | bilo koji auth korisnik; izvor mora biti PUBLIC | deep-copy dana+aktivnosti pomaknutih na `startDate`; owner = pozivatelj; `visibility=PRIVATE`; vraća `TripResponse` |

**Zašto zaseban javni detail endpoint, a ne postojeći `GET /trips/{id}`:** postojeći je autoriziran
**članstvom** (vraća 403 `NO_ACCESS` za ne-članove) i u `members[]` nosi **email**
(`trip.model.ts:153`). Gledatelj Zajednice je po definiciji ne-član → postojeći endpoint bi ga
odbio, a i da ne odbije, procurili bi emailovi. Treba zaseban javni DTO koji striipa privatne podatke.

**Zašto 404 (ne 403) za privatno/nepostojeće:** da se ne otkrije postojanje tuđeg privatnog tripa.

### 2.3 DTO oblici
```
PublicTripSummaryResponse  { id, name, destination, startDate, endDate, durationDays,
                             interests: Interest[], ownerDisplayName, memberCount }

PublicTripDetailResponse   { id, name, description, destination, latitude, longitude,
                             startDate, endDate, durationDays, interests: Interest[],
                             ownerDisplayName, memberCount, days: PublicTripDayResponse[] }

PublicTripDayResponse      { dayNumber, date | null, title | null, notes | null,
                             activities: PublicTripActivityResponse[] }

PublicTripActivityResponse { name, description, location, latitude, longitude,
                             startTime, endTime, category }

CloneTripRequest           { startDate: string, name?: string }
```
- `durationDays` server računa (`endDate - startDate + 1`) — kartica ne radi date-matematiku.
- Javni day/activity DTO su **superset** template DTO-a iz `explore.model.ts`
  (`PublicTripActivityResponse` ima `latitude/longitude/category` kojih `TemplateActivityResponse` nema;
  `...DayResponse` ima `date/title`). Reuse je na **razini render-petlje** (zajednička polja
  `dayNumber/notes/activities[].{startTime,name,location,description}`), ne literalnog interface-a;
  community preview je ionako duplikat (§3.5) koji dodatna polja ignorira.
- `TripResponse` dobiva i `visibility: 'PRIVATE'|'PUBLIC'` (aditivno, backward-compatible) — treba
  na detail stranici za stanje toggle-a.

### 2.4 Clone semantika (preslika `applyTemplate`)
**Korisnik bira `startDate` u clone dijalogu — originalni datumi izvornog putovanja se NE kopiraju.
Članovi se NE kopiraju (samo pozivatelj postaje OWNER).** Trip i dani u modelu OBAVEZNO imaju datum
(`CreateTripRequest`, `CreateTripDayRequest`), pa kopija mora dobiti datume koje korisnik odabere.

- Dan N → `startDate + (N-1)` dana; `endDate = startDate + (durationDays - 1)`.
- `startTime`/`endTime` aktivnosti su vremena u danu → **kopiraju se nepromijenjeno** (NE pomiču se).
- `interests` se kopiraju; **`budget` izvora se NE kopira** (kopija dobiva `budget=null` — financijski
  podatak je u javnom pregledu skriven, pa ga ne prenosimo). `cost` po aktivnosti se također NE kopira.
- Nova kopija je `visibility=PRIVATE`, owner = pozivatelj (korisnik koji klikne Clone), jedini član.

### 2.5 Privatnost (što izlazi vs skriva)

| Podatak | Javni popis | Javni detail | Napomena |
|---|---|---|---|
| Owner email | skriveno | skriveno | nikad izloženo |
| Lista članova / emailovi | samo `memberCount` | samo `memberCount` | bez per-člana podataka |
| Owner ime | izloženo | izloženo | samo display name |
| Itinerar (dani/aktivnosti/koordinate) | n/a | izloženo | sama svrha |
| Budžet / cijena aktivnosti | skriveno | skriveno | financijski podatak, privatan |
| Privatna putovanja | isključena | 404 | nisu nabrojiva |

---

## 3. Frontend

### 3.1 Modeli
- **CREATE** `core/models/community.model.ts` — interface-i iz §2.3 + `CloneTripRequest`.
- **MODIFY** `core/models/trip.model.ts` — dodati `visibility: 'PRIVATE'|'PUBLIC'` na `TripResponse`.

### 3.2 `PublicTripsService` — CREATE `core/services/public-trips.service.ts`
Prati `ExploreService` konvencije (`_x` / `x.asReadonly()`, `inject(HttpClient)`, `environment.apiUrl`,
`inject(TripService)`).

Reuse postojeći `PageResponse<T>` (`core/models/activity.model.ts`) i `HttpParams` obrazac iz
`activity-feed.service.ts`.

**Signali:** `_trips` (sadržaj **trenutne** stranice — replace, ne akumulira), `_loading`, `_error`,
`_page`, `_totalPages`, `_initialized` (plain `boolean` guard da se tab učita jednom — radimo ga
od nule, `explore.service.ts` nema takav obrazac), `currentSearch` (plain polje), plus
`_detail` / `_detailLoading` / `_detailError` za preview.

**Paginacija (numerirana):**
```
loadFirstPage(search = ''):     // prvi ulazak u tab + svaka promjena pretrage
  currentSearch = search; fetchPage(0)

goToPage(p):                    // paginator zove
  if (_loading() || p === _page()) return;
  fetchPage(p)

refresh():                      // nakon clone-404 (re-fetch trenutne stranice)
  fetchPage(_page())

fetchPage(page):
  _loading=true; const requestSearch = currentSearch
  GET /trips/public?page&size=PAGE_SIZE&search → PageResponse
    next(p):
      if (requestSearch !== currentSearch) return;   // odbaci stale odgovor stare pretrage
      _trips = p.content; _page = p.number; _totalPages = p.totalPages; _loading=false
    error: _loading=false; _error='EXPLORE.COMMUNITY.ERROR_LOADING'
```
`PAGE_SIZE = 12`. Stale-search guard ostaje; double-fire/sentinel guardi otpadaju (nema infinite scrolla).

**Detail + clone:**
```
loadPublicTrip(id):  reset _detail; GET /trips/public/{id} → _detail; 404 → ERROR_NOT_FOUND
clearDetail():       _detail=null; _detailError=null
clone(id, body):     http.post<TripResponse>('/trips/{id}/clone', body)
                       .pipe(tap(trip => tripService.addTrip(trip)))   // isti sink kao applyTemplate
```

### 3.3 Paginator — CREATE `shared/components/paginator/paginator.component.{ts,html}`
Mala reusable komponenta (modern API) za numeriranu paginaciju.
```ts
@Component({ selector: 'app-paginator', standalone: true, ... })
export class PaginatorComponent {
  readonly page = input.required<number>();        // 0-based, trenutna stranica
  readonly totalPages = input.required<number>();
  readonly pageChange = output<number>();          // emitira 0-based broj stranice
  // computed: vidljiv prozor brojeva oko trenutne stranice; prev/next disabled na rubovima
}
```
Render: « prev | windowed brojevi stranica | next », disabled na rubovima,
**sakriven kad `totalPages <= 1`**. Explore-page nakon `pageChange` zove `goToPage(p)` + scroll na vrh grida.

### 3.4 `PublicTripCardComponent` — CREATE `features/explore/public-trip-card/`
Preslika `template-card` layouta (slika lijevo / sadržaj desno). `input.required<PublicTripSummaryResponse>()`
+ `output cardClick`. Modern API (`input()`/`output()`/`inject()`).
- **Placeholder cover** (bez `imageUrl`): uvijek gradijent `bg-gradient-to-br from-primary/15 to-tertiary/15`
  + `material-symbols` ikona + destinacija (obrazac `@else` fallbacka s template kartica).
- Badge-evi: dani (`EXPLORE.DAYS`), interest pillovi (`TRIPS.INTERESTS.*`), **member-count pill**
  (`groups` ikona + `EXPLORE.COMMUNITY.MEMBER_COUNT`).
- Owner red: mali avatar (`initialsOf(ownerDisplayName)`) + ime.

### 3.5 `CommunityPreviewDialogComponent` — CREATE `features/explore/community-preview-dialog/`
**Duplikat `template-preview-dialog`** (originale NE diramo — lokalna duplikacija umjesto izmjene
postojeće komponente). Razlike:
- Čita `publicTripsService.detail / detailLoading / detailError`.
- `open(id)` → `loadPublicTrip(id)`; `close()` → `clearDetail()`.
- Dodaje **owner + member-count** red iznad itinerara (template verzija toga nema).
- Itinerar render **identičan** (imena polja se poklapaju).
- CTA `EXPLORE.COMMUNITY.CLONE_BUTTON` → `output cloneClicked`, disabled kad nema dana.

### 3.6 `CloneTripDialogComponent` — CREATE `features/explore/clone-trip-dialog/`
**Duplikat `apply-template-dialog`**. Razlike:
- Forma: `startDate` (required, `dateNotInPast`) + `name` (maxLength 255) — **bez budget polja**
  (clone body je `{ startDate, name? }`).
- Reuse `endDate` computed: `toSignal(startDate.valueChanges)` + `date.setDate(getDate() + (durationDays-1))`
  (`apply-template-dialog.component.ts:52-60`), `FormFieldComponent`, `BodyScrollLockService`,
  `dateNotInPast` validator.
- `onSubmit` zove `publicTripsService.clone(...)`, mapira greške po statusu (400 / 401-403 / 404 /
  generic), emit `tripCreated`.

### 3.7 Tab na explore-page — MODIFY `explore-page.component.{ts,html}`
- `.ts`: `activeTab = signal<'TEMPLATES'|'COMMUNITY'>('TEMPLATES')`; `inject(PublicTripsService)`;
  `setTab(tab)` lazy-loada Zajednicu na prvi ulazak (guard `if (!publicTripsService.initialized())
  loadFirstPage(searchTerm())`). Zajednički `searchTerm` vozi oba taba — za Zajednicu **debounce ~300ms**
  → `loadFirstPage(term)` (server-side), za Templates ostaje client-side `filteredTemplates`. Dodati
  `viewChild` za dva nova dijaloga + handlere `onCommunityCardClick / onCloneClicked / onCloneSuccess / onPageChange`.
  U `ngOnInit` pročitati rutu (`route.snapshot.data['tab']`) i postaviti početni tab.
- `.html`: tab bar (obrazac `my-trips-page.component.html:67-100`, `border-b-2` aktivni underline)
  iznad sadržaja; postojeći templates `<section>` u `@if (activeTab()==='TEMPLATES')`; nova Zajednica
  sekcija s gridom `app-public-trip-card`, skeleton/error+retry/empty/empty-search stanjima i
  **`app-paginator` ispod grida**. **Style-filter čipovi vidljivi samo na Templates tabu** (community
  pretraga je samo name/destination). **Ukloniti Community teaser** karticu; Destinacije teaser
  **ostaje** (još je vizija) — grid u 1 kolonu. Dodati dva nova dijaloga uz postojeće.

### 3.8 Ruta — MODIFY `app.routes.ts`
Dodati sibling deep-link koji učita **istu** komponentu:
```ts
{ path: 'explore/community', data: { tab: 'COMMUNITY' },
  loadComponent: () => import('./features/explore-page/explore-page.component')
    .then(m => m.ExplorePageComponent) }
```
`setTab` ažurira URL preko `Location.replaceState` (shareable / back-button korektno).

### 3.9 Visibility toggle na trip detail (samo owner)
- **MODIFY** `trip-detail/trip-detail-header.component.{ts,html}` — `input canToggleVisibility=false`
  + `output toggleVisibility`; UI pill "Public/Private" (`public`/`lock` ikona) u owner action zoni.
- **MODIFY** `trip-detail/trip-detail-page.component.{ts,html}` — `[canToggleVisibility]="isOwner()"`
  + `(toggleVisibility)="onToggleVisibility()"` → zove novi `TripService.setVisibility`.
- **MODIFY** `trip.service.ts` — `setVisibility(tripId, visibility)`:
  ```ts
  setVisibility(tripId, visibility): Observable<TripResponse> {
    return this.http.patch<TripResponse>(`${this.apiUrl}/${tripId}/visibility`, { visibility })
      .pipe(tap(updated => {
        this._tripDetail.update(d => d ? { ...d, visibility: updated.visibility } : d);
        this._trips.update(ts => ts.map(t => t.id === tripId ? { ...t, visibility: updated.visibility } : t));
      }));
  }
  ```
  **Server-potvrđeno** (ne optimistično — privatnost kontrola); success/error toast; bez refetcha cijelog detalja.

### 3.10 i18n — MODIFY `public/assets/i18n/{en,hr}.json`
Pod `EXPLORE`: `TEMPLATES.TAB`, `COMMUNITY.{TAB, HEADING, SUBTITLE, EMPTY, EMPTY_SEARCH, ERROR_LOADING,
ERROR_NOT_FOUND, MEMBER_COUNT, BY_OWNER, CLONE_BUTTON, LOADING_MORE}`, `COMMUNITY.CLONE.{TITLE, SUBTITLE,
START_DATE_LABEL, END_DATE_HINT, NAME_LABEL, NAME_PLACEHOLDER, SUBMIT, CANCEL, SUCCESS, ERROR_VALIDATION,
ERROR_UNAUTHORIZED, ERROR_NOT_FOUND, ERROR_GENERIC}`. Pod `TRIPS.DETAIL.VISIBILITY.{PUBLIC, PRIVATE,
MAKE_PUBLIC, MAKE_PRIVATE, PUBLISHED_TOAST, UNPUBLISHED_TOAST, ERROR}`. Ukloniti
`EXPLORE.COMING_SOON.COMMUNITY_*` (Community teaser nestaje).

---

## 4. Datoteke

**CREATE**
- `core/models/community.model.ts`
- `core/services/public-trips.service.ts`
- `shared/components/paginator/paginator.component.{ts,html}`
- `features/explore/public-trip-card/public-trip-card.component.{ts,html}`
- `features/explore/community-preview-dialog/community-preview-dialog.component.{ts,html}`
- `features/explore/clone-trip-dialog/clone-trip-dialog.component.{ts,html}`

**MODIFY**
- `core/models/trip.model.ts` (dodati `visibility`)
- `core/services/trip.service.ts` (dodati `setVisibility`)
- `features/explore-page/explore-page.component.{ts,html}` (tab, Zajednica sekcija, dijalozi)
- `app.routes.ts` (deep-link `/explore/community`)
- `features/trips/trip-detail/trip-detail-header.component.{ts,html}` (toggle)
- `features/trips/trip-detail/trip-detail-page.component.{ts,html}` (wire toggle)
- `public/assets/i18n/{en,hr}.json`

**NE diramo (zaključano):** `template-preview-dialog/`, `apply-template-dialog/`, `template-card/`,
`style-*` — dupliciramo, nikad ne mijenjamo.

---

## 5. Rubni slučajevi
1. **Stale pretraga** — uhvati `currentSearch` po zahtjevu, odbaci odgovore čiji se term promijenio; debounce input.
2. **`totalPages`** vodi paginator (`number+1 < totalPages` nije potreban — paginator računa iz `page`/`totalPages`); kratka zadnja stranica je validna; prazna page 0 → empty state, paginator sakriven (`<=1`).
3. **Promjena pretrage** resetira na page 0 (`loadFirstPage`).
4. **Trip se odjavi tijekom pregleda** — clone vrati 404 → poruka "više nije javno", zatvori dijalog, `refresh()` (re-fetch trenutne stranice).
5. **Kloniranje vlastitog javnog tripa** — dopušteno (svjež PRIVATE kopija), bez specijalnog slučaja.
6. **Stanja liste** — skeleton / error+retry / empty / empty-search; paginator sakriven dok je ≤1 stranica.
7. **Teardown** — nema sentinela/observera; servis state preživi promjenu taba (cache), nova pretraga refetcha.
8. **Curenje privatnosti** — FE zove `/trips/public/{id}` (nikad member-gated `/trips/{id}`); DTO bez `members`/`cost`/`budget`.
9. **Pomak datuma** — server je izvor istine (dan N → start+(N-1)); `endDate` u dijalogu je samo display, mora pratiti istu formulu kao apply dijalog.
10. **404 vs 403** — javni endpointi vraćaju 404 za privatno/nepostojeće.
11. **Authorizacija toggle-a** — toggle se renderira samo za `isOwner()` (UX gating); backend i dalje enforce-a owner-only (sigurnost).

---

## 6. Verifikacija (manualni smoke test)
1. **Build/serve:** `ng serve` — bez compile grešaka; `/explore/community` se lazy-loada.
2. **Objava:** otvori svoj trip → owner vidi visibility toggle → "Make public" → success toast; `visibility` se ažurira bez refetcha.
3. **Popis:** `/explore` → tab "Zajednica" → grid javnih tripova; pretraga sužava (server-side, debounce); klik na stranicu 2 zamijeni grid (Network: `GET /trips/public?page=1`) i scrolla na vrh; paginator skriven kad je ≤1 stranica.
4. **Privatnost:** drugi (ne-član) korisnik vidi tuđi javni trip; preview NE sadrži emailove/članove/budžet; PRIVATE trip drugog korisnika → 404.
5. **Clone flow:** kartica → preview (itinerar + owner + member count) → "Clone to my trips" → dijalog gdje **korisnik bira početni datum** (bez budget polja) → submit → success toast, dijalozi se zatvore, **novi PRIVATE trip u `/my-trips`** s datumima koje je korisnik odabrao, **budžet prazan** (originalni datumi/članovi/budžet se NE kopiraju).
6. **Rubno:** objavljeni trip se odjavi → clone vrati 404 → poruka; prazan popis → empty state; ugašen API → error + retry.
7. **i18n:** EN/HR svi novi ključevi prevedeni u oba filea; Community teaser nestao, Destinacije teaser ostao.
8. **Responsive:** mobitel (1 kolona) / desktop (2 kolone); tab bar, body scroll lock + Escape u dijalozima rade.
