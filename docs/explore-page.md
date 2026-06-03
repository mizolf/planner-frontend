# Explore — Discovery Hub stranica

## 1. Kontekst i cilj

U navbaru već postoji `/explore` link (`NAV.EXPLORE`), ali ruta nije spojena — klik trenutno
završava na `**` → `/not-found`. Cilj je napraviti zasebnu `/explore` stranicu kao
**discovery hub** koji okuplja tri vrste otkrivanja:

1. **Kurirani predlošci putovanja (trip templates/styles)** — *već postoji* (`ExploreService`
   + `features/explore/` komponente), trenutno samo ugrađeno na home (`ExploreSectionComponent`).
2. **Javna putovanja zajednice** — *ne postoji*; traži backend (`visibility` + javni endpointi). Vizija.
3. **Otkrivanje destinacija** — *ne postoji*; traži vanjske podatke (places/maps). Vizija.

**Dogovoreni pristup:** Hub (sve zajedno), izveden kao **MVP sad + vizija kasnije**. MVP gradi
zasebnu stranicu koja iskorištava postojeću template značajku i *nagovještava* hub; ambiciozni
dijelovi su jasno odvojene buduće faze.

## 2. Ključno ograničenje podataka (pročitati prije svega)

`GET /explore/styles` (`explore.service.ts:52`) vraća **samo** listu stilova
(`name`, `description`, `imageUrl`, `templateCount`) — **bez** template metapodataka.
Template detalji (`destination`, `durationDays`, `recommendedSeason`, `estimatedBudget`,
`interests`) stižu tek kad se otvori pojedini stil preko `loadStyle(slug)` (`explore.service.ts:64`,
kešira se u `styleCache`).

**Posljedica:**
- Pretraga/filtriranje **po stilovima** = besplatno (podaci su odmah tu).
- Filtriranje **po templateima** (interes/sezona/budžet/trajanje) = N HTTP zahtjeva (jedan
  `loadStyle` po stilu), jer ne postoji agregatni `/explore/templates` endpoint.

Zato je MVP podijeljen na **jezgru (Faza 1)** i **opcionalni bogatiji sloj (Faza 1b)**.

## 3. Postojeće što reuse-amo (bez promjena)

| Komad | Lokacija | Uloga |
|---|---|---|
| `ExploreService` | `core/services/explore.service.ts` | signali `styles/stylesLoading/stylesError`; `loadStyles()`, `loadStyle()`, `loadTemplate()`, `applyTemplate()` (zove `tripService.addTrip`, `:131`) |
| `StyleCardComponent` | `features/explore/style-card/` | `input.required<TripStyleResponse>` + `output cardClick` |
| `StylePreviewDialogComponent` | `features/explore/style-preview-dialog/` | lista templatea u stilu; `open(slug)` |
| `TemplatePreviewDialogComponent` | `features/explore/template-preview-dialog/` | itinerar templatea; `open(styleSlug, templateSlug)` |
| `ApplyTemplateDialogComponent` | `features/explore/apply-template-dialog/` | kreira trip iz templatea |
| Orchestracija dialoga | `explore-section.component.ts:50-71` | `onStyleClick/onTemplateSelected/onApplyClicked/onTripCreated` — kopira se doslovno |
| `ToastService` | `shared/services/toast.service.ts` | success/error feedback |
| Obrasci stanja | `my-trips-page.component.html` | loading skeleton, error+retry, empty state, tab bar (`border-b-2`) |
| i18n ključevi | `EXPLORE.SEASON.*`, `EXPLORE.DAYS`, `EXPLORE.TEMPLATE_COUNT`, `EXPLORE.RETRY`, `EXPLORE.APPLY.*`, `EXPLORE.ERROR_LOADING_STYLES`, `TRIPS.INTERESTS.*`, `NAV.EXPLORE` | postoje |

Relevantni modeli (`core/models/explore.model.ts`): `TripStyleResponse`,
`TripTemplateSummaryResponse`, `TripTemplateDetailResponse`, `Season`
(`SPRING|SUMMER|AUTUMN|WINTER|YEAR_ROUND`). `Interest` (8): `CULTURE, FOOD, ADVENTURE,
NATURE, NIGHTLIFE, SHOPPING, RELAXATION, HISTORY` (`core/models/trip.model.ts`).

---

## 4. MVP — Faza 1 (jezgra, bez backend promjena)

Zasebna `ExplorePageComponent` na `/explore` koja postojeću template značajku pretvara u
punu hub stranicu.

### 4.1 Datoteke

**Kreirati**
- `src/app/features/explore/explore-page/explore-page.component.ts`
- `src/app/features/explore/explore-page/explore-page.component.html`

