# Legal & Support stranice (Privacy, Terms, Support)

## Cilj

Zamijeniti mrtve `href="#"` linkove (dashboard footer, auth layout, 404) s tri stvarne, javno dostupne stranice: Privacy Policy, Terms of Service i Support. Sadržaj na EN i HR kroz postojeći ngx-translate setup.

## Odluke

- Sve tri stranice postoje kao zasebne rute; Privacy je najpunija, Terms kratka, Support mini (kontakt + FAQ).
- Kontakt email: `plannr247@gmail.com`.
- Tri zasebne standalone komponente, vizualni stil dijele kopiranjem (bez zajedničke apstrakcije).
- Mrtvi linkovi koji se ne pretvaraju u stranice se uklanjaju: **Status** (404) i **Sustainability** (auth layout), zajedno s njihovim i18n ključevima.

## Rute

U `src/app/app.routes.ts`, iznad `**` wildcarda, bez auth guarda (moraju raditi i za odjavljene korisnike jer su linkane s login/register):

| Ruta | Komponenta |
|---|---|
| `/privacy` | `PrivacyPageComponent` |
| `/terms` | `TermsPageComponent` |
| `/support` | `SupportPageComponent` |

Sve tri lazy (`loadComponent`).

## Komponente

```
src/app/features/legal/
├─ privacy-page/privacy-page.component.{ts,html}
├─ terms-page/terms-page.component.{ts,html}
└─ support-page/support-page.component.{ts,html}
```

- Standalone, `imports: [TranslateModule, RouterLink]`, moderni API-ji (`inject()` ako što zatreba; nema inputa/outputa).
- Sav tekst kroz `| translate` s eksplicitnim ključevima (bez petlji nad translation objektima).

### Layout (zajednički vizualni obrazac, kopiran u sve tri)

Uzor: `src/app/core/not-found/not-found.component.html` (surface tokeni, `font-headline`/`font-label`, dekorativni blur blobovi).

- Vrh: brand mark **plannr.** s `routerLink="/"`.
- Naslov stranice + podnaslov/datum zadnje izmjene ("Last updated: July 2026" — statični string u i18n).
- Uska prozna kolona (`max-w-3xl` ili slično) sa sekcijama: `h2` naslov + jedan ili više paragrafa.
- Dno: mali copyright red (reuse `FOOTER.COPYRIGHT` ključa ili lokalni string).
- Pozadina `bg-surface`, tekst `text-on-surface` / `text-on-surface-variant`.

## Sadržaj — Privacy Policy (`PRIVACY.*`)

Ton: jednostavan, iskren, prvo lice množine; jasno da je plannr. studentski projekt. Nije pravno "bulletproof", ali istinito opisuje što app radi.

| # | EN naslov sekcije | Sadržaj (sažetak) |
|---|---|---|
| 1 | *(intro, bez naslova)* | plannr. je studentski projekt za kolaborativno planiranje putovanja. Ovaj dokument objašnjava koje podatke skupljamo i kako ih koristimo. Korištenjem aplikacije pristaješ na opisano. |
| 2 | Data we collect | Račun: ime, email, lozinka (spremljena hashirana na backendu); kod Google prijave dobivamo ime, email i profilnu sliku od Googlea. Sadržaj: tripovi, itinerari po danima, aktivnosti, uploadane slike (cover), chat poruke, članstva i pozivnice u tripove. Ne skupljamo ništa u pozadini — samo ono što sam uneseš. |
| 3 | How we use your data | Isključivo za rad aplikacije: prikaz tvojih tripova, kolaboracija (ime i avatar vidljivi su ostalim članovima tripa), chat. Tripovi označeni kao javni (i community template-i) vidljivi su svim korisnicima. Ne prodajemo podatke, nema oglasa, nema analitike. |
| 4 | Where your data is stored | Podaci se spremaju na našem backend serveru. Auth token se sprema u localStorage tvog preglednika kako bi ostao prijavljen; briše se odjavom. |
| 5 | Third-party services | Photon (Komoot) — tekst koji upišeš u pretragu destinacija šalje se njihovom API-ju radi autocompletea. OpenStreetMap — pri prikazu karte tvoj preglednik dohvaća kartografske pločice s njihovih servera (vide tvoju IP adresu). Google — samo ako koristiš Google prijavu. Ništa od toga ne uključuje oglašavanje ni praćenje. |
| 6 | Deleting your data | Račun možeš obrisati u Settings → Delete account (uz potvrdu lozinkom). Brisanjem računa brišu se tvoji podaci s naših servera. Za pitanja o podacima javi se na email iz sekcije 7. |
| 7 | Contact | Za sva pitanja o privatnosti: plannr247@gmail.com. |

