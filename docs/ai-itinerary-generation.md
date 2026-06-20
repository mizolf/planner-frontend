# AI generiranje plana putovanja (itinerara)

## Cilj

Pri kreiranju putovanja korisnik već unosi **budžet**, **datume** i **interese**. Trenutno se putovanje
kreira prazno, a sve dane i aktivnosti korisnik dodaje ručno. Ova funkcionalnost na temelju tih ulaza
**automatski generira cijeli plan dan-po-dan** (dani + aktivnosti s vremenom, kategorijom, lokacijom i
procijenjenom cijenom unutar budžeta) pomoću Google Gemini modela i popuni novo putovanje. Korisnik
dobiva dobru polaznu točku koju zatim uređuje postojećim CRUD alatima.

## Ključne odluke

| Odluka | Izbor | Razlog |
|---|---|---|
| Gdje se poziva AI | **Backend** (Spring Boot) | API ključ ostaje siguran; uklopljeno u postojeću arhitekturu (sve osjetljivo ide preko backenda) |
| AI servis | **Google Gemini** (`gemini-2.5-flash`) | Besplatni tier bez kartice (Google AI Studio); brz i dovoljno kvalitetan za strukturirani zadatak |
| Output | **Cijeli plan po danima** | Najmanje klikanja za korisnika; on dalje uređuje |
| Okidač | **Checkbox u dijalogu za kreiranje** | Najbliže "kod dodavanja putovanja" |
| Koordinate | **Photon geokodiranje na backendu** | Gemini halucinira koordinate; Photon vraća stvarne OSM koordinate |

## Korisnički tok

1. Korisnik otvori "Kreiraj putovanje", ispuni ime, destinaciju (odabir iz autocompletea → koordinate),
   datume, budžet i interese.
2. Uključi checkbox **"✨ Generiraj plan s AI"** i klikne Spremi.
3. Putovanje se kreira (postojeći `POST /trips`), dijalog se zatvori, app navigira na detalje putovanja.
4. Detalji prikažu loading "AI generira tvoj plan…"; u pozadini teče `POST /trips/{id}/generate-itinerary`.
5. Nakon ~15–25 s dani i aktivnosti se popune; korisnik ih može uređivati kao i obične.

Bez uključenog checkboxa tok ostaje kao danas (zatvori dijalog + success toast, prazno putovanje).

---

## Backend (`planner-backend`)

### Endpoint

```
POST /trips/{tripId}/generate-itinerary
```
- Auth: standardni JWT; mora biti OWNER ili EDITOR putovanja.
- Tijelo zahtjeva: prazno (sav kontekst se izvuče iz putovanja).
- Odgovor: `200 TripDetailResponse` (puno putovanje s danima + aktivnostima — postojeći oblik).
- Greške:
  - `409 ITINERARY_NOT_EMPTY` — putovanje već ima dane (sprječava dvostruko generiranje/duplikate).
  - `403` — korisnik nije OWNER/EDITOR (postojeći obrazac).
  - `502 AI_GENERATION_FAILED` — Gemini nedostupan / nevažeći ključ / nevaljan JSON.

### Tok u servisu (jedna `@Transactional` metoda → atomično)

1. `tripAuthorizationService.validateEditorOrOwner(tripId, currentUser)`.
2. Učitaj `Trip`; `N = endDate - startDate + 1`. Ako `trip.days` nije prazan → `ITINERARY_NOT_EMPTY`.
3. Sastavi prompt + `responseSchema`, pozovi Gemini → JSON.
4. Parsiraj u interni DTO `GeneratedItinerary { days[] { dayNumber, title, activities[] } }`.
5. Za svaku aktivnost geokodiraj lokaciju preko Photona (bias + radijus) → lat/lon ili `null`.
6. Mapiraj u entitete: `TripDay` (`date = startDate.plusDays(dayNumber-1)`, `dayNumber`, `title`) →
   `Activity` (name, description, location, lat/lon, startTime, endTime, category, cost). Spremi (cascade).
7. Vrati `TripDetailResponse`.

