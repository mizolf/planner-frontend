# Spec: Zasebna "My Trips" stranica s tabovima

**Status:** odobreno za implementaciju
**Scope:** samo frontend (`/Users/mcesnik/dev/diplomski/planner-frontend`) — bez backend izmjena
**Feature:** nova `/my-trips` ruta koja prikazuje puni popis korisnikovih tripova, organiziran u tabove **Sve / Nadolazeći / U tijeku / Završeni**. Home (`/home`) se stanji na kratki preview + "Prikaži sve" link.

---

## 1. Kontekst i motivacija

Trenutno "My Trips" **ne postoji** kao zasebna stranica. U `app.routes.ts` sve tri navbar poveznice — Dashboard, My Trips, Explore — vode na `/home`. Posljedice:

- **Završeni tripovi su nevidljivi.** `HomePageComponent.sortedTrips` (`home-page.component.ts:43-49`) ima `.filter(t => t.status !== 'COMPLETED')`. Kad trip pređe u `COMPLETED`, nestaje s jedinog popisa i korisnik ga nigdje ne može vidjeti. Trip planner bez "prošlih putovanja" je funkcionalno nepotpun.
- **Nema namjenske stranice za upravljanje popisom.** Popis živi na dashboardu, paginiran na 4 kartice (`displayedTrips`), pomiješan sa statistikama, explore sekcijom i activity feedom.

Cilj: napraviti pravu stranicu za pregled svih tripova po fazi, čime se rješava i nevidljivost završenih tripova i nedostatak namjenske rute.

## 2. Zaključene odluke (iz konzultacije)

| Odluka | Izbor | Zašto |
|--------|-------|-------|
| Odnos home ↔ My Trips | **My Trips preuzima puni popis**; home prikazuje samo preview + link | Jasna podjela uloga: home = dashboard/pregled, My Trips = upravljanje popisom. Manje duplikacije. |
| Tabovi | **Sve / Nadolazeći / U tijeku / Završeni** (4 taba) | "Sve" daje jedinstveni pregled; tri statusna taba filtriraju po fazi i čine završene tripove vidljivima. |
| Kartica tripa | Reuse postojeće `TripCardComponent` bez izmjena | Već renderira sve potrebno (status badge, days-to-go, datumi) i navigira u detalj. |
| Search / filter / sort kontrole | **Dodano naknadno** (vidi §14) | Tabovi su bili dovoljni za prvu iteraciju; kontrole su dodane kasnije za pročišćavanje unutar odabranog taba. |
| Quick akcije (edit/delete/leave) na kartici | **Izvan opsega** | Te akcije već postoje u detalju tripa. |
| Deep-link taba (`?tab=`) | **Izvan opsega** | Zasad samo lokalni signal, default `ALL`. |

## 3. Arhitektura i struktura komponenti

```
DashboardLayoutComponent (dohvaća user, renderira navbar + router-outlet)
├── NavbarComponent              (My Trips link → /my-trips)
├── HomePageComponent (/home)    (stanjen: stats + preview 3 + "Prikaži sve" link)
└── MyTripsPageComponent (/my-trips)   ← NOVA
        ├── Header (naslov + Create gumb)
        ├── Tab traka (Sve / Nadolazeći / U tijeku / Završeni, s brojačima)
        ├── Loading state  (skeleton)
        ├── Error state    (poruka + retry)
        ├── Empty state     (puni — nema tripova uopće | per-tab — tab prazan)
        ├── Grid kartica   (app-trip-card)
        └── app-create-trip-dialog
```

Oba ekrana (home i My Trips) čitaju iste signale iz `TripService` (`trips`, `loading`, `error`) i pozivaju `loadTrips()` u `ngOnInit`. `TripService` već radi optimistični update pri `createTrip`, pa se novi trip odmah pojavi na oba mjesta.

## 4. Konvencije koje slijedimo

- Standalone komponente, moderni signal API: `inject()`, `signal()`, `computed()`, `input()`. (Bez `@Input`/`@Output`/`EventEmitter`/constructor DI.)
- Tailwind tokeni iz Material 3 teme (`primary`, `secondary`, `tertiary`, `surface-container-*`, `on-surface-variant`).
- ngx-translate ključevi; svaki novi tekst u `en.json` **i** `hr.json`.
- Nove tekstove u **lokalnoj** duplikaciji markup obrazaca (loading/error/empty) umjesto diranja radnih shared komponenti.

## 5. Nova komponenta `MyTripsPageComponent`

**Datoteke:** `src/app/features/trips/my-trips/my-trips-page.component.ts` + `.html`
(lokacija prati `features/trips/trip-detail/trip-detail-page.component.ts`)

