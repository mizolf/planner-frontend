# Privacy Policy & Terms of Service — sadržaj i plan implementacije

Dokumentacija za dvije nove javne stranice aplikacije **Plannr**: Politika privatnosti i Uvjeti korištenja.

## Kontekst i odluke

- **Status:** pravi proizvod → realistične, ozbiljne pravne formulacije, GDPR-usklađeno (EU / Hrvatska), bez napomene o studentskom projektu.
- **Jezik:** dvojezično (EN + HR) preko i18n — tekst ide u `public/assets/i18n/en.json` i `hr.json`.
- **Pristup:** javno — rute izvan `authGuard`-a, čitljivo prije registracije.

Sadržaj je usklađen s onim što Plannr stvarno radi:

| Kategorija | Konkretni podaci |
|---|---|
| Račun | ime i prezime, email, lozinka (salted hash), status verifikacije emaila |
| Profil | travel interesi (Culture, Food, Adventure…) |
| Sadržaj putovanja | nazivi/opisi, destinacije + koordinate, datumi, budžet, status, dnevni planovi, bilješke, aktivnosti (lokacija + koordinate, vrijeme, kategorija, trošak) |
| Suradnja | emailovi pozvanih suputnika, imena/emailovi/uloge članova, activity feed izmjena |
| Tehnički | JWT token u `localStorage`, server logovi (IP, vrijeme) |
| Vanjski servisi | Photon/komoot (geocoding), OpenStreetMap (karte), vlastiti Spring Boot backend |
| Čega **nema** | analitika, tracking, reklame, cookie-banneri |

---

## 1. Privacy Policy — sadržaj

Naslov + "Zadnje ažurirano: `<datum>`". Sekcije:

1. **Uvod i voditelj obrade** — tko smo (Plannr), na koga se odnosi, identitet i kontakt voditelja obrade (GDPR čl. 13).
2. **Koje podatke prikupljamo**
   - *Podaci računa:* ime i prezime, email, lozinka (čuvana samo kao salted hash — nikad ne vidimo plaintext), status verifikacije emaila.
   - *Profil i preferencije:* odabrani travel interesi.
   - *Sadržaj putovanja koji kreiraš:* nazivi/opisi putovanja, destinacije i koordinate, datumi, budžet, status; dnevni planovi i bilješke; aktivnosti (naziv, opis, lokacija + koordinate, vrijeme, kategorija, trošak).
   - *Podaci o suradnji:* emailovi pozvanih osoba; imena/emailovi/uloge članova prikazani tebi; activity feed.
   - *Tehnički podaci:* JWT token u local storageu (održavanje prijave); standardni server logovi (IP, vremenska oznaka).
3. **Svrhe obrade** — kreiranje/zaštita računa i autentikacija; pružanje usluge (pohrana i prikaz putovanja); suradnja (pozivi, dijeljeno uređivanje, activity feed); transakcijski emailovi (verifikacijski kod, obavijesti o pozivima); sigurnost i sprječavanje zlouporabe. Bez marketinga, profiliranja i automatiziranog odlučivanja.
4. **Pravne osnove (GDPR čl. 6)** — izvršenje ugovora; legitimni interes (sigurnost); privola gdje je primjenjivo (opoziva); zakonska obveza.
5. **Vanjski servisi i dijeljenje podataka**
   - *Suradnici na putovanju:* uneseni sadržaj vidljiv je članovima koje pozoveš (kontroliraš ti).
   - *Geocoding (Photon by komoot, Njemačka/EU):* tekst pretrage (+ opcionalni bias po poziciji) šalje se Photonu radi prijedloga lokacija.
   - *Karte (OpenStreetMap):* tile-ovi se učitavaju s OSM poslužitelja; tvoj IP vidljiv je pružatelju tile-ova.
   - *Dostava emaila:* [placeholder — pružatelj transakcijskog emaila, ako postoji].
   - Ne prodajemo podatke, ne koristimo oglasne mreže ni analitiku trećih strana.