**Izmijeniti**
- `src/app/app.routes.ts` — lazy ruta kao child `DashboardLayoutComponent`-a, iza `my-trips` (`:11`):
  ```ts
  {
    path: 'explore',
    loadComponent: () =>
      import('./features/explore/explore-page/explore-page.component')
        .then(m => m.ExplorePageComponent),
  },
  ```
- `public/assets/i18n/en.json` + `public/assets/i18n/hr.json` — proširiti `EXPLORE` blok (vidi 4.4).
- `src/app/home-page/home-page.component.html` *(opcionalno, preporučeno)* — "Pogledaj sve →" link
  uz `app-explore-section` koji vodi na `/explore`. **Zadržati** ugrađenu sekciju (kompaktni rail
  na dashboardu); dijele isti singleton `ExploreService` → nema dvostrukog učitavanja.

`NAV.EXPLORE` i navbar link već postoje — navbar se ne dira.

### 4.2 `ExplorePageComponent` — ugovor

Slijedi obrazac `MyTripsPageComponent` (signali + `computed`, stanja), a dialog orchestraciju
**kopira doslovno** iz `ExploreSectionComponent` (`:50-71`).

- **Imports:** `TranslateModule`, `StyleCardComponent`, `StylePreviewDialogComponent`,
  `TemplatePreviewDialogComponent`, `ApplyTemplateDialogComponent`.
- **Inject:** `ExploreService`, `ToastService`.
- **ViewChild:** `styleDialog`, `templateDialog`, `applyDialog`.
- **Signali:** `searchTerm = signal('')`; iz servisa `styles / stylesLoading / stylesError`.
- **Computed:** `filteredStyles` — `styles()` filtrirano po `searchTerm` (case-insensitive nad
  `name` + `description`).
- **Metode (kopirane):** `retry()`, `onStyleClick()`, `onTemplateSelected()`, `onApplyClicked()`,
  `onTripCreated()`.
- **`ngOnInit`:** `if (this.styles().length === 0) this.exploreService.loadStyles();`
  (isti guard kao `:41` — preskače refetch ako je home već učitao).

### 4.3 `explore-page.component.html` — sekcije

Kontejner: `<div class="px-6 lg:px-10 py-8 max-w-7xl mx-auto">`.

1. **Hero/intro header** — `EXPLORE.PAGE.TITLE` + `EXPLORE.PAGE.SUBTITLE`, ikona `explore`.
2. **Search bar** — input vezan na `searchTerm` (`(input)`), leading `search` ikona,
   placeholder `EXPLORE.SEARCH_PLACEHOLDER`.
