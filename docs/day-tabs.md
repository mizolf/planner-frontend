# Day Tabs (Day Picker) on Trip Detail

## Overview

Adds a horizontal pill-tab picker above the itinerary on the trip detail page. The user clicks a pill to select **one day**, and only that day's content renders below. Default selection is the first day (lowest `dayNumber`).

To match the reference design (where each pill carries a short label like "Arrival & Shibuya"), every day gains a new optional `title` field. The title is also rendered in the section header below the pills.

```
┌────────────────────────────────────────────────────────────────────┐
│ [Day 1 — Arrival & Shibuya] [Day 2  Old Tokyo] [Day 3  Harajuku..] │
├────────────────────────────────────────────────────────────────────┤
│ Day 1 — Arrival & Shibuya                                          │
│ Apr 12 · Sun                                                       │
│                                                                    │
│  14:20  Land at Haneda (HND)                                       │
│  16:00  Check in — Trunk Hotel Yoyogi                              │
│  ...                                                               │
└────────────────────────────────────────────────────────────────────┘
```

## Scope

In:
- New `title` column on `TripDay` and `TemplateDay`.
- DTO + mapper + seed-data updates so titles round-trip end-to-end.
- Existing seed (`templates.json`) migration: move title-like content from `notes` into the new `title` field, leave `notes` null.
- Frontend `TripDayResponse` model + UI: pill picker, single-day view, refactored `TripDayCardComponent`.

Out (Phase 2):
- `+ Day`, `+ Activity`, `Suggest` buttons (CRUD).
- Day-edit dialog (where the user could set a title manually after creation).
- URL state for the selected day (e.g. `?day=3`).

## Backend Changes (`planner-backend`)

### Schema migration

Add `title` (`VARCHAR(255)`, nullable) to both `trip_days` and `template_days`. The project relies on Hibernate `ddl-auto` for schema in dev — the new field on the entity is enough; no Flyway file is required unless one is already in use.

### Entities

**`model/TripDay.java`** — add field:
```java
@Column(nullable = true, length = 255)
private String title;
```

**`model/TemplateDay.java`** — add same field.

### DTOs

| File | Change |
|------|--------|
| `DTO/CreateTripDayDTO.java` | Add `@Size(max=255) private String title;` (optional) |
| `DTO/UpdateTripDayDTO.java` | Add `@Size(max=255) private String title;` (optional) |
| `responses/TripDayResponse.java` | Add `private String title;` |
| `responses/TemplateDayResponse.java` | Add `private String title;` |
| `DTO/seed/TemplateDaySeedData.java` | Add `String title` to record |

### Mappers

**`mapper/TripDayMapper.java`:**
- `toEntity(CreateTripDayDTO dto)` → set `title` from DTO.
- `updateEntity(TripDay day, UpdateTripDayDTO dto)` → if `dto.getTitle() != null` set on entity.
- `toResponse(...)` → include `title` in builder.

**`mapper/TemplateDayMapper.java`:** equivalent updates.

### Template-to-Trip seeding

The path that creates `TripDay` rows from `TemplateDay` (when a user applies a template) must copy `title` along with `dayNumber` and `notes`. Locate this in the template-application service and add the field to the copy.

### Seed data (`src/main/resources/templates.json`)

For all 20 day entries across templates: move the current `notes` content into `title`, set `notes` to `null`. Example:

```json
// before
{ "dayNumber": 1, "notes": "Arrival & Playa d'en Bossa", "activities": [...] }

// after
{ "dayNumber": 1, "title": "Arrival & Playa d'en Bossa", "notes": null, "activities": [...] }
```

The seed loader should accept the new field via the updated `TemplateDaySeedData` record without further changes.

## Frontend Changes (`planner-frontend`)

### Model (`src/app/core/models/trip.model.ts`)

```typescript
export interface TripDayResponse {
  id: number;
  dayNumber: number;
  date: string;
  title: string | null;     // NEW
  notes: string | null;
  activities: ActivityResponse[];
}
```

`TripService` and `TripDetailResponse` need no change — the new field flows through the existing pipeline once the backend returns it.

### New component: `TripDayPickerComponent`

Path: `src/app/features/trips/trip-detail/trip-day-picker.component.{ts,html}`

Inputs:
- `days: TripDayResponse[]` — full list of days, expected pre-sorted by `dayNumber`.
- `selectedDayId: number | null`

Output:
- `selectDay = output<number>()` — emits the clicked day's `id`.