### TS

```typescript
type MyTripsTab = 'ALL' | 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED';

@Component({
  selector: 'app-my-trips-page',
  standalone: true,
  imports: [TranslateModule, TripCardComponent, CreateTripDialogComponent],
  templateUrl: './my-trips-page.component.html',
})
export class MyTripsPageComponent implements OnInit {
  @ViewChild(CreateTripDialogComponent) dialog!: CreateTripDialogComponent;

  private tripService = inject(TripService);

  readonly trips = this.tripService.trips;
  readonly tripsLoading = this.tripService.loading;
  readonly tripsError = this.tripService.error;

  readonly activeTab = signal<MyTripsTab>('ALL');

  // brojači za labele tabova
  readonly totalTrips = computed(() => this.trips().length);
  readonly upcomingCount = computed(() => this.countBy('UPCOMING'));
  readonly inProgressCount = computed(() => this.countBy('IN_PROGRESS'));
  readonly completedCount = computed(() => this.countBy('COMPLETED'));

  // popis za prikaz, ovisno o aktivnom tabu + sortiran
  readonly filteredTrips = computed(() => { /* vidi logiku sortiranja niže */ });

  readonly hasTrips = computed(() => this.trips().length > 0);

  ngOnInit(): void { this.tripService.loadTrips(); }

  setTab(tab: MyTripsTab): void { this.activeTab.set(tab); }
  openCreateTripDialog(): void { this.dialog.open(); }
  retryLoadTrips(): void { this.tripService.loadTrips(); }
}
```

### Logika sortiranja (`filteredTrips`)

| Tab | Filter | Sort |
|-----|--------|------|
| `ALL` | svi | `IN_PROGRESS` → `UPCOMING` → `COMPLETED`; unutar grupe po `startDate` uzlazno |
| `UPCOMING` | `status === 'UPCOMING'` | `startDate` uzlazno (najskoriji prvi) |
| `IN_PROGRESS` | `status === 'IN_PROGRESS'` | `startDate` uzlazno |
| `COMPLETED` | `status === 'COMPLETED'` | `endDate` **silazno** (najnoviji završeni prvi) |

`ALL` koristi isti `statusOrder` mehanizam kao postojeći `home-page.component.ts:38-49`, ali **bez** filtriranja `COMPLETED` van.

### Template (`.html`)

- **Header:** naslov `MY_TRIPS.TITLE`, podnaslov `MY_TRIPS.SUBTITLE`, Create gumb (reuse stil iz `home-page.component.html:13-18`, ključ `HOME.CREATE_NEW_TRIP`).
- **Tab traka:** 4 gumba; svaki pokazuje labelu (`MY_TRIPS.TABS.*`) + brojač. Aktivni tab istaknut (`text-primary` + donji `border-primary`); neaktivni `text-on-surface-variant`. `(click)="setTab(...)"`.
- **Loading:** skeleton grid (reuse obrazac `home-page.component.html:22-35`).
- **Error:** `cloud_off` ikona + `tripsError()! | translate` + retry gumb (`HOME.RETRY`).
- **Empty:**
  - `!hasTrips()` (0 tripova ukupno) → puni empty state s CTA (reuse `HOME.EMPTY.TITLE/DESCRIPTION/CTA`).
  - `hasTrips()` ali `filteredTrips()` prazan → laganiji per-tab tekst (`MY_TRIPS.EMPTY_UPCOMING` / `EMPTY_IN_PROGRESS` / `EMPTY_COMPLETED`). (Tab "Sve" ne može biti prazan ako ima tripova.)
- **Grid:** `grid grid-cols-1 lg:grid-cols-2 gap-5`; `@for (trip of filteredTrips(); track trip.id)` → `<app-trip-card [trip]="trip" />`.
- **Dijalog:** `<app-create-trip-dialog />` na dnu.

## 6. Izmjena home stranice

**Datoteke:** `src/app/home-page/home-page.component.ts` + `.html`

- **Ukloniti** paginaciju: `showAllTrips` signal, `toggleShowAll()`, `hasMoreTrips`, `displayedTrips`.
- **Dodati** `previewTrips = computed(() => this.sortedTrips().slice(0, 3))`.
- **`.html`:** u sekciji "Upcoming Trips":
  - `@for` ide preko `previewTrips()` umjesto `displayedTrips()`.
  - "View All / Show Less" toggle gumb → zamijeniti običnim linkom `routerLink="/my-trips"` s tekstom `HOME.VIEW_ALL`, vidljivim uvijek kad `hasTrips()`.
