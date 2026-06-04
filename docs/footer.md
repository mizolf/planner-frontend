# Dashboard Footer Spec

## Problem / Goal

The authenticated app shell (`dashboard-layout.component.html`) renders a sticky navbar + a `<main>` with the routed page — there is **no footer**. Every protected page (`/home`, `/my-trips`, `/explore`, `/invites`, `/trips/:id`) ends abruptly at the bottom of its content.

Add a **rich multi-column footer** to the shared dashboard shell so it appears once across all protected pages. It should:
- Reinforce the `plannr.` brand and the app's "premium editorial" aesthetic.
- Provide quick navigation to the main product pages + placeholder legal links.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Layout | Rich multi-column (brand + tagline / Product links / Legal links / bottom bar) | Confirmed with user; fits the editorial aesthetic |
| Language switcher | **Not in footer** — deferred to the navbar (separate, later task) | User chose to relocate it; out of scope here |
| Legal links | Placeholder `href="#"` | No legal pages exist; mirrors `auth-layout` |
| Placement | After `</main>`; `<main>` min-height unchanged | Standard footer behavior; keeps shell simple |

## Component

**Location:** `src/app/shared/components/footer/footer.component.{ts,html}`

**`footer.component.ts`** — standalone, minimal:
- `selector: 'app-footer'`
- `imports: [RouterLink, TranslateModule]`
- `year = new Date().getFullYear()` (readonly, for the copyright string)
- No `TranslateService` injection needed — the template only uses the `| translate` pipe.

## Template / Layout

Semantic `<footer role="contentinfo">`. Tailwind + Material 3 tokens, matching navbar/auth styling.

- **Wrapper:** `border-t border-outline-variant/15 bg-surface-container-low px-6 lg:px-10 py-10`
- **Top grid** (`grid grid-cols-1 md:grid-cols-3 gap-8`):
  - **Brand column:** `plannr.` logo (`text-primary font-headline text-2xl font-bold tracking-tighter`) + tagline (`text-on-surface-variant text-sm`, key `FOOTER.TAGLINE`).
  - **Product column:** uppercase heading (`text-[10px] font-label uppercase tracking-widest text-on-surface-variant`, key `FOOTER.PRODUCT`) + `routerLink` links: `/home` (`NAV.DASHBOARD`), `/my-trips` (`NAV.MY_TRIPS`), `/explore` (`NAV.EXPLORE`), `/invites` (`FOOTER.INVITES`). Link style: `text-sm font-label text-on-surface-variant hover:text-primary transition-colors`.
  - **Legal column:** heading (`FOOTER.LEGAL`) + placeholder `href="#"` links: `FOOTER.PRIVACY`, `FOOTER.TERMS`, `FOOTER.SUPPORT`.
- **Bottom bar** (`pt-8 mt-8 border-t border-outline-variant/10`):
  - **Copyright:** `{{ 'FOOTER.COPYRIGHT' | translate:{ year } }}`, style `text-[10px] font-label uppercase tracking-widest text-on-surface-variant/40`.

### Layout sketch

```
────────────────────────────────────────────────
 plannr.            PRODUCT       LEGAL
 Plan beautiful     Dashboard     Privacy
 trips together.    My Trips      Terms
                    Explore       Support
                    Invites
────────────────────────────────────────────────
 © 2026 plannr. All rights reserved.
────────────────────────────────────────────────
```

Mobile (< md): the three columns stack vertically.

## Wiring into the shell

- `dashboard-layout.component.ts`: import `FooterComponent`, add to the standalone `imports` array.
- `dashboard-layout.component.html`: add `<app-footer />` immediately **after** `</main>` (current line 16). `<main>` keeps `min-h-[calc(100vh-4rem)]`.

## i18n

New top-level `FOOTER` block in both `public/assets/i18n/en.json` and `hr.json`. Product link labels reuse existing `NAV.*` keys.

**en.json**
```json
"FOOTER": {
  "TAGLINE": "Plan beautiful trips together.",
  "PRODUCT": "Product",
  "LEGAL": "Legal",
  "INVITES": "Invites",
  "PRIVACY": "Privacy",
  "TERMS": "Terms",
  "SUPPORT": "Support",
  "COPYRIGHT": "© {{year}} plannr. All rights reserved."
}
```

**hr.json**
```json
"FOOTER": {
  "TAGLINE": "Planirajte lijepa putovanja zajedno.",
  "PRODUCT": "Proizvod",
  "LEGAL": "Pravno",
  "INVITES": "Pozivnice",
  "PRIVACY": "Privatnost",
  "TERMS": "Uvjeti",
  "SUPPORT": "Podrška",
  "COPYRIGHT": "© {{year}} plannr. Sva prava pridržana."
}
```

## Reused Patterns
- Brand logo / nav link / small-label styling: `navbar.component.html`, `auth-layout.component.html`.
- Standalone component conventions: `navbar.component.ts`, home page component.

## Verification
- `npm start`, log in, land on `/home`:
  - Footer renders at the bottom: three columns + bottom bar.
  - Product links navigate to `/home`, `/my-trips`, `/explore`, `/invites`.
  - Narrow viewport (< md) → columns stack, layout stays readable.
  - Footer appears on `/my-trips`, `/explore`, `/invites`, `/trips/:id` too.
- `ng build` completes with no template/TS errors.
```
