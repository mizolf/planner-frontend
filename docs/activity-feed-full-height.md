# Activity feed — full-height sticky sidebar

## Cilj

Activity feed na home page treba zauzimati visinu od navbara do footera i ostati
vidljiv (zalijepljen) dok korisnik skrola sadržaj. Lista aktivnosti skrola interno
unutar kartice umjesto da kartica raste po sadržaju.

## Trenutno stanje

- `home-page.component.html` — feed je u `<aside>` koji je već `xl:sticky xl:top-24`.
  Kartica je visoka koliko joj treba sadržaj, pa ne ispunjava prostor do footera.
- `activity-feed.component.html` — lista ima fiksni `max-h-[38rem] overflow-y-auto`,
  zbog čega ne raste do dna kartice.

## Odluke

- **Ponašanje na dnu:** sticky (CSS `position: sticky`). Kartica je zalijepljena
  kroz cijeli scroll i poravna se s krajem sadržaja tik iznad footera. Footer se
  ne preklapa. Bez `position: fixed`.
- **Responsive:** full-height sticky vrijedi samo na `xl` (desktop, dva stupca).
  Ispod `xl` feed ostaje složen ispod sadržaja kao i sada.
- **Interni scroll:** lista raste do dna kartice (`flex-1`) i skrola interno;
  fiksni `max-h-[38rem]` se uklanja.

## Promjene

1. **`home-page.component.html`** — sticky wrapper (`:158`):
   - dodano `xl:h-[calc(100vh-7rem)]` (cijeli ekran minus navbar i top razmak)
   - dodano `xl:flex xl:flex-col` da feed ispuni karticu
   - `<app-activity-feed>` dobiva `class="xl:flex xl:flex-col xl:flex-1 xl:min-h-0"`

2. **`activity-feed.component.html`** — lista (`:51`):
   - `max-h-[38rem]` → `max-h-[38rem] xl:max-h-none flex-1 min-h-0`

   Sve je `xl:`-only: na desktopu je host flex column, lista (`flex-1`) raste i
   skrola interno do dna kartice. Ispod `xl` host ostaje default, a lista zadržava
   `max-h-[38rem]` s internim scrollom — mobilni prikaz nepromijenjen.

## Napomena

`top-24` (6rem) je postojeći sticky offset; visina `calc(100vh-7rem)` ostavlja mali
razmak pri dnu. Vrijednosti se fino podese vizualno nakon implementacije.
