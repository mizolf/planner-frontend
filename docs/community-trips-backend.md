# Zajednica — Backend izmjene (Faza 2A)

> **Status:** ugovor za backend (zaseban Spring Boot servis). Frontend Faze 2A je već implementiran;
> ovo je potpun, jednoznačan popis backend izmjena izveden iz [community-trips.md](community-trips.md) §2
> i **usklađen s onim što FE stvarno gađa** (`public-trips.service.ts`, `trip.service.ts`,
> `community.model.ts`). Pokriva endpointe, DTO oblike, DB promjenu i pravila — ne Java kod.

## 0. Najvažnije — lako se previdi

**Svaki endpoint koji vraća `TripResponse` ili `TripDetailResponse` mora sad serijalizirati novo polje
`visibility`.** FE ga tretira kao **obavezno**. To uključuje *postojeće* endpointe:
`GET /trips`, `GET /trips/{id}`, `POST /trips`, `PUT /trips/{id}`,
`POST /trips/{id}/generate-itinerary`, `POST /explore/styles/.../templates/.../apply` — plus dva nova
(`clone`, `visibility`). Jedna izmjena u Trip→DTO mapperu pokriva sve, ali se MORA napraviti — inače
visibility toggle na detail stranici nema točno početno stanje.

## 1. DB migracija

```
ALTER TABLE trips
  ADD COLUMN visibility VARCHAR(10) NOT NULL DEFAULT 'PRIVATE';   -- enum: PRIVATE | PUBLIC

CREATE INDEX idx_trips_visibility_updated ON trips (visibility, updated_at DESC);
```

- Postojeći redovi → `PRIVATE` preko defaulta (siguran default — ništa se slučajno ne objavi).
- Index služi efikasnom paginiranom javnom popisu bez skeniranja privatnih.
- Nema novih tablica, nema cover-image kolone. (Migracija kroz alat koji projekt koristi — Flyway/Liquibase.)

## 2. Entitet + enum

- Novi enum `TripVisibility { PRIVATE, PUBLIC }`.
- `Trip` entitet dobiva `@Enumerated(EnumType.STRING) private TripVisibility visibility = PRIVATE;`

## 3. DTO-i + mapperi

**Izmjena postojećeg:**
- `TripResponse` dobiva polje `visibility` (+ mapper ga popunjava). ← vidi §0.

**Novi (read-only, privacy-stripped):**
```
PublicTripSummaryResponse  { id, name, destination, startDate, endDate, durationDays,
                             interests[], ownerDisplayName, memberCount }

PublicTripDetailResponse   { id, name, description, destination, latitude, longitude,
                             startDate, endDate, durationDays, interests[],
                             ownerDisplayName, memberCount, days: PublicTripDayResponse[] }

PublicTripDayResponse      { dayNumber, date, title, notes, activities: PublicTripActivityResponse[] }

PublicTripActivityResponse { name, description, location, latitude, longitude,
                             startTime, endTime, category }

CloneTripRequest (body)    { startDate: string, name?: string }
```

**Pravila javnih mappera:**
- NIKAD owner email, listu članova ni per-član podatke → samo `memberCount` + `ownerDisplayName`.
- NIKAD `budget` ni `cost`.
- `durationDays` = `endDate - startDate + 1` (server računa; FE ne radi date-matematiku).
- `ownerDisplayName` = puno ime člana s ulogom `OWNER`.

## 4. Endpointi (4 nova)

| Endpoint | Tko smije | Vraća / status |
|---|---|---|
| `PATCH /trips/{id}/visibility`<br>body `{ "visibility": "PUBLIC"\|"PRIVATE" }` | **samo OWNER** | `TripResponse`; ne-owner → **403**; nepostojeći → 404; loš enum → 400; **idempotentno** |
| `GET /trips/public?page&size&search` | bilo koji auth korisnik | `Page<PublicTripSummaryResponse>`; samo `visibility=PUBLIC` |
| `GET /trips/public/{id}` | bilo koji auth korisnik | `PublicTripDetailResponse`; PRIVATE/nepostojeći → **404** |
| `POST /trips/{id}/clone`<br>body `{ startDate, name? }` | bilo koji auth; izvor PUBLIC | `TripResponse` (nova privatna kopija); izvor ne-PUBLIC/nepostojeći → 404; loš body → 400 |

