# Trip Map — Leaflet + OSM karta u Trip Details

## Cilj
Na stranici detalja putovanja prikazati interaktivnu Leaflet/OpenStreetMap kartu za
**trenutno odabrani dan**. Svaka aktivnost koja ima koordinate dobiva **obojeni numerirani
pin**, pinovi su spojeni neutralnom linijom rute (redom po `startTime`), a lista aktivnosti
i karta su dvosmjerno sinkronizirane.

Koordinate već postoje (Photon autocomplete) na `ActivityResponse` i `TripDetailResponse`,
pa **nema promjena na backendu**.

## Odluke
| Tema | Odluka |
|------|--------|
| Opseg karte | Samo odabrani dan, sinkronizirano s postojećim day pickerom |
| Redoslijed | Lista već prikazuje aktivnosti po `startTime`; karta isto sortira → pinovi i redovi se slažu (listu NE re-sortiramo) |
| Boja pina | Fiksna paleta po poziciji: `tripPinColor(i) = PALETTE[i % PALETTE.length]`; broj ostaje u pinu (redoslijed rute) |
| Legenda | Postojeća lista aktivnosti; poklapanje preko broja/interakcije. Obojene točke na redovima = **kasniji korak** |
| Linija rute | Jedna neutralna boja (`#68788f`), dashed, `weight 3`, opacity ~0.6 |
| Interakcija | Dvosmjerna: pin ↔ highlight u listi; "locate" gumb u listi → fokus na karti |
| Markeri | Custom HTML `DivIcon` (numerirani obojeni krug), bez Leaflet slika |
| Tile izvor | OpenStreetMap (`tile.openstreetmap.org`), uz obaveznu atribuciju |
| Map init | `afterNextRender` (Angular 18) — element zajamčeno postoji, nema init race |

## Boje pina — `trip-pin-color.ts`
Mali pure modul (`src/app/features/trips/trip-detail/trip-pin-color.ts`) da ga **kasnije** i
`TripDayCardComponent` može importati za obojene točke u listi:
- `TRIP_PIN_PALETTE` — 10 različitih boja, sve dovoljno tamne da bijeli broj ostane čitljiv.
- `tripPinColor(index)` — boja po poziciji, wrap-around ako dan ima više aktivnosti od boja.

## Komponenta: `TripMapComponent`
Lokacija: `src/app/features/trips/trip-detail/trip-map.component.ts` (+ `.html`).
Standalone, signali, Tailwind, ngx-translate — kao i ostale komponente u feature-u.

### API
```
// Inputs
day              = input<TripDayResponse | null>(null)
centerLat        = input<number | null>(null)   // destinacija putovanja, fallback centar
centerLng        = input<number | null>(null)
focusedActivityId = input<number | null>(null)

// Output
focusActivity = output<number>()   // emitira id aktivnosti kad se klikne pin
```

### Template
- `<div class="relative z-0">` wrapper → vlastiti stacking context drži Leaflet z-index
  (paneovi/kontrole) ispod stranica/dijaloga (`z-50`).
- `<div #mapEl class="h-72 sm:h-96 w-full rounded-2xl overflow-hidden">`.
- Overlay napomena (`MAP.NO_LOCATIONS`) preko karte kad dan nema **nijednu** aktivnost s koordinatama.
- Caption ispod karte: `MAP.HIDDEN_COUNT` (broj aktivnosti bez lokacije), samo kad ih ima.

### Lifecycle
- `afterNextRender` (konstruktor): `L.map(mapEl)` + OSM `tileLayer` (`maxZoom: 19`,
  attribution `© OpenStreetMap contributors`), `renderDay()`, pa jednom
  `setTimeout(() => map.invalidateSize())` (kontejner ima determinističku visinu).
- `effect()` (konstruktor): čita `day()` → guard `if (!map) return;`, inače `renderDay()`.
  **Bez pisanja signala u effectu** (izbjegava NG0600) — samo imperativni Leaflet pozivi.
- `effect()`: čita `focusedActivityId()` → guard `if (!map || id == null) return;` **i**
  `if (!marker) return;` (aktivnost bez koordinata nema marker). `openPopup()`; `panTo`
  **samo ako marker nije već u `map.getBounds()`** (sprječava redundantni pan na klik pina).
- `ngOnDestroy`: `map.remove()`.

