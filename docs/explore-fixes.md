# Explore feature — popravke

Lista stvari koje treba popraviti na `feat(explore)` commitu (`6eb936d`) prije nego se merge-a u main. Race condition iz cache-a je namjerno izostavljen jer ce ga ukloniti buduci trip-details refactor.

---

## 1. Timezone bug u `dateNotInPast` validatoru

**Datoteka:** `src/app/shared/validators/trip.validators.ts:15-25`

### Sto ne valja
Validator parsira datum iz `<input type="date">` (npr. `"2026-04-29"`) ovako:
```ts
const date = new Date(value);
```

Kad JavaScript dobije string u formatu `YYYY-MM-DD`, parsira ga kao **UTC ponoc**. A `new Date()` vraca **lokalno vrijeme**. To znaci da se usporedjuju dvije razlicite vremenske zone.

### Zasto je problem
Korisnik u Hrvatskoj (UTC+1/+2) izabere "danas" → frontend kaze OK. Korisnik u Brazilu (UTC-3) izabere "danas" → frontend moze reci da je datum u proslosti. Backend pravilo je strikt "today or later", pa ce u rubnim slucajevima frontend pustiti datum koji backend odbije s 400 greskom.

### Kako popraviti
Parsiraj string kao **lokalnu** ponoc:
```ts
const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
if (!match) return null;
const [, y, m, d] = match;
const date = new Date(Number(y), Number(m) - 1, Number(d));
```

Bonus: regex usput odbija krive inpute (npr. ISO instant string).

### Isto popraviti i ovdje
`apply-template-dialog.component.ts:52-60` — `endDate` computed signal radi isti `new Date(start)` trick.

---

## 2. 400 `fieldErrors` se ignoriraju

**Datoteka:** `src/app/features/explore/apply-template-dialog/apply-template-dialog.component.ts:114-116`

### Sto ne valja
Backend kod 400 greske vraca strukturu:
```json
{
  "status": 400,
  "message": "Validation failed",
  "fieldErrors": { "startDate": "Start date must be today or later" }
}
```

Trenutno frontend gleda samo `err.status === 400` i pokaze generic banner "Validation failed". Pojedinacno polje koje je palo nije istaknuto.

### Zasto je problem
Korisnik vidi "validacija nije prosla" ali ne zna **koje polje** je krivo. Mora pogadjati. Los UX, posebno kad ima vise polja.

### Kako popraviti
1. Dodaj generic per-field i18n kljuceve u `en.json` i `hr.json`:
   ```json
   "EXPLORE.APPLY.START_DATE_SERVER_REJECTED": "Date is invalid",
   "EXPLORE.APPLY.BUDGET_SERVER_REJECTED": "Budget is invalid"
   ```
2. U error handleru, namjesti `serverError: true` na pripadajuci FormControl:
   ```ts
   const body = err.error as { fieldErrors?: Record<string, string> } | null;
   for (const [field, msg] of Object.entries(body?.fieldErrors ?? {})) {
     console.warn(`[apply-template] server rejected ${field}:`, msg);
     const ctrl = this.form.get(field);
     if (ctrl) {
       ctrl.setErrors({ ...ctrl.errors, serverError: true });
       ctrl.markAsTouched();
     }
   }
   ```
3. Prosiri `[errors]` mapu u HTML-u:
   ```ts
   serverError: 'EXPLORE.APPLY.START_DATE_SERVER_REJECTED'
   ```

Server poruka (engleski) ide u `console.warn` za debug, korisnik vidi lokalizirani hint po polju.