- **Paginacija:** vrati standardni Spring `Page<...>` — FE čita `content`, `number`, `totalPages`
  (isti oblik kao postojeći `GET /activity-feed`, reuse-aj taj serializacijski pristup). `size` dolazi s FE-a (=12).
- **`search`** je opcionalan: `name` **ILI** `destination`, case-insensitive *contains*; sort `updated_at DESC`.
- **Zašto zaseban javni detail (ne `GET /trips/{id}`):** postojeći je member-gated (403 za ne-člana) i
  u `members[]` nosi emailove → procurili bi. Treba čist javni DTO.
- **Zašto 404 (ne 403)** za privatno/nepostojeće: da se ne otkrije postojanje tuđeg privatnog tripa.

## 5. Clone — biznis logika (deep-copy)

Nova kopija = potpun itinerar izvora **minus** financije / datumi / članovi:

- **Kopira se:** `name` (ili `name` iz bodyja ako je zadan), `description`, `destination`,
  `latitude`/`longitude`, `interests`; po danu `dayNumber`, `title`, `notes`; po aktivnosti
  `name`, `description`, `location`, `latitude`/`longitude`, `startTime`, `endTime`, `category`.
- **NE kopira se:** `budget` → `null`; `cost` po aktivnosti → `null`; članovi (samo pozivatelj postaje
  OWNER i jedini član); originalni datumi.
- **Datumi (server je izvor istine):** dan N → `startDate + (N-1)`; `endDate = startDate + (durationDays - 1)`.
  `startTime`/`endTime` su vremena u danu → ostaju nepromijenjeni.
- Nova kopija: `visibility = PRIVATE`, owner = pozivatelj (korisnik koji zove clone).
- Status (`UPCOMING`/`IN_PROGRESS`/`COMPLETED`) deriviraj iz novih datuma kao i inače.

## 6. Repozitorij / query

`findByVisibility(PUBLIC, Pageable)` + opcionalni search:
`name ILIKE %term% OR destination ILIKE %term%`, sort `updatedAt DESC`
(Spring Data derived query ili `@Query`, kako projekt inače radi).

## 7. Autorizacija / sigurnost

- `PATCH .../visibility` — **owner-only** na backendu (FE samo UX-gata toggle za `isOwner()`; prava
  enforce-acija je backend). Editor/viewer/ne-član → 403.
- Javni `GET /trips/public*` — bilo koji autenticirani korisnik, **bez** member-checka; ne-PUBLIC → 404.
- `POST .../clone` — bilo koji autenticirani; izvor mora biti PUBLIC (inače 404).

## 8. Status kodovi (FE error-mapping ovisi o njima)

- **clone:** 200/201 = ok; **400** = nevaljan body (datum/naziv); 401 = neautenticiran; **404** = izvor nije javan/ne postoji; ostalo → generic.
- **visibility:** 200 = ok; **400** = nevaljan enum; **403** = nije owner; **404** = ne postoji.
- **public list:** 200 (prazno → prazan `content`). **public detail:** 200 ili **404**.
- Validacija clone bodyja: `startDate` obavezan i parsabilan; `name` ≤ 255 znakova.

## 9. (Opcionalno) Activity-feed eventi

Nije FE-blokirajuće; za konzistentnost s postojećim `activity-feed`:
- clone stvara trip → razmisli o `TRIP_CREATED` eventu za novu kopiju.
- visibility toggle → eventualno `TRIP_UPDATED`.

## 10. Verifikacija (backend, neovisno o FE-u)

1. Migracija: `visibility` kolona postoji (default PRIVATE), index kreiran; postojeći tripovi PRIVATE.
2. `PATCH /trips/{id}/visibility` kao owner → 200 + novi `visibility`; kao ne-owner → 403.
3. `GET /trips/public` → samo PUBLIC, paginirano, sort `updatedAt DESC`; `?search=` filtrira name|destination; DTO bez email/members/budget.
4. `GET /trips/public/{privatni-id}` → 404; `{javni-id}` → detail bez privatnih polja.
5. `POST /trips/{javni-id}/clone {startDate}` → nova PRIVATE kopija (owner = pozivatelj, datumi pomaknuti, `budget=null`, `cost=null`, bez članova); `{privatni-id}` → 404.
6. Svi postojeći trip endpointi sad vraćaju `visibility` u JSON-u.
7. FE smoke (kad backend stoji): objava → popis → preview → clone end-to-end.