**Zašto gradimo entitete direktno**, a ne preko `TripDayService.addDay` / `ActivityService.addActivity`:
te metode publishaju activity-feed event po svakom danu/aktivnosti (spam) i rade zasebne transakcije.
Mi želimo jednu atomičnu transakciju. Date-range i ownership ostaju zadovoljeni jer sami računamo datume
unutar raspona i validiramo autorizaciju na ulazu.

### Nove datoteke (`com.mcesnik.planner_backend`)

- `config/GeminiConfig.java` — `RestClient` bean + propertyji (`@ConfigurationProperties` ili `@Value`).
- `service/ai/ItineraryGenerationService.java` — orkestracija koraka 1–7, `@Transactional`.
- `service/ai/GeminiClient.java` — gradi request body, zove Gemini, čita
  `candidates[0].content.parts[0].text`, parsira u `GeneratedItinerary`; baca `AiGenerationException`.
- `service/ai/BackendGeocodingService.java` — Photon poziv + haversine provjera radijusa → `Optional<Coordinates>`.
- `DTO/ai/GeneratedItinerary.java`, `GeneratedDay.java`, `GeneratedActivity.java` — interni DTO-ovi.
- `controller/ItineraryController.java` — endpoint, `getCurrentUser()` kao u `TripController`.
- `exception/AiGenerationException.java` + handler u `GlobalExceptionHandler`.

**Reuse:** `Trip` / `TripDay` / `Activity` entiteti, `TripDayRepository`, `ActivityRepository`,
`TripAuthorizationService`, postojeći trip-detail mapper, enumi `ActivityCategory` i `Interest`.

**Ovisnosti:** nema novih — `RestClient` dolazi iz `spring-web`, Jackson je već prisutan.

### Konfiguracija (`application.properties` + `.env`)

```properties
gemini.api-key=${GEMINI_API_KEY}
gemini.model=gemini-2.5-flash
gemini.base-url=https://generativelanguage.googleapis.com/v1beta
geocoding.photon-url=https://photon.komoot.io/api/
geocoding.max-radius-km=100
```
`GEMINI_API_KEY` se dohvati besplatno na Google AI Studio (bez kartice) i upiše u `.env`
(isti `${VAR}` obrazac kao JWT / mail tajne).

### Gemini integracija

- `POST {base-url}/models/{model}:generateContent`, header `x-goog-api-key: {key}`.
- Body:
  ```json
  {
    "systemInstruction": { "parts": [{ "text": "<sistemska uputa>" }] },
    "contents": [{ "parts": [{ "text": "<korisnički prompt>" }] }],
    "generationConfig": {
      "responseMimeType": "application/json",
      "responseSchema": { "...struktura days[] → activities[]..." },
      "temperature": 0.7
    }
  }
  ```
- `responseSchema` opisuje: `days[]` s `dayNumber` (int), `title` (string), `activities[]` s
  `name`, `description`, `location` (string), `startTime`/`endTime` (string `HH:mm`),
  `category` (enum: ATTRACTION, TRANSPORT, ACCOMMODATION, RESTAURANT, OTHER), `cost` (number).
  Strukturirani izlaz znači da JSON uvijek odgovara shemi → pouzdano parsiranje.

**Prompt** prosljeđuje: destinaciju, broj dana `N`, budžet (pretpostavka valute **EUR** za v1),
listu interesa, smjernicu ~3–5 aktivnosti po danu, realna vremena bez preklapanja, kategorije iz enuma,
lokacije = stvarna geokodabilna mjesta u/oko destinacije. Uputa: zbroj `cost` ≤ budžet.
`dayNumber` ide 1..N (datume dodjeljuje backend, ne model).

### Geokodiranje koordinata (potvrđeni pristup)

Gemini vraća **samo ime lokacije** (tekst). Za svaku aktivnost backend:
1. Pozove Photon s `q = "{location}, {destination}"`; ako `trip` ima lat/lon → doda `lat`/`lon` **bias**
   (isti princip kao frontend `geocoding.service.ts`), pa je prvi rezultat blizu destinacije.
