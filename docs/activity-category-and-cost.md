# Spec: Kategorija + cijena na stavkama (`Activity`) + ukupni trošak

**Status:** čeka pregled (prije implementacije)
**Scope:** backend (`planner-backend`) + frontend (`planner-frontend`)
**Feature:** svaka stavka (`Activity`) dobiva opcionalnu **kategoriju** (znamenitost / prijevoz / smještaj / restoran / ostalo) i **cijenu**; header tripa prikazuje **ukupno potrošeno** uz **budget-vs-spent** indikator.

---

## 1. Kontekst i motivacija

Gap #1 iz procjene opisa diplomske teme. Trenutno je `Activity` generička (name, opis, lokacija,
vrijeme) — nema tipa stavke ni cijene, a `budget` postoji samo informativno na razini tripa bez
ičega s čime bi se usporedio. Ova promjena dodaje:

- **`category`** na stavku → pokriva "vrste informacija: znamenitosti / prijevoz / smještaj / restorani"
- **`cost`** na stavku → cijena po stavci
- **ukupni trošak** (zbroj cijena svih stavki) uz **budget vs spent** indikator u headeru tripa

Jedna promjena pokriva tri rečenice opisa odjednom, uz najmanje posla, slijedeći postojeće obrasce.

## 2. Zaključene odluke (iz konzultacije)

| Odluka | Izbor | Zašto |
|--------|-------|-------|
| Model kategorije | **Fiksni enum**: `ATTRACTION / TRANSPORT / ACCOMMODATION / RESTAURANT / OTHER` | Type-safe, lako ikone + prijevodi, točno opseg #1 |
| `category` / `cost` | **Opcionalni** (nullable) | Postojeće aktivnosti nemaju ni jedno; ne košta svaka stavka, ne pripada svaka kategoriji |
| Valuta | **Jedna, implicitna** — `cost` se prikazuje isto kao `budget` (`number:'1.0-2'`) | Konzistentno s postojećim prikazom budžeta; bez scope creepa |
| Zbrajanje troška | **Frontend computed** | Trip detalj već učita sve dane + aktivnosti; nema potrebe za novim backend agregatom |
| Pregled troška | **Samo ukupno + budget vs spent** u headeru | Najmanje UI-a; razrada po kategoriji/danu izvan opsega |

## 3. Konvencije koje slijedimo
- Backend: postojeći slojevi (entity → DTO → mapper → service → response), Lombok `@Builder`, Flyway migracija — `spring.jpa.hibernate.ddl-auto=validate`, pa se **bez migracije app ne pokreće**.
- Frontend: standalone + signali (`input()`, `computed()`, `signal()`, `inject()`), Tailwind/M3 tokeni, ngx-translate (en **i** hr).
- **Ne diramo `FormFieldComponent`** — za `cost` ga reusamo s `type="number"` (template već veže `[type]`); za `category` (`<select>`) radimo lokalni markup u dijalogu.

---

## 4. Backend (`planner-backend`)

### 4.1 Novi enum `ActivityCategory`
`model/Enums/ActivityCategory.java` — `ATTRACTION, TRANSPORT, ACCOMMODATION, RESTAURANT, OTHER`.

### 4.2 `model/Activity.java`
Dodati dva polja (uzor: `Trip.budget` za novac, `Trip.interests` za `@Enumerated(STRING)`):
```java
@Enumerated(EnumType.STRING)
@Column(name = "category")           // nullable
private ActivityCategory category;

@Column(precision = 8, scale = 2)    // nullable, mirror Trip.budget
private BigDecimal cost;
```

### 4.3 DTO-ovi
`DTO/CreateActivityDTO.java` i `DTO/UpdateActivityDTO.java` — dodati:
```java
private ActivityCategory category;                       // opcionalno
@DecimalMin(value = "0.00", message = "Cost must be >= 0")
@Digits(integer = 6, fraction = 2, message = "Cost format invalid")  // 6+2 = precision 8
private BigDecimal cost;
```

### 4.4 `responses/ActivityResponse.java`
Dodati `private ActivityCategory category;` i `private BigDecimal cost;`.