6. **Kolačići i local storage** — bez tracking kolačića; samo jedan autentikacijski token u local storageu; brisanjem se odjavljuješ.
7. **Međunarodni prijenosi** — backend i treće strane (Photon=EU, OSM) primarno unutar EU/EEA-a; navesti zaštitne mjere ako postoji prijenos izvan EEA.
8. **Čuvanje podataka** — račun i putovanja dok je račun aktivan; brisanje/anonimizacija unutar [X dana] od brisanja računa; backup čišćenje [Y]; invite tokeni automatski istječu; logovi [Z].
9. **Tvoja prava (GDPR)** — pristup, ispravak, brisanje, ograničenje, prenosivost (izvoz), prigovor, opoziv privole; kako ih ostvariti; pravo pritužbe nadzornom tijelu (u RH: **AZOP**).
10. **Sigurnost** — hashirane lozinke, HTTPS u produkciji, kontrole pristupa po ulogama; napomena da nijedna metoda nije 100% sigurna.
11. **Djeca** — usluga nije za osobe mlađe od 16 godina; ne prikupljamo svjesno njihove podatke.
12. **Izmjene politike** — ažuriramo datum i obavještavamo o bitnim promjenama.
13. **Kontakt** — email/adresa za pitanja o privatnosti; DPO ako postoji.

---

## 2. Terms of Service — sadržaj

Naslov + "Zadnje ažurirano: `<datum>`". Sekcije:

1. **Uvod i prihvaćanje** — Uvjeti uređuju korištenje Plannra; kreiranjem računa/korištenjem prihvaćaš ih; ako se ne slažeš, ne koristi uslugu.
2. **Definicije** — "Usluga", "Račun", "Sadržaj", "Putovanje", "Član".
3. **Uvjeti korištenja i računi** — minimalno 16 godina; točni podaci; jedan račun po osobi; čuvanje pristupnih podataka u tajnosti; odgovornost za aktivnost na računu; verifikacija emaila.
4. **Prihvatljivo korištenje** — zabranjeno: kršenje zakona; nezakonit/uvredljiv/protupravni sadržaj; uznemiravanje članova; neovlašteni pristup; scraping, reverse-engineering ili preopterećivanje usluge; zlouporaba poziva/spam; lažno predstavljanje.
5. **Tvoj sadržaj i vlasništvo** — zadržavaš vlasništvo nad sadržajem putovanja; daješ Plannru ograničenu licencu za pohranu/obradu/prikaz **isključivo radi pružanja usluge** (uključujući prikaz pozvanim članovima); odgovoran si za uneseni sadržaj i pravo dijeljenja emailova pozvanih osoba.
6. **Suradnja i dijeljena putovanja** — uloge owner/editor/viewer; vlasnik upravlja članstvom; radnje se bilježe u activity feedu vidljivom članovima; uklanjanje člana ukida budući pristup.
7. **Vanjski servisi** — autocomplete koristi Photon/komoot, karte OpenStreetMap; pružaju ih treće strane; ne jamčimo točnost geocoding/map podataka i ne odgovaramo za odluke o putovanju; podliježu uvjetima tih strana.
8. **Dostupnost usluge i izmjene** — usluga "kakva jest"/"prema dostupnosti"; možemo mijenjati, obustaviti ili ukinuti značajke; ne jamčimo neprekidan rad; možemo mijenjati Uvjete.
9. **Odricanja i odgovornost za putovanje** — Plannr je alat za planiranje, **ne** turistička agencija ni servis za rezervacije; ne rezerviramo/prodajemo/jamčimo prijevoz, smještaj ni aktivnosti; uneseni troškovi su tvoje procjene; sam si odgovoran za vlastite aranžmane, sigurnost, vize itd.
10. **Ograničenje odgovornosti** — u mjeri dopuštenoj zakonom, ne odgovaramo za neizravnu/posljedičnu štetu, gubitak podataka ili gubitke iz odluka o putovanju; ukupna odgovornost ograničena (npr. nominalni iznos za besplatnu uslugu).
11. **Prestanak** — možeš obrisati račun u bilo kojem trenutku; možemo suspendirati/ukinuti zbog kršenja; učinak prestanka na sadržaj (brisanje).
12. **Mjerodavno pravo i sporovi** — pravo Republike Hrvatske / EU; nadležnost hrvatskih sudova; potrošači zadržavaju obavezne zaštite EU.
13. **Izmjene Uvjeta** — nastavak korištenja nakon izmjena = prihvaćanje; bitne promjene se najavljuju.
14. **Kontakt** — email/adresa.