- **Dodati** `RouterLink` u `imports` `HomePageComponent`-a.
- **Ostaje nepromijenjeno:** stats kartice, explore sekcija, activity feed sidebar, mobile CTA, loading/error/empty stanja.

`sortedTrips` na home-u i dalje filtrira `COMPLETED` van — to je OK jer home prikazuje samo aktivne tripove kao preview; završeni su sad dostupni na My Trips.

## 7. Routing

**Datoteka:** `src/app/app.routes.ts` (child rute pod `DashboardLayoutComponent`)

```typescript
{ path: 'my-trips', loadComponent: () =>
    import('./features/trips/my-trips/my-trips-page.component')
      .then(m => m.MyTripsPageComponent) },
{ path: 'trips', redirectTo: 'my-trips' },        // bilo: 'home'
{ path: 'trips/new', redirectTo: 'my-trips' },    // bilo: 'home'
```

`trips/:id` (detalj) i ostale rute ostaju netaknute. Sve su i dalje zaštićene `authGuard`-om.

## 8. Navbar

**Datoteka:** `src/app/shared/components/navbar/navbar.component.html`

- Desktop "My Trips" link (≈ linija 21): `routerLink="/home"` → `routerLink="/my-trips"`; dodati `routerLinkActive="bg-primary/10 text-primary"`.
- Mobile drawer "My Trips" link (≈ linija 131): isto.
- "Dashboard" ostaje `/home`. "Explore" ostaje `/home` (explore sekcija fizički živi na home-u) — izvan opsega.

## 9. i18n

**Datoteke:** `public/assets/i18n/en.json` + `public/assets/i18n/hr.json`

Novi `MY_TRIPS` namespace (umetnut nakon `HOME` bloka):

| Ključ | EN | HR |
|-------|----|----|
| `MY_TRIPS.TITLE` | My Trips | Moja putovanja |
| `MY_TRIPS.SUBTITLE` | All your trips in one place. | Sva vaša putovanja na jednom mjestu. |
| `MY_TRIPS.TABS.ALL` | All | Sva |
| `MY_TRIPS.TABS.UPCOMING` | Upcoming | Nadolazeća |
| `MY_TRIPS.TABS.IN_PROGRESS` | In Progress | U tijeku |
| `MY_TRIPS.TABS.COMPLETED` | Completed | Završena |
| `MY_TRIPS.EMPTY_UPCOMING` | No upcoming trips. | Nema nadolazećih putovanja. |
| `MY_TRIPS.EMPTY_IN_PROGRESS` | No trips in progress. | Nema putovanja u tijeku. |
| `MY_TRIPS.EMPTY_COMPLETED` | No completed trips yet. | Još nema završenih putovanja. |

**Reuse postojećih** (ne dupliciramo): `HOME.STATUS.*`, `HOME.DAYS_TO_GO`, `HOME.NO_IMAGE` (koristi `TripCardComponent`), `HOME.CREATE_NEW_TRIP`, `HOME.RETRY`, `HOME.VIEW_ALL`, `HOME.EMPTY.*`, `HOME.ERROR_LOADING_TRIPS`.

## 10. Reuse vs novo

| Reuse (ne diramo) | Novo / mijenjamo |
|-------------------|------------------|
| `TripCardComponent` | `MyTripsPageComponent` (.ts + .html) |
| `CreateTripDialogComponent` | `MY_TRIPS` i18n namespace (en + hr) |
| `TripService` (signali + `loadTrips`) | `app.routes.ts` (nova ruta + 2 redirecta) |
| `getTripStatusColor` util | `navbar.component.html` (My Trips link ×2) |
| Loading/error/empty markup obrasci (kopiramo) | `home-page` (preview + link, micanje paginacije) |

## 11. Rubni slučajevi i rizici

- **0 tripova:** My Trips pokazuje puni empty state + CTA (kao home danas). Brojači tabova svi 0.
- **Prazan pojedini tab** (npr. nema završenih): per-tab poruka, ne globalni empty.
- **Optimistični create:** novi trip se pojavi u "Nadolazeća" (i "Sva") bez reloada — `TripService` ažurira signal.
- **Status prijelaz:** kad backend trip prebaci u `COMPLETED`, nakon idućeg `loadTrips()` seli iz "Nadolazeća"/"U tijeku" u "Završena". Frontend ne radi automatsku promjenu statusa.
- **Performanse:** filtriranje/sort je nad in-memory poljem; bezopasno za očekivani broj tripova (diplomski).

## 12. Verifikacija (end-to-end, ručno)