## Sadržaj — Terms of Service (`TERMS.*`)

Kratko — svaka sekcija 1–3 rečenice.

| # | EN naslov sekcije | Sadržaj (sažetak) |
|---|---|---|
| 1 | *(intro)* | Korištenjem plannr. prihvaćaš ove uvjete. Ako se ne slažeš, nemoj koristiti aplikaciju. |
| 2 | The service | plannr. je studentski projekt, pruža se "as is", bez garancija dostupnosti ili očuvanja podataka. Radimo najbolje što možemo, ali napravi si kopiju bitnih planova. |
| 3 | Your content | Odgovoran si za sadržaj koji objaviš. Tripovi označeni kao javni vidljivi su svim korisnicima — nemoj u njih stavljati privatne informacije. |
| 4 | Acceptable use | Zabranjeno: ilegalan, uvredljiv ili tuđa prava kršeći sadržaj; spam; pokušaji zloupotrebe ili razbijanja servisa. |
| 5 | Termination | Kod kršenja uvjeta možemo obrisati sadržaj ili ukinuti račun. Ti svoj račun možeš obrisati bilo kada u Settings. |
| 6 | Changes & contact | Uvjete možemo mijenjati; vrijedi zadnja objavljena verzija na ovoj stranici. Pitanja: plannr247@gmail.com. |

## Sadržaj — Support (`SUPPORT_PAGE.*`)

- Naslov: "Support" / "Podrška" + kratki podnaslov ("Need help with plannr.? Start here.").
- **Kontakt kartica** (vizualno istaknuta, `primary-container` stil): email `plannr247@gmail.com` kao `mailto:` link + rečenica "We usually reply within a few days."
- **FAQ** — 5 stavki (pitanje + kratak odgovor):

| # | Pitanje (EN) | Odgovor (sažetak) |
|---|---|---|
| 1 | How do I create a trip? | My Trips → New trip; unesi destinaciju (autocomplete), datume, opcionalno cover sliku. |
| 2 | How do I invite people to my trip? | Otvori trip → Members → pošalji pozivnicu; pozvani je vidi na Invites stranici. |
| 3 | What's the difference between private and public trips? | Privatni vide samo članovi; javni su vidljivi svima u Explore i mogu se klonirati kao template. |
| 4 | How do I change the language? | EN | HR switcher: na login stranici u footeru; u aplikaciji u dropdownu ikone profila. |
| 5 | How do I delete my account? | Settings → Delete account, potvrda lozinkom. Brisanje je trajno. |

## i18n

- Novi blokovi u `public/assets/i18n/en.json` i `hr.json`: `PRIVACY`, `TERMS`, `SUPPORT_PAGE` (ključevi tipa `S1_TITLE`/`S1_BODY`, FAQ `Q1`/`A1`).
- HR verzije pisane prirodno, istim tonom kao postojeći HR stringovi (ne doslovni strojni prijevod).
- Brišu se ključevi: `AUTH.LAYOUT.FOOTER_SUSTAINABILITY`, `NOT_FOUND.FOOTER_STATUS` (obje datoteke).

## Spajanje linkova

| Datoteka | Promjena |
|---|---|
| `src/app/shared/components/footer/footer.component.html` | Privacy/Terms/Support `href="#"` → `routerLink` |
| `src/app/auth/auth-layout/auth-layout.component.html` | Privacy/Terms/Support → `routerLink`; Sustainability link ukloniti |
| `src/app/core/not-found/not-found.component.html` | Privacy/Support → `routerLink`; Status link ukloniti |

Pripadne komponente moraju importati `RouterLink` ako već ne importaju.

## Verifikacija (na kraju)

1. `ng serve`; odjavljen: s `/auth/login` kliknuti sva tri linka — stranice se otvore bez logina.
2. Prijavljen: footer linkovi rade; brand mark s legal stranice vraća na `/`.
3. EN↔HR switch mijenja sav sadržaj; u konzoli nema missing-translation upozorenja.
4. 404 stranica: nema Status linka, Privacy/Support rade; auth layout: nema Sustainability linka.
5. Support: mailto otvara klijent s plannr247@gmail.com.