---

## 3. Plan implementacije

### Nove komponente (standalone, signal API `input()`/`inject()`, `app-` prefix)
- `src/app/features/legal/legal-page-shell/legal-page-shell.component.{ts,html}` — zajednički okvir: `input()` za naslov i "zadnje ažurirano", `<ng-content>` za sekcije, uključuje `FooterComponent` i "natrag na app" link.
- `src/app/features/legal/privacy-page/privacy-page.component.{ts,html}`
- `src/app/features/legal/terms-page/terms-page.component.{ts,html}`

**i18n pristup:** struktura dokumenta (h1, sekcije s h2, `<p>`, `<ul>`) u HTML templateu; tekst preko `{{ 'PRIVACY.…' | translate }}` / `{{ 'TERMS.…' | translate }}`, dosljedno obrascu `FOOTER.PRIVACY`. Liste: numerirani ključevi (`…ITEM_1`, `…ITEM_2`). Stiliziranje Tailwind + MD3 tokeni (`text-on-surface`, `text-on-surface-variant`, `bg-surface`), čitljiv layout (`max-w-3xl`, prozni razmaci), dekorativni blur posuđen iz `not-found.component.html`, lijevo poravnato za dugi tekst.

### Izmjene postojećih datoteka
- **`src/app/app.routes.ts`** — dvije javne top-level rute (kao `not-found`, **izvan** `authGuard` children), prije `**`:
  ```ts
  { path: 'privacy', loadComponent: () => import('./features/legal/privacy-page/privacy-page.component').then(m => m.PrivacyPageComponent) },
  { path: 'terms',   loadComponent: () => import('./features/legal/terms-page/terms-page.component').then(m => m.TermsPageComponent) },
  ```
- **`src/app/shared/components/footer/footer.component.html`** — zamijeniti `href="#"` s `routerLink="/privacy"` i `routerLink="/terms"` (komponenta već importa `RouterLink`).
- **`src/app/core/not-found/not-found.component.html`** — wire-up `FOOTER_PRIVACY` linka na `/privacy` (bonus; importati `RouterLink` u `.ts`).
- **`public/assets/i18n/en.json` + `hr.json`** — namespace `PRIVACY.*` i `TERMS.*` (svi naslovi/odlomci gore) + labele `LEGAL.LAST_UPDATED`, `LEGAL.BACK_TO_APP`. HR ključevi zrcale EN.
- *(Preporuka)* auth login/register template — linija "Registracijom prihvaćaš naše [Uvjete] i [Politiku privatnosti]" s linkovima.

### Placeholderi prije objave
Pravni subjekt / voditelj obrade (naziv + adresa); kontakt email (`privacy@`, `support@`); datum stupanja na snagu; rokovi čuvanja (X/Y/Z); pružatelj email dostave (ako postoji); DPO (ako postoji); konkretan iznos ograničenja odgovornosti.

---

## 4. Verifikacija (end-to-end)
1. `npm start`; **odjavljen** otvori `/privacy` i `/terms` → stranice se renderiraju, **nema** redirecta na login.
2. Prebaci jezik EN ↔ HR → sav sadržaj se mijenja, nema "missing key" stringova.
3. Klik na Privacy/Terms u footeru → ispravna navigacija; isto za not-found / auth linkove.
4. Konzola bez grešaka; lazy chunkovi se učitavaju.