### Zasto generic poruka, a ne stvarna server poruka
- Backend poruke su na engleskom — ne zelimo ih pokazivati korisniku bez prijevoda
- Client-side validatori (nakon fix-a #1) vec hvataju **ista pravila** kao backend → 400 odsad je rubni slucaj (npr. clock skew, novo backend pravilo). Korisniku je dovoljan signal "ovo polje je krivo".

---

## 3. Nema focus trap-a, autofocusa, ni `aria-labelledby`

**Datoteke:** sva tri dijaloga (`style-preview-dialog`, `template-preview-dialog`, `apply-template-dialog`)

### Sto ne valja
- Kad otvoris dijalog, **fokus ostaje gdje je bio** — korisnik koji koristi tipkovnicu mora rucno tab-ati do dijaloga
- **Tab pobjegne iz dijaloga** — fokus skoci na underlying page
- `aria-modal="true"` postavljen, ali nema `aria-labelledby` koji povezuje dijalog s naslovom → screen reader ne cita ime dijaloga

### Zasto je problem
A11y. Korisnici koji se oslanjaju na tipkovnicu ili screen reader ne mogu normalno koristiti modale. WCAG 2.1 trazi focus management u dijalozima.

### Kako popraviti
Izvuci u **shared direktivu** umjesto kopiranja koda po tri dijaloga:

**Nova datoteka:** `src/app/shared/directives/dialog-container.directive.ts`

```ts
@Directive({ selector: '[appDialogContainer]', standalone: true })
export class DialogContainerDirective implements AfterViewInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private previouslyFocused: HTMLElement | null = null;

  ngAfterViewInit(): void {
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this.getFocusable()[0]?.focus();
  }

  ngOnDestroy(): void {
    this.previouslyFocused?.focus?.();
  }

  onKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return;
    const focusables = this.getFocusable();
    if (focusables.length === 0) { e.preventDefault(); return; }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }

  private getFocusable(): HTMLElement[] {
    const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(this.el.nativeElement.querySelectorAll<HTMLElement>(sel))
      .filter(el => !el.hasAttribute('disabled'));
  }
}
```

Pa u svakom dijalog template-u:
```html
<div
  appDialogContainer
  #dlg="appDialogContainer"
  (keydown)="dlg.onKeydown($event)"
  role="dialog"
  aria-modal="true"
  aria-labelledby="apply-dialog-title"
  ...>
  <h2 id="apply-dialog-title">...</h2>
```

Svaki dijalog ima svoj fixni `id` na `<h2>` (`style-preview-title`, `template-preview-title`, `apply-dialog-title`).

### Zasto direktiva, a ne `@angular/cdk/dialog`
CDK Dialog daje sve ovo besplatno (+ animacije, scroll-block) ali zahtijeva refactor svih dijaloga u service-driven `dialog.open()` pattern. Manji blast radius je hand-rolled direktiva. CDK je future migration ako se broj dijaloga jako poveca.

---

## 4. `seasonKey()` prima `string` umjesto `Season`

**Datoteke:**
- `src/app/features/explore/style-preview-dialog/style-preview-dialog.component.ts:57`
- `src/app/features/explore/template-preview-dialog/template-preview-dialog.component.ts:64`

### Sto ne valja
```ts
seasonKey(season: string): string {
  return `EXPLORE.SEASON.${season}`;
}
```

Tip parametra je `string`, a backend nam daje `Season` union tip (`'SPRING' | 'SUMMER' | ...`). TypeScript ne hvata kad dobijes nepoznatu sezonu.

### Zasto je problem
Ako backend ikad doda novu sezonu (npr. `'MONSOON'`) i azurira frontend `Season` tip, TS bi trebao crveniti svako mjesto gdje koristimo `Season` ali ne pokrivamo novu vrijednost. Trenutno ne crveni jer je tip prelabav.

### Kako popraviti
Uvedi `Season` tip:
```ts
import { Season } from '../../../core/models/explore.model';

seasonKey(season: Season): string {
  return `EXPLORE.SEASON.${season}`;
}
```

### Bonus — extract u util
Funkcija je duplicirana u oba dijaloga. Premjesti u `src/app/shared/utils/i18n-keys.ts`:
```ts
export const seasonKey = (season: Season): string => `EXPLORE.SEASON.${season}`;
```

---

## 5. `formatTime` naivno strize string

**Datoteka:** `src/app/features/explore/template-preview-dialog/template-preview-dialog.component.ts:68-71`

### Sto ne valja
```ts
formatTime(time: string | null): string {
  if (!time) return '';
  return time.slice(0, 5);
}
```

Pretpostavlja da string uvijek izgleda kao `"HH:mm:ss"` ili `"HH:mm"`. Ako backend ikad posalje drugi format (`"HH:mm:ss.SSS"`, ISO instant `"2026-04-29T14:30:00Z"`), `slice(0,5)` daje glupost.

### Zasto je problem
Tihi failure — korisnik vidi necitljiv text umjesto vremena, nema greske u konzoli. Krhko prema backend promjenama.

### Kako popraviti
Striktna regex validacija:
```ts
formatTime(time: string | null): string {
  if (!time) return '';
  const m = time.match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
}
```

Ako string ne izgleda kao ocekivano, vrati prazan string umjesto smeca.

---

## Redoslijed implementacije

Predlazem ovaj redoslijed (od najmanje blast radius prema najvecem):

1. **#5** `formatTime` — jedna funkcija
2. **#4** `seasonKey` type + extract — type tightening
3. **#1** Timezone bug — dva mjesta
4. **#2** 400 fieldErrors — komponent + i18n
5. **#3** A11y direktiva — nova datoteka + tri template-a

Svaki kao zaseban commit ili logicki grupirano (npr. 1+2+4 zajedno kao "explore: type safety + validation fixes", 3 zasebno kao "explore: a11y + i18n field errors", 5 zasebno kao "shared: dialog container directive").
