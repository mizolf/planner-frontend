# Trip Chat — razgovor između članova putovanja

## Pregled

Trip detail prikazuje itinerar (lijevo) i sidebar (desno) s mapom, pregledom i listom članova. Članovi nemaju način da komuniciraju unutar aplikacije. Ova značajka dodaje **chat sekciju** u desni sidebar gdje članovi razmjenjuju tekstualne poruke, s **real-time isporukom preko WebSocketa**.

Repo je **frontend-only** (Angular 18.2, standalone komponente, signali, `inject()`). Backend (Spring Boot na `environment.apiUrl`) **još nema chat endpointe** — ovaj dokument definira contract (REST + WebSocket/STOMP) koji se implementira na backendu. Trenutno u repou **ne postoji** real-time infrastruktura.

### Odluke
- **Backend:** ne postoji → ovdje definiramo contract.
- **Real-time:** **WebSocket/STOMP** — poruke stižu push-om uživo.
- **Smještaj:** sekcija u desnom sidebaru (ispod pregleda/članova).
- **Opseg:** osnovno (slanje + lista poruka s avatarom/imenom/vremenom) **+ učitavanje povijesti (pagination)**, **+ uredi/obriši vlastitu poruku**, **+ unread badge**. Bez typing indikatora.

### Ključna arhitektonska odluka: socket je *samo za primanje*
Svi **zapisi (slanje/uredi/obriši) idu kroz REST** — tako prolaze kroz postojeći member-check i JWT interceptor. **WebSocket nosi samo broadcast evente** prema klijentima. Posljedica: socket treba autorizirati samo na *pretplati* (subscribe), a ne i na slanju → bitno manje sigurnosne plumbing-a.

Tok svake mutacije: `klijent → REST poziv → backend perzistira → backend broadcasta event na topic → svi klijenti (uključujući pošiljatelja) prime event i ažuriraju listu`. Nema optimistic UI-a; izvor istine je broadcast (dedup po `id`).

### Dvije dizajn-odluke (konvencijske)
- **Collapsible, lazy povijest:** sekcija je sklopljiva i **sklopljena po defaultu**. **Socket pretplata se uspostavlja čim se trip detail otvori** (da unread badge raste uživo i dok je chat sklopljen), ali se **povijest poruka dohvaća tek pri prvom otvaranju** (lazy). Otvaranje označava pročitano.
- **Last-read prati backend** (a ne localStorage): robusnije, radi preko uređaja. Lagani REST endpoint za broj nepročitanih + endpoint za "označi pročitano".

---

## Contract (backend — implementira se zasebno)

### REST (svi zapisi + povijest + unread)
Pod postojećim `/trips/{tripId}` namespaceom; pristup samo članovima (403 za ne-članove). Pošiljatelj iz JWT-a. Uredi/obriši samo autor (403 inače).

| Metoda | Putanja | Tijelo | Odgovor |
|---|---|---|---|
| GET | `/trips/{tripId}/messages?before={messageId}&limit={n}` | — | `{ content: ChatMessageResponse[], hasMore: boolean }` |
| POST | `/trips/{tripId}/messages` | `{ content }` | `ChatMessageResponse` (201) + **broadcast CREATED** |
| PUT | `/trips/{tripId}/messages/{messageId}` | `{ content }` | `ChatMessageResponse` + **broadcast UPDATED** |
| DELETE | `/trips/{tripId}/messages/{messageId}` | — | 204 + **broadcast DELETED** |
| GET | `/trips/{tripId}/messages/unread-count` | — | `{ count: number }` |
| POST | `/trips/{tripId}/messages/read` | — | 204 |

**Paginacija (cursor):** bez `before` vraća zadnjih `limit`; s `before` stariju stranicu; `content` oldest→newest; `hasMore` = postoje li starije.
**Unread:** backend pamti po (user, trip) `lastReadMessageId`. `read` ga postavlja na najnoviju.

### WebSocket / STOMP (samo push)
- **STOMP endpoint:** WebSocket upgrade na `…/ws` — **raw WebSocket, bez SockJS** (drži frontend ovisnosti na minimumu; backend `registerStompEndpoints().addEndpoint("/ws")` **bez** `.withSockJS()`). Simple broker na `/topic`.
- **Topic:** klijent se pretplati na `/topic/trips/{tripId}`.
- **Broadcast frame (`ChatEvent`):**
  ```json
  { "type": "CREATED" | "UPDATED" | "DELETED", "message": ChatMessageResponse }
  ```
  (za `DELETED` dovoljan je `message.id`).