1. `npm start`, login.
2. Navbar "My Trips" → `/my-trips`; link aktivno istaknut.
3. Tab "Sva" prikazuje **sve** tripove uključujući završene; brojači u labelama točni.
4. Svaki statusni tab filtrira ispravno; redoslijed sortiranja odgovara tablici iz §5.
5. Prazan tab → per-tab poruka. Korisnik bez ijednog tripa → puni empty state + CTA.
6. Create gumb na My Trips otvara dijalog; novi trip se odmah pojavi u "Nadolazeća"/"Sva".
7. Home: max 3 preview kartice + "Prikaži sve" → `/my-trips`; nema više "Show less" toggla.
8. `/trips` i `/trips/new` redirektaju na `/my-trips`; `/trips/:id` (klik na karticu) i dalje radi.
9. Prebaci jezik EN/HR — svi novi tekstovi prevedeni.
10. `npm run build` prolazi bez grešaka.

## 13. Dodirnute datoteke (sažetak)

**Novo:**
- `src/app/features/trips/my-trips/my-trips-page.component.ts`
- `src/app/features/trips/my-trips/my-trips-page.component.html`

**Mijenjamo:**
- `src/app/app.routes.ts` — nova ruta + 2 redirecta
- `src/app/shared/components/navbar/navbar.component.html` — My Trips link (desktop + mobile)
- `src/app/home-page/home-page.component.ts` — preview signal, micanje paginacije, `RouterLink` import
- `src/app/home-page/home-page.component.html` — preview + "Prikaži sve" link
- `public/assets/i18n/en.json` — `MY_TRIPS` namespace
- `public/assets/i18n/hr.json` — `MY_TRIPS` namespace

**Izvan opsega (moguće kasnije):** quick akcije na kartici, cover image na kartici, deep-link taba (`?tab=`).

## 14. Search / filter / sort kontrole (naknadno dodano)

Kontrolna traka **ispod tab trake**, iznad grida. Hijerarhija: tab = *faza*, kontrole = *pročišćavanje unutar te faze* (tab odabere skup → search/datum/sort rade nad njim). Na mobitelu (`< sm`) traka se slaže okomito. Sve ostaje u `MyTripsPageComponent` + i18n; bez backend izmjena.

### Odluke

| Odluka | Izbor |
|--------|-------|
| Pozicija | Kontrolna traka ispod tab trake |
| Sort opcije | Default (postojeći per-tab §5) + datum početka (najskoriji/najkasniji) + naziv (A–Ž) + nedavno dodano |
| Filter datuma | Po datumu početka: trip prolazi ako `startDate` padne unutar `[Od, Do]` (otvoreni rub ako je jedno polje prazno) |
| Search polja | `name` + `destination` (bez `description`) |
| Brojači tabova | Ostaju ukupni po fazi — ne mijenjaju se sa search/datum filterom (mijenja se samo grid) |
| Date input | Native `<input type="date">`, signal-vezan, lokalno stiliziran (ne shared `app-form-field`) |

### Signali i pipeline (`filteredTrips`)

Novi signali: `searchTerm`, `dateFrom`, `dateTo` (`'yyyy-MM-dd'`, `''` = bez granice), `sortBy: SortOption`.
`filteredTrips` je pipeline: **tab filter → search (naziv/odredište) → filter po datumu početka → sort**. Usporedba datuma na `startDate.slice(0, 10)` (robusno za puni ISO). Sort se grana po `sortBy`; `DEFAULT` poziva izdvojeni `defaultSort` (postojeća §5 logika nad već-filtriranom listom).

Pomoćne computed: `hasActiveFilters`, `currentTabCount`, `showControls` (= tab ima tripova **ili** je filter aktivan). `clearFilters()` resetira search + datume (ne sort).

### Stanja

- Filter isprazni rezultate → `MY_TRIPS.NO_RESULTS` + gumb "Očisti filtere" (`clearFilters`).
- Prazan tab bez filtera → postojeći per-tab empty; kontrole skrivene (`showControls()` false).

### i18n (`MY_TRIPS`)

Novi ključevi (en + hr): `SEARCH_PLACEHOLDER`, `DATE_FROM`, `DATE_TO`, `SORT.{LABEL,DEFAULT,START_ASC,START_DESC,NAME_ASC,RECENT}`, `NO_RESULTS`, `CLEAR_FILTERS`.

### Reuse obrazaca

- Search input → `explore-page.component.html` (signal `searchTerm`, `[value]` + `(input)`).
- Sort `<select>` → stil iz `invite-member-dialog` (ikona `sort` lijevo + `expand_more` desno, `appearance-none`).