2. Uzme **prvi** feature.
3. **Provjeri područje:** haversine udaljenost rezultata do centra destinacije; ako > `max-radius-km`
   (default 100 km) → odbaci (`null`). Sprječava da "Cafe Central" pogodi istoimeno mjesto u drugoj državi.
4. Ako `trip` nema koordinate → jednom geokodira destinaciju da dobije centar; ako ni to ne uspije →
   best-effort bez provjere radijusa.
5. Bilo koja greška / prazan rezultat → `null`; aktivnost se svejedno spremi, samo nije na karti.

Pozivi se rade **paralelno s ograničenom konkurentnošću** (npr. 4–5 istovremeno) da ostanemo pristojni
prema besplatnom Photonu. Napomena: za produkciju bi se Photon self-hostao (fair-use politika javnog API-ja).

---

## Frontend (`planner-frontend`)

### `core/services/trip.service.ts`
- Novi `_generating = signal(false)` + `generating` readonly.
- `generateItinerary(tripId): Observable<TripDetailResponse>` → `POST /trips/{id}/generate-itinerary`.
  Na startu `_generating.set(true)`; na uspjeh `_tripDetail.set(detail)` + `_generating.set(false)`;
  na grešku `_generating.set(false)`.

### `create-trip-dialog.component.ts/.html`
- Dodati kontrolu `generateWithAi` (checkbox) i UI checkbox u dijalogu (Tailwind, lokalno — bez diranja
  shared komponenti).
- Injektati `Router`. U `onSubmit()` na uspjeh `createTrip`:
  - ako `generateWithAi` → `close()`, `router.navigate(['/trips', newTrip.id])`, zatim
    `tripService.generateItinerary(newTrip.id).subscribe({ error: toast })`.
  - inače → postojeće ponašanje (close + success toast).

### `trip-detail-page.component.html`
- Kad je `generating()` true, u sekciji dana prikaži namjenski "AI generira tvoj plan…" loading
  (reuse postojeći `animate-pulse` skeleton). Kad postane false, dani se renderaju normalno.
- Prazno stanje (`days.length === 0`) ostaje nepromijenjeno za slučaj bez AI-a.

### i18n (`public/assets/i18n/en.json`, `hr.json`)
Novi ključevi: checkbox label, loading poruka, success / error toast.

### Modeli
`generate-itinerary` vraća `TripDetailResponse` (već tipizirano) — nema novih tipova; request bez tijela.

---

## Izvan opsega za v1
- Activity-feed event za AI generiranje (izbjegavamo spam; bez novog `TripEventType`).
- Regeneriranje / zamjena postojećeg plana (endpoint radi samo na praznom putovanju).
- Više valuta (pretpostavka EUR).
- Async / streaming generiranje (sinkroni zahtjev + loading je dovoljan za v1).

## Bez DB migracije
Koriste se postojeće tablice (trips / days / activities). Nema Flyway promjena.

---

## Verifikacija (manualni smoke)
1. Besplatni Gemini API ključ (Google AI Studio) → `GEMINI_API_KEY` u backend `.env`.
2. Pokreni backend (`./gradlew bootRun`, profil `dev`) i frontend (`npm start`).
3. Kreiraj putovanje (destinacija iz autocompletea radi koordinata, ~4 dana, budžet, par interesa),
   uključi "✨ Generiraj plan s AI", spremi.
4. Očekivano: navigacija na detalje → loading → popunjeni dani s aktivnostima. Provjeri: broj dana =
   raspon datuma, vremena logična bez preklapanja, kategorije ispravne, zbroj cijena ≈ unutar budžeta,
   geokodirane aktivnosti se vide na Leaflet karti.
5. Rubni slučajevi: nevažeći `GEMINI_API_KEY` → error toast, putovanje ostaje prazno (ne puca);
   destinacija bez koordinata → aktivnosti se i dalje generiraju; ponovni poziv na putovanju s danima → 409.
6. Bez checkboxa: tok kreiranja radi kao prije.