3. **"Browse by style" grid** — reuse loading/error/empty blokova iz
   `explore-section.component.html`, ali u **gridu**
   (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5`) umjesto horizontalnog
   scrolla. Item: `<app-style-card [style]="s" (cardClick)="onStyleClick($event)" />`.
   Empty-search state kad `filteredStyles().length === 0` ali `styles().length > 0`.
4. **Hub teaseri** — dvije "Uskoro" kartice (**Zajednica**, **Destinacije**): ikona + naslov +
   opis + `disabled` badge. Prenose hub viziju bez backenda. Ključevi `EXPLORE.COMING_SOON.*`.
5. **Dialog hostovi (kopirati iz `explore-section.component.html`):**
   ```html
   <app-style-preview-dialog (templateSelected)="onTemplateSelected($event)" />
   <app-template-preview-dialog (applyClicked)="onApplyClicked($event)" />
   <app-apply-template-dialog (tripCreated)="onTripCreated($event)" />
   ```
   Reuse-a **cijeli** flow style-preview → template-preview → apply, bez promjene u dialozima.

**Stanja:** loading = `animate-pulse` skeleton grid; error = `cloud_off` + `EXPLORE.ERROR_LOADING_STYLES`
+ retry; empty = icon-circle + naslov + opis (obrasci iz `my-trips-page.component.html`).

### 4.4 i18n (proširiti `EXPLORE` blok, u oba filea)

```
EXPLORE.PAGE.TITLE / SUBTITLE
EXPLORE.SEARCH_PLACEHOLDER
EXPLORE.RESULTS.STYLES_EMPTY_SEARCH
EXPLORE.COMING_SOON.COMMUNITY_TITLE / COMMUNITY_DESC
EXPLORE.COMING_SOON.DESTINATIONS_TITLE / DESTINATIONS_DESC
EXPLORE.COMING_SOON.BADGE
```

---

## 5. MVP — Faza 1b (opcionalno: bogatiji filteri po templateima)

Dodaje pravo filtriranje po interesu/sezoni/trajanju/budžetu nad agregiranim templateima.
**Cijena: N HTTP zahtjeva.** Uključiti samo ako želiš bogatije filtere odmah; inače odgoditi.

- **Tab bar** (`STYLES` | `TEMPLATES`) — `activeTab` signal, obrazac `border-b-2` iz MyTrips.
- **Filter chipovi** — **NE** koristiti `InterestChipsComponent` (veže se uz `FormGroupDirective`,
  `interest-chips.component.ts:16,44`). Umjesto toga lagani lokalni toggle chipovi vođeni
  `signal<Set<Interest>>` / `signal<Set<Season>>` uz iste `'TRIPS.INTERESTS.' + interest` ključeve
  i iste Tailwind klase (`bg-primary text-on-primary` za aktivno). Plus `maxDuration` / `maxBudget`
  select.
- **Servis (`explore.service.ts`, aditivno — postojeće se ne mijenja):** `_allTemplates` signal +
  `loadAllTemplates()` koji `forkJoin`-a `loadStyle` po svim stilovima (reuse `styleCache`),
  spljošti `detail.templates` i svakom doda `styleSlug` (treba za otvaranje template-preview
  dialoga). Per-style `catchError(() => of(null))` da jedan loš stil ne sruši grid; guard da se
  izvrši jednom; lazy (tek na prvi ulazak u `TEMPLATES`).
- **Nova komponenta** `features/explore/template-card/` (`input.required<TripTemplateSummaryResponse>`
  + `output` click), markup po uzoru na `style-card.component.html`.
- **Computed `filteredTemplates`** — `searchTerm` (name/destination) + odabrani interesi (ANY) +
  sezone + `maxDuration` + `maxBudget`, sve client-side.

---

## 6. Buduće faze (vizija — NIJE u MVP-u)

### Faza 2A — Javna putovanja (zajednica)
- **Backend:** `visibility` (PRIVATE/PUBLIC) na tripu; `GET /trips/public` (paginirano + filteri);
  `POST /trips/{id}/clone`.
- **Frontend:** `PublicTripsService` (signali + `PageResponse<T>`, već postoji u `activity.model.ts`);
  `PublicTripCardComponent` (cover slika, vlasnik, broj članova, interes pillovi); "Community" tab;
  "Clone to my trips" preko `TripService.addTrip` (isti sink koji `applyTemplate` koristi); infinite
  scroll preko `PageResponse`.

### Faza 2B — Otkrivanje destinacija
- **Backend/eksterno:** places/maps provider (POI, fotke, znamenitosti); proxy `/explore/destinations`
  da API ključ ostane na serveru.
- **Frontend:** `DestinationCardComponent`, "Destinations" tab, things-to-do liste, opcionalno map
  view. Najveća cijena/neizvjesnost — zadnje.

### Faza 2C — Cross-cutting meni ideja (prijedlozi)
Globalna pretraga preko svih izvora · favoriti/spremljeno (treba `favorites` tablica + servis) ·
trending/popularno (reuse activity-feed) · nedavno dodano · sort kontrole · pregled po
tagovima/kategorijama · map view · shareable deep linkovi (`/explore/styles/:slug` — servis već
podržava per-slug učitavanje).

---

## 7. Sažetak: kreirati vs izmijeniti

- **Kreirati (Faza 1):** `explore-page.component.ts`, `explore-page.component.html`.
- **Izmijeniti (Faza 1):** `app.routes.ts`, `en.json`, `hr.json`, (opc.) `home-page.component.html`.
- **Dodatno (Faza 1b):** `template-card.component.{ts,html}` (kreirati) + `explore.service.ts` (aditivno).
- **Reuse bez promjena:** sva tri dialoga, `StyleCardComponent`, `ToastService`, season/interest/apply
  i18n, navbar link.

## 8. Verifikacija (manualni smoke test MVP-a)

1. **Build/serve:** `ng serve` — nema compile grešaka, ruta se lazy-loada.
2. **Navigacija:** klik "Explore" (desktop + mobilni drawer) → `/explore` iza `authGuard`
   (odjavljen → redirect na auth).
3. **Styles + search:** grid se prikaže; search sužava `filteredStyles`; brisanje vraća listu;
   pretraga bez rezultata → empty state.
4. **Apply flow (jezgra reuse-a):** style card → style-preview → template → template-preview →
   "Apply" → apply dialog → submit s datumom → success toast `EXPLORE.APPLY.SUCCESS`, dialozi se
   zatvore, **novi trip u `/my-trips`** (jer `applyTemplate` zove `tripService.addTrip`).
5. **Stanja:** throttle → skeleton; ugasi API → error + retry; "Uskoro" teaseri vidljivi.
6. **i18n:** EN/HR → svi novi `EXPLORE.*` ključevi prevedeni u oba filea, bez sirovih ključeva.
7. **Responsive:** mobitel (1 kolona, drawer), tablet, desktop; body scroll lock + Escape u
   dialozima rade.
8. **(Faza 1b)** TEMPLATES tab → fan-out jednom (Network: jedan `GET /explore/styles/{slug}` po
   stilu, keš reuse) → filteri klijentski sužavaju → klik na karticu otvara ispravan
   template-preview.