### 4.5 `mapper/ActivityMapper.java`
- `toEntity`: `.category(dto.getCategory()).cost(dto.getCost())`
- `updateEntity`: `if (dto.getCategory() != null) activity.setCategory(...)`, `if (dto.getCost() != null) activity.setCost(...)`
- `toResponse`: `.category(activity.getCategory()).cost(activity.getCost())`

### 4.6 `event/ChangeDetector.java` → `detectActivityChanges`
Da promjene kategorije/cijene uđu u activity feed (uzor postoji u istoj klasi):
```java
compare(changes, "category", activity.getCategory(), dto.getCategory());   // enum: radi preko equals/toString
compareBigDecimal(changes, "cost", activity.getCost(), dto.getCost());     // već postoji za budget
```
> `ActivityService` se **ne mijenja** — već poziva `detectActivityChanges` + mapper.

### 4.7 Flyway migracija `V4__add_activity_category_and_cost.sql`
```sql
ALTER TABLE public.activities ADD COLUMN category VARCHAR(32);
ALTER TABLE public.activities ADD COLUMN cost NUMERIC(8,2);

ALTER TABLE public.activities ADD CONSTRAINT activities_category_check
    CHECK (category IS NULL OR category IN
        ('ATTRACTION','TRANSPORT','ACCOMMODATION','RESTAURANT','OTHER'));
```
(CHECK constraint za enum slijedi obrazac iz `V3` za `trip_events`.)

---

## 5. Frontend (`planner-frontend`)

### 5.1 `core/models/trip.model.ts`
- Novi tip: `export type ActivityCategory = "ATTRACTION" | "TRANSPORT" | "ACCOMMODATION" | "RESTAURANT" | "OTHER";`
- Dodati `category: ActivityCategory | null;` i `cost: number | null;` u: `ActivityResponse`, `TripActivityResponse`.
- Dodati `category?: ActivityCategory;` i `cost?: number;` u: `CreateTripActivityRequest`, `UpdateTripActivityRequest`.

### 5.2 `add-activity-dialog.component.ts` + `.html`
- Form: dodati `category: [""]` i `cost: [null as number | null, [Validators.min(0)]]`.
- `onSubmit`: nakon postojećih polja —
  ```ts
  if (v.category) request.category = v.category as ActivityCategory;
  if (v.cost != null && (v.cost as any) !== "") request.cost = Number(v.cost);
  ```
- `.html`: dodati **lokalni `<select>`** (label + ikona `category`, stil kao `app-form-field` input) s `@for` preko `categories` i opcijama `TRIPS.CATEGORIES.*` (+ prazna `NONE`); te `app-form-field type="number" icon="payments" controlName="cost"` s error ključem `min`.
- Komponenta drži `readonly categories: ActivityCategory[] = ['ATTRACTION','TRANSPORT','ACCOMMODATION','RESTAURANT','OTHER'];`

### 5.3 `edit-activity-dialog.component.ts` + `.html`
- Isto kao add: dodati `category`/`cost` u form i request.
- `open(...)`: prefill `category: activity.category ?? ""`, `cost: activity.cost ?? null`.
- `.html`: isti dodaci kao u add dijalogu.

### 5.4 `trip-day-card.component.html` (prikaz na stavci)
U bloku stavke (uz `location`/`description`), dodati:
- **badge kategorije** (chip kao interesi: `TRIPS.CATEGORIES.{category}`, mala ikona po kategoriji) — samo `@if (activity.category)`.
- **cijenu** (`activity.cost | number:'1.0-2'`, ikona `payments`) — samo `@if (activity.cost != null)`.

### 5.5 `trip-detail-header.component.ts` + `.html` (ukupni trošak)
`.ts` (već ima `DecimalPipe`, `trip` je `TripDetailResponse` s `days[]`):
```ts
readonly totalSpent = computed(() =>
  this.trip().days.reduce((sum, d) =>
    sum + d.activities.reduce((s, a) => s + (a.cost ?? 0), 0), 0));
readonly hasSpent = computed(() => this.totalSpent() > 0);
readonly overBudget = computed(() => {
  const b = this.trip().budget;
  return b != null && this.totalSpent() > b;
});
```
`.html` (uz postojeći Budget chip, ~linija 116-122): dodati "Spent" chip `@if (hasSpent())` s `totalSpent() | number:'1.0-2'`, te kad je `overBudget()` obojati u `text-error` + ikona `warning` (ključ `TRIPS.DETAIL.OVER_BUDGET`).