### `renderDay()`
1. Filtriraj `day()?.activities` na one s oba `latitude` i `longitude` (computed `located()`).
2. Sortiraj po `startTime` (null na kraj).
3. Ukloni prethodne markere (`Map<id, L.Marker>`) + polyline.
4. Za svaku (index `i`): `L.marker` s custom `L.divIcon` — krug `background-color: tripPinColor(i)`
   (inline, boja je dinamična) + bijeli ring + sjena (statične Tailwind klase), broj `i+1`.
   `bindPopup` se gradi kao **DOM element s `textContent`** (sigurno od HTML injectiona iz
   korisničkih naziva): naziv, `formatTime(start[-end])`, kategorija preko
   `TranslateService.instant('TRIPS.CATEGORIES.' + (cat ?? 'NONE'))`, lokacija.
   `marker.on('click')` → `focusActivity.emit(activity.id)`.
5. Ako ≥2 aktivnosti: `L.polyline` (neutralna boja `#68788f`, `weight: 3`, dashed, opacity ~0.6).
6. `fitBounds` na markere (padding); 1 marker → `setView`; 0 → centriraj na
   `centerLat/centerLng` (zoom 11) ili default svjetski prikaz.

> Napomena: `.instant()` je snapshot — popup se neće prevesti na promjenu jezika dok je otvoren.
> Prihvatljivo jer su popupi prolazni. Obojene točke na redovima liste su zaseban, kasniji korak.

## Izmjene postojećih datoteka

### `TripDetailPageComponent` (`.ts` + `.html`)
- `focusedActivityId = signal<number | null>(null)`; `onFocusActivity(id)` ga postavlja.
- Reset `focusedActivityId.set(null)` u `selectDay()` i u postojećoj route-param subscription
  (uz `userSelectedDayId.set(null)`).
- `<app-trip-map>` unutar `@if (selectedDay(); as d)`, **između day pickera i day carda**:
  `[day]="d" [centerLat]="t.latitude" [centerLng]="t.longitude"
   [focusedActivityId]="focusedActivityId()" (focusActivity)="onFocusActivity($event)"`.
- Day card također prima `[focusedActivityId]` i emitira `(focusActivity)`.

### `TripDayCardComponent` (`.ts` + `.html`)
- Novi `focusedActivityId = input<number | null>(null)`; novi `focusActivity = output<number>()`.
- U aktivnost `<li>`: mali `pin_drop` gumb **samo kad aktivnost ima koordinate**;
  `(click)="focusActivity.emit(activity.id); $event.stopPropagation()"` +
  `(keydown.enter/space)="$event.stopPropagation()"` (da ne okine postojeći row→edit klik).
  aria-label `TRIPS.DETAIL.ACTIVITIES.LOCATE`.
- Highlight reda kad `focusedActivityId() === activity.id` (`ring-2 ring-primary` +
  `bg-surface-container-high`).
- Postojeći row-click=edit ostaje netaknut.

### `angular.json`
- `"node_modules/leaflet/dist/leaflet.css"` u `styles` (build + test, prije `src/styles.scss`).
- `"allowedCommonJsDependencies": ["leaflet"]` (Leaflet nije ESM — gasi optimization-bailout warning).

### i18n (`public/assets/i18n/en.json` + `hr.json`)
- `TRIPS.DETAIL.MAP.NO_LOCATIONS`
- `TRIPS.DETAIL.MAP.HIDDEN_COUNT` (`{{count}}`)
- `TRIPS.DETAIL.ACTIVITIES.LOCATE`

## Dependencies
- `leaflet`, `@types/leaflet` (dev).

## Verifikacija
- Dan s ≥2 locirane aktivnosti → **obojeni** numerirani pinovi + iscrtkana ruta; promjena dana ažurira pinove i resetira fokus.
- Klik na pin → popup; odgovarajući red u listi se istakne; nema dvostrukog/trzajućeg pana.
- Klik na "locate" gumb → karta se pomakne i otvori popup; row→edit se NE okida.
- Aktivnost bez `startTime` ide na kraj; bez kategorije → popup pokazuje `CATEGORIES.NONE`.
- Dan s aktivnostima bez koordinata → overlay napomena + caption s brojem skrivenih.
- `npm run build` prolazi bez warninga; `TripMapComponent` je u lazy trips chunku (Leaflet izvan initial bundlea).

## Watch-items
- z-index: Leaflet kontrole ne smiju preklapati header dropdown; dijalozi (`z-50`) iznad karte — riješeno `relative z-0` wrapperom.
- `invalidateSize` jednom nakon init-a (kontejner ima fiksnu visinu `h-72 sm:h-96`).
- Tailwind purge za `divIcon` klase — statične klase moraju ostati cijele u string literalu.