Behavior:
- Renders one pill per day in a horizontal row.
- Pill content:
  - Bold `Day {{ dayNumber }}`
  - If `title` present, append a lighter secondary line/inline label `{{ title }}`. If null, omit.
- Selected pill: `bg-primary text-on-primary` with the same shadow vocabulary used elsewhere on the page.
- Unselected pills: `bg-surface-container-low text-on-surface`, hover deepens background.
- Container is `overflow-x-auto` with `scroll-smooth` and `snap-x snap-mandatory` so long lists scroll cleanly on touch.
- Each pill has `aria-pressed` reflecting selection; container has `role="tablist"` and pills `role="tab"`.
- Long titles (close to 255) truncate via `text-ellipsis` with the full text in `title=""` for tooltip.

### Refactor: `TripDayCardComponent`

Strip the timeline rail layout and rebuild as a "detail" view:
- Remove the desktop circular `Day N` badge column and the connector line.
- Remove the mobile inline "Day N" chip.
- New header:
  - Big title line: `Day {{ dayNumber }}` followed (if `title` present) by ` — {{ title }}`.
  - Subline: full date (`day.date | date:'fullDate'`).
- Activities list stays as today (time gutter + name + location + description), only loses the indentation that the rail enforced.
- `index` and `isLast` inputs become unused — remove them; the component no longer renders in a sequence.

### Page: `TripDetailPageComponent`

State additions:
- Local `selectedDayId = signal<number | null>(null)`.
- `effect()` that watches `trip()`: when the trip loads (or its days change) and `selectedDayId()` is null OR no longer matches an existing day, set it to the first day's `id` (lowest `dayNumber`).
- Computed `selectedDay = computed(() => trip()?.days.find(d => d.id === selectedDayId()) ?? null)`.

Template:
- Replace the existing `@for` over days with:
  - `<app-trip-day-picker [days]="t.days" [selectedDayId]="selectedDayId()" (selectDay)="selectedDayId.set($event)" />`
  - `@if (selectedDay(); as d) { <app-trip-day-card [day]="d" /> }`
- Empty state (zero days) is unchanged — the picker is omitted in that branch.

## i18n

`src/assets/i18n/en.json` and `hr.json` — add under existing `TRIPS.DETAIL.DAYS.*`:

| Key | en | hr |
|-----|----|----|
| `PICKER.ARIA_LABEL` | `Select a day` | `Odaberi dan` |

`TRIPS.DETAIL.DAYS.LABEL` (`Day {{ number }}`) is reused by both pill and header — no change. The `—` separator between `Day N` and `title` is a literal em-dash hard-coded in the template (same character in every locale).

## Edge Cases

| Case | Behavior |
|------|----------|
| 0 days | Picker is not rendered. Existing empty state shows. |
| 1 day | Picker renders with one pill, selected. |
| `title` is null | Pill: `Day N` only. Header: `Day N` only. Date subline still shown. |
| `title` very long | Pill truncates with ellipsis; full value in `title` HTML attribute. Header shows full value. |
| Trip refetch / refresh | `selectedDayId` resets via the effect to first day. (No URL persistence by design.) |
| Mobile, many days | Horizontal scroll with snap on the pill row. |
| `selectedDayId` references a deleted day (Phase 2 concern) | Effect re-runs on `trip()` change and falls back to first day. |

## Implementation Order (high level)

1. **Backend schema + entity:** add `title` to `TripDay` and `TemplateDay`.
2. **Backend DTOs + mappers:** thread `title` through create/update/response.
3. **Backend template-to-trip seeding:** copy `title` when applying a template.
4. **Backend seed JSON:** migrate `notes` → `title` for all 20 entries; null out `notes`.
5. **Run backend, verify** `GET /trips/{id}` returns `title` for a template-seeded trip.
6. **Frontend model:** add `title` to `TripDayResponse`.
7. **Frontend `TripDayPickerComponent`:** new component with pills + selection.
8. **Frontend `TripDayCardComponent`:** refactor to detail layout, drop rail.
9. **Frontend `TripDetailPageComponent`:** wire selection signal + render picker + single day.
10. **i18n keys** for picker.
11. **Manual smoke test:** open a template-seeded trip, click through pills on desktop and mobile widths.

## Non-goals (reminders)

- Editing `title` at runtime (Phase 2 day-edit dialog).
- Persisting selected day across refresh.
- Reordering or filtering days (multi-select).
- "Today" auto-selection logic.

These are revisited when Phase 2 (day CRUD) lands or if real users ask for them.