- **Auth socketa (jedini netrivijalan dio):**
  - **CONNECT:** frontend šalje `Authorization: Bearer <jwt>` u STOMP `connectHeaders`; backend `ChannelInterceptor` validira token i postavlja `Principal`. (Postojeći HTTP interceptor NE pokriva socket — odvojena staza.)
  - **SUBSCRIBE:** isti interceptor na `SUBSCRIBE` frame za `/topic/trips/{id}` provjerava da je principal **član** tog tripa; inače odbija (sprječava prisluškivanje tuđih razgovora).

---

## Frontend

### Ovisnost
Dodati `@stomp/stompjs`. **Ne** treba `sockjs-client` (raw WebSocket).
WS URL se izvodi iz `environment.apiUrl` (`http`→`ws`, `https`→`wss`) + `/ws`; po potrebi dodati `wsUrl` u `src/environments/environment*.ts`.

### Model — `src/app/core/models/chat.model.ts` (novo)
Prati konvenciju `{Entity}Response` iz `src/app/core/models/trip.model.ts`.
```ts
export interface ChatMessageResponse {
  id: number;
  senderId: number;
  senderName: string;   // denormalizirano za avatar/inicijale + ime
  content: string;
  createdAt: string;    // ISO
  edited: boolean;
}
export interface ChatMessagePage { content: ChatMessageResponse[]; hasMore: boolean; } // oldest→newest
export interface SendMessageRequest { content: string; }
export interface UpdateMessageRequest { content: string; }
export type ChatEvent =
  | { type: 'CREATED' | 'UPDATED'; message: ChatMessageResponse }
  | { type: 'DELETED'; message: { id: number } };
```

### Servis — `src/app/core/services/chat.service.ts` (novo)
Obrazac iz `src/app/core/services/trip.service.ts`: `providedIn: 'root'`, `inject(HttpClient)`, `apiUrl = \`${environment.apiUrl}/trips\``, privatni `signal`-i + `.asReadonly()`. Dodatno injektira `AuthService` (JWT za socket header).

**Stanje (signali):** `messages`, `loading`, `error`, `hasMore`, `sending`, `unreadCount`, `connected`.

**REST metode** (`.pipe(tap(...))` gdje treba): `loadMessages(tripId)`, `loadOlder(tripId)` (prepend, `before`=id najstarije), `sendMessage(tripId, content)`, `editMessage`, `deleteMessage`, `loadUnreadCount(tripId)`, `markRead(tripId)`.

> Nakon REST zapisa **ne** mutiramo listu ručno — promjena stiže natrag kao `ChatEvent` broadcast (jedinstven izvor istine, dedup po `id`).

**STOMP (`@stomp/stompjs` `Client`):**
- `connect(tripId)`:
  - `new Client({ brokerURL: <wsUrl>/ws, connectHeaders: { Authorization: 'Bearer ' + authService.token() }, reconnectDelay: 5000 })`.
  - `onConnect` → `client.subscribe('/topic/trips/' + tripId, frame => applyEvent(JSON.parse(frame.body)))`, `connected=true`, te **re-sync nakon (re)konekcije**: `loadUnreadCount` (+ `loadMessages` ako je sekcija otvorena) da se popune eventi propušteni dok je veza bila pala.
  - `client.activate()`.
- `applyEvent(e: ChatEvent)` — reducer nad `messages`/`unreadCount`:
  - `CREATED` → append (dedup po id); ako poruka nije moja i sekcija je sklopljena → `unreadCount++`.
  - `UPDATED` → zamijeni po id.
  - `DELETED` → ukloni po id.
- `disconnect()` → `client.deactivate()`, reset `connected`.

### Sekcija — `src/app/features/trips/trip-detail/trip-chat-section.component.ts` + `.html` (novo)
Standalone, signal-based, ogledalo `trip-members-section.component.ts`. Injektira `ChatService` + `ToastService`.
**Inputi:** `tripId = input.required<number>()`, `currentUserId = input<number | null>(null)`.
**Lokalno stanje:** `expanded = signal(false)`, `draft = signal('')`, `editingId = signal<number | null>(null)`.