### 5.6 i18n — `public/assets/i18n/en.json` + `hr.json`
- Novi namespace `TRIPS.CATEGORIES`: `NONE`, `ATTRACTION`, `TRANSPORT`, `ACCOMMODATION`, `RESTAURANT`, `OTHER` (en + hr).
- `TRIPS.DETAIL.ACTIVITIES.ADD`: `CATEGORY_LABEL`, `COST_LABEL`, `COST_PLACEHOLDER`, `COST_MIN`. (EDIT dijalog reusa ADD ključeve, kao i sad.)
- `TRIPS.DETAIL`: `SPENT_LABEL`, `OVER_BUDGET`.

> `trip.service.ts` (`addActivityToDay`/`updateActivityInDay`) se **ne mijenja** — prosljeđuje request body, nova polja teku automatski.

## 6. Reuse vs novo

| Reuse (ne diramo) | Novo / mijenjamo |
|-------------------|------------------|
| `FormFieldComponent` (za `cost` preko `type="number"`) | `ActivityCategory` enum (BE) + tip (FE) |
| `ChangeDetector.compareBigDecimal` (za `cost`) | `V4` Flyway migracija |
| `ActivityService` (poziva mapper + detector) | polja u entity/DTO/response/mapper/model |
| `trip.service.ts` activity metode | lokalni `<select>` za kategoriju u oba dijaloga |
| Stil `app-form-field` inputa (kopiramo za select) | `totalSpent`/`overBudget` u headeru + i18n |

## 7. Rubni slučajevi i rizici
- **Postojeće aktivnosti** → `category=null`, `cost=null`: badge i cijena se ne prikazuju, ne broje se u zbroj.
- **`ddl-auto=validate`**: migracija mora proći prije starta — inače Hibernate validacija padne.
- **Decimalni unos**: backend `@Digits(integer=6, fraction=2)` + frontend `Validators.min(0)`; preveliki/negativni iznos → 400 s field error (već mapirano u `applyError`).
- **Brisanje vrijednosti (prihvaćeno ograničenje):** `compare`/`updateEntity` ignoriraju `null`, pa se kategorija/cijena ne mogu *obrisati* natrag u prazno nakon postavljanja — isto vrijedi za sva ostala polja (npr. description). Izvan opsega.

## 8. Verifikacija (ručno, end-to-end)
1. Backend: `./gradlew bootRun` — app se diže (migracija V4 prošla).
2. Frontend: `npm start`, login, otvori trip.
3. Dodaj aktivnost s kategorijom + cijenom → badge i cijena vidljivi na kartici dana.
4. Dodaj još par stavki s cijenama → "Spent" u headeru = točan zbroj; uz postavljen `budget` provjeri da `overBudget` upali `text-error` kad zbroj prijeđe budžet.
5. Uredi aktivnost (promijeni kategoriju/cijenu) → promjena se odrazi; activity feed prikaže promjenu (`category`/`cost` u diffu).
6. Stara aktivnost bez kategorije/cijene → bez badgea/cijene, ne kvari zbroj.
7. Prebaci EN/HR → svi novi tekstovi prevedeni.
8. `npm run build` + backend build prolaze.

## 9. Dodirnute datoteke (sažetak)

**Backend novo:**
- `model/Enums/ActivityCategory.java`
- `db/migration/V4__add_activity_category_and_cost.sql`

**Backend mijenjamo:**
- `model/Activity.java`
- `DTO/CreateActivityDTO.java`, `DTO/UpdateActivityDTO.java`
- `responses/ActivityResponse.java`
- `mapper/ActivityMapper.java`
- `event/ChangeDetector.java`

**Frontend mijenjamo:**
- `core/models/trip.model.ts`
- `features/trips/trip-detail/add-activity-dialog.component.{ts,html}`
- `features/trips/trip-detail/edit-activity-dialog.component.{ts,html}`
- `features/trips/trip-detail/trip-day-card.component.html`
- `features/trips/trip-detail/trip-detail-header.component.{ts,html}`
- `public/assets/i18n/en.json`, `public/assets/i18n/hr.json`