**Životni ciklus / ponašanje:**
- `ngOnInit` → `chatService.loadUnreadCount(tripId())` **i** `chatService.connect(tripId())` (pretplata aktivna od starta → live badge i dok je sklopljeno). **Ne** koristiti `effect()` za fetch (NG0600); koristiti `ngOnInit`.
- `ngOnDestroy` → `chatService.disconnect()`.
- Prvi `toggle()` na otvaranje → `loadMessages` + `markRead` (lazy povijest). Daljnja otvaranja ne re-fetchaju (poruke stižu live).
- Slanje: Enter (bez Shifta) ili gumb → `sendMessage`, očisti `draft`; prazne/whitespace se ignoriraju. (Poruka se prikaže kad stigne broadcast.)
- Edit (samo `senderId === currentUserId()`): inline textarea + Spremi/Odustani → `editMessage`.
- Delete (samo autor): potvrda dijalogom → `deleteMessage`.
- Greške → `toastService.show({ type: 'error', message: 'TRIPS.DETAIL.CHAT.ERROR...' })`.

**UI (Tailwind, reuse postojećih klasa):**
- Zasebna kartica u sidebaru: `bg-surface-container-lowest rounded-card shadow-ambient p-5`.
- Header: naslov "Razgovor" + unread badge (`bg-primary text-on-primary` pill, skriven kad je 0) + chevron toggle. Opcionalno: točkica konekcije (`connected()`). Refresh gumb nije potreban (real-time).
- Lista: scrollable `max-h-[26rem] overflow-y-auto space-y-3`; "Učitaj starije" na vrhu kad `hasMore()`.
- Bubble: inicijali avatar `size-9 rounded-full bg-primary-container text-on-primary-container` preko `initialsOf(senderName)` (`src/app/shared/utils/initials.ts`); ime + vrijeme (`date:'h:mm'`); "(uređeno)" ako `edited`. Vlastite poruke poravnate desno / drukčija pozadina.
- Loading/empty/error stanja prema `src/app/features/activity-feed/activity-feed.component.html` (skeleton `animate-pulse`, centriran empty state).
- Input: **lokalni** `<textarea>` + send gumb (NE shared `TextareaFieldComponent` — nosi label/icon/error chrome koji ne treba; preferiraj lokalnu duplikaciju umjesto modificiranja radne shared komponente).
- Kontrola toka: `@if`/`@for (m of messages(); track m.id)`.

### Potvrda brisanja — `delete-message-dialog.component.ts` (novo)
Mirror `remove-member-dialog.component.ts`: mali dialog (`@ViewChild`), konzistentno s postojećim destruktivnim akcijama. Edit ostaje inline.

### Uklapanje u stranicu
- `trip-detail-page.component.html`: dodati `<app-trip-chat-section [tripId]="t.id" [currentUserId]="currentUserId()" />` u `<aside>` (~linija 203, nova kartica).
- `trip-detail-page.component.ts`: dodati import u `imports: [...]`. `currentUserId()` već postoji (linija 195).

### i18n
Dodati `TRIPS.DETAIL.CHAT.*` ključeve u postojeće ngx-translate JSON datoteke (`src/assets/i18n/`).

---

## Datoteke

**Novo:** `src/app/core/models/chat.model.ts`, `src/app/core/services/chat.service.ts`, `src/app/features/trips/trip-detail/trip-chat-section.component.ts` (+ `.html`), `src/app/features/trips/trip-detail/delete-message-dialog.component.ts`.
**Izmjena:** `trip-detail-page.component.html` (+ sekcija), `trip-detail-page.component.ts` (import), `src/environments/environment*.ts` (wsUrl, po potrebi), `package.json` (`@stomp/stompjs`), i18n JSON.

---

## Verifikacija

Puni E2E ide tek nakon backend implementacije (REST + STOMP). Redom:

1. **Kompilacija:** `npm run build` prolazi bez grešaka.
2. **Vizualni smoke (`ng serve`):** chat kartica se renderira sklopljena; otvaranje pokazuje loading pa error/empty (backend 404); socket pokušaj konekcije ne ruši UI.
3. **Nakon backenda — ručni smoke (jedan prolaz, idealno dva browsera/člana):**
   - Pošalji poruku u browseru A → **uživo se pojavi** u browseru B bez refresha (i kod A preko broadcasta).
   - Dok je sekcija sklopljena u B, poruka iz A → unread badge raste uživo; otvaranje sekcije čisti badge.
   - "Učitaj starije" dohvaća prethodnu stranicu pri >`limit` poruka.
   - Uredi vlastitu poruku → "(uređeno)" uživo kod oba; tuđu nije moguće uređivati.
   - Obriši vlastitu (uz potvrdu) → nestaje uživo kod oba.
   - **Socket auth:** bez/krivi JWT u `connectHeaders` → CONNECT odbijen; ne-član subscribe na tuđi topic → odbijeno.
   - **Reconnect:** ugasi pa vrati mrežu → klijent se reconnecta i re-synca (propušteni eventi se popune kroz `loadUnreadCount`/`loadMessages`).
