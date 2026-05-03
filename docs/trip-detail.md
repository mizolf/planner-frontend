# Trip Detail Page

## Overview

The trip detail page (`/trips/:id`) is the destination view for a single trip. It renders the full `TripDetailResponse` from the backend — trip core fields, day-by-day itinerary with activities, and the members list — and is the surface from which trip planning happens (editing days, adding activities, managing the team).

The page is delivered in two phases:

| Phase | Status | Scope |
|-------|--------|-------|
| 1. Read-only view | Shipped | Renders all `TripDetailResponse` data. No edits. |
| 2. Full CRUD | Planned | Inline trip-header edits, day/activity CRUD, member management. |

The current branch ships Phase 1. Phase 2 is documented below in detail so the read-only architecture can grow into it without rework.

## Routing

```
/trips/:id  →  TripDetailPageComponent (lazy, nested under DashboardLayoutComponent → inherits authGuard + navbar)
```

The detail page is a child of `DashboardLayoutComponent` so it inherits the auth guard and navbar but renders its own full-bleed content (no sidebar). Invalid id (`/trips/abc`) does not crash — the component skips the HTTP call and the user sees a static blank state until they navigate away. Backend 4xx maps to in-page error blocks (see Error Handling).

## Authorization Model

The backend already enforces role-based access. The frontend reflects this by only showing UI affordances the user can act on. The current user's role for the trip is derived from the `members` list in `TripDetailResponse` — match `userId` against `UserService.currentUser()`.

| Action | OWNER | EDITOR | VIEWER |
|--------|:-:|:-:|:-:|
| View trip | ✓ | ✓ | ✓ |
| Edit trip name / description / dates / budget / interests / status | ✓ | ✓ | — |
| Delete trip | ✓ | — | — |
| Add / edit / delete days | ✓ | ✓ | — |
| Add / edit / delete activities | ✓ | ✓ | — |
| Invite member | ✓ | — | — |
| Change member role | ✓ | — | — |
| Remove member | ✓ | — | — |
| Leave trip (remove self) | — | ✓ | ✓ |

A `TripPermissionsService` (planned for Phase 2) exposes computed signals: `canEdit`, `canManageMembers`, `canDeleteTrip`. Components read these to enable / disable / hide affordances.

## Page Anatomy

```
TripDetailPageComponent (route)
├── Loading skeleton (header + 3 ghost day cards)
├── Error block (in-page; per kind)
└── Loaded
    ├── TripDetailHeaderComponent
    │   ├── Back link → /home
    │   ├── Destination kicker
    │   ├── Trip name (display)
    │   ├── Description (italic display)
    │   ├── Member avatar stack (top-right; +N overflow)
    │   ├── Meta row (dates · status pill · budget)
    │   └── Interest chips
    ├── Itinerary section
    │   ├── Empty state (when zero days)
    │   └── TripDayCardComponent[] (vertical timeline rail)
    │       ├── Day badge (rail, desktop) / inline chip (mobile)
    │       ├── Kicker: "Day N · <date>"
    │       ├── Notes (italic pull-quote, optional)
    │       └── Activities list (time, name, location, description) or empty line
    └── TripMembersSectionComponent
        └── Member cards grid (avatar, name, email, role chip, joined date)
```

## Phase 1 — Read-only (shipped)

### Files

```
src/app/features/trips/trip-detail/
├── trip-detail-page.component.{ts,html}     # Route entry, branches loading/error/data
├── trip-detail-header.component.{ts,html}   # Header band + avatar stack
├── trip-day-card.component.{ts,html}        # One day on the timeline rail
└── trip-members-section.component.{ts,html} # Members grid

src/app/shared/utils/
├── format-time.ts          # Regex HH:mm:ss → HH:mm
├── initials.ts             # Initials from full name for avatars
├── member-role-color.ts    # Role chip color mapping
└── trip-status-color.ts    # Status pill color mapping (extracted from TripCardComponent)
```

### Models added (`src/app/core/models/trip.model.ts`)

```typescript
export type MemberRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface ActivityResponse {
  id: number;
  name: string;
  description: string | null;
  location: string | null;
  startTime: string | null;     // 'HH:mm:ss'
  endTime: string | null;
}

export interface TripDayResponse {
  id: number;
  dayNumber: number;
  date: string;                 // 'YYYY-MM-DD'
  notes: string | null;
  activities: ActivityResponse[];
}

export interface TripMemberResponse {
  userId: number;
  fullName: string;
  email: string;
  role: MemberRole;
  joinedAt: string;             // ISO datetime
}

export interface TripDetailResponse extends TripResponse {
  days: TripDayResponse[];
  members: TripMemberResponse[];
}

export type TripDetailErrorKind = 'NOT_FOUND' | 'NO_ACCESS' | 'UNAUTHENTICATED' | 'GENERIC';
```

### TripService additions

Mirrors the existing `_trips / _loading / _error` triplet:

| Signal | Type | Purpose |
|--------|------|---------|
| `tripDetail` | `TripDetailResponse \| null` | Currently loaded trip detail. |
| `detailLoading` | `boolean` | True while GET in flight. |
| `detailError` | `TripDetailErrorKind \| null` | Error kind from last load. |

Methods:
- `loadTripDetail(id)` — GET `/trips/{id}`, populates signals, maps HTTP status → `TripDetailErrorKind` (401/403/404/other).
- `clearTripDetail()` — resets all three signals; called from page `ngOnDestroy`.

## Phase 2 — Full CRUD (planned)

This section is the implementation contract for the editable trip detail page. Each entity gets its own service file added alongside `TripService` so concerns stay isolated as the surface grows.

### 2.1 Trip-level edits

#### What's editable

| Field | UI affordance | Validation |
|-------|---------------|------------|
| `name` | Inline (click name → input → blur to save, Esc to cancel) | required, max 255 |
| `description` | Inline-expanding textarea below the title | max 255 |
| `destination` | Inline below kicker | required, max 255 |
| `startDate`, `endDate` | "Edit dates" pencil icon → small modal with two date inputs | required; end ≥ start |
| `budget` | Inline number input in meta row | optional; 0 ≤ budget ≤ 999,999.99 |
| `status` | Dropdown on the status pill | one of `PLANNING / UPCOMING / IN_PROGRESS / COMPLETED` |
| `interests` | "Edit interests" → multi-select dialog | none |

Inline edits are pessimistic (save on blur, show spinner inline; on error revert and toast). Date edits go through a modal because changing dates can invalidate days outside the new range — show that warning in the modal before submit.

#### Endpoint

`PUT /trips/{tripId}` with `UpdateTripDTO` (all fields optional). Response is the updated `TripResponse` — merge into `_tripDetail` while preserving `days` and `members`.

#### Delete trip

Owner-only "Delete trip" action lives in a header overflow menu (⋮). Triggers a confirmation modal: "Delete _Trip Name_? This cannot be undone." Type-to-confirm if we want extra safety (typing the trip name). On success: toast, navigate to `/home`, remove trip from `TripService.trips()`.

### 2.2 Day CRUD

#### Add day

Trigger: "Add day" button at the bottom of the itinerary section (visible only to OWNER/EDITOR). Opens a small dialog:

| Field | Validation |
|-------|------------|
| `dayNumber` | required, > 0, suggested = `max(existing)+1` |
| `date` | required, must fall within trip startDate–endDate |
| `notes` | optional, free text |

Endpoint: `POST /trips/{tripId}/days` → `TripDayResponse`. On success: append to `_tripDetail.days`, sorted by `dayNumber`, then close dialog and toast.

#### Edit day

Trigger: pencil icon on each day card (hover-revealed on desktop, always visible mobile). Opens the same dialog as Add, prefilled. Endpoint: `PUT /trips/{tripId}/days/{dayId}`.

Day notes specifically should also support inline edit (click pull-quote → textarea), saved with the same PUT and only the `notes` field.

#### Delete day

Trigger: trash icon next to pencil. Confirmation modal: "Delete Day N? All N activities will be removed." Endpoint: `DELETE /trips/{tripId}/days/{dayId}`. On success: remove from `_tripDetail.days`, toast.

#### Reorder days

Backend has no reorder endpoint as of writing. Two options when this is built:

1. **Add backend endpoint** `PATCH /trips/{tripId}/days/reorder` accepting an ordered list of day ids. Frontend sends new order on drag end. Cleanest.
2. **Reuse PUT and bump dayNumbers** — frontend issues N PUT calls. Simpler backend-side; chattier and less atomic.

Option 1 is the preferred path. Until then, drag-and-drop is out of scope; users can edit `dayNumber` manually via the edit dialog.

### 2.3 Activity CRUD

Activities live inside day cards. Editing UX should keep the user in context — open dialogs anchored near the activity, not full-screen modals.

#### Add activity

Trigger: "+ Add activity" button at the bottom of each day card's activity list (visible only to OWNER/EDITOR). Dialog:

| Field | Validation |
|-------|------------|
| `name` | required, max 255 |
| `description` | optional, max 255 |
| `location` | optional, max 255 |
| `startTime` | optional, `HH:mm` |
| `endTime` | optional, `HH:mm`, must be ≥ startTime if both set |

Endpoint: `POST /trips/{tripId}/days/{dayId}/activities`. On success: append to the day's `activities`, sorted by `startTime` (nulls last), close, toast.

#### Edit activity

Trigger: click anywhere on the activity row (or pencil icon for accessibility). Same dialog as Add, prefilled. Endpoint: `PUT /trips/{tripId}/days/{dayId}/activities/{activityId}`.

#### Delete activity

Trigger: trash icon on the activity row. Inline confirmation (no modal — keep flow tight): "Delete? Yes / Cancel". Endpoint: `DELETE /trips/{tripId}/days/{dayId}/activities/{activityId}`.

#### Move activity to another day

Backend has no move endpoint. To support this, the frontend would: (a) DELETE the activity from the source day, then (b) POST a copy to the target day. Two calls, not atomic — risky if step (b) fails. Defer until backend adds a move endpoint or until the UX is requested.

### 2.4 Member management

OWNER-only section. Members section gains an action row.

#### Invite member

Trigger: "Invite traveler" button in the members section header. Dialog:

| Field | Validation |
|-------|------------|
| `email` | required, valid email format |
| `role` | required, one of `EDITOR / VIEWER` (not OWNER) |

Endpoint: `POST /trips/{tripId}/members` with `AddTripMemberDTO`. Errors:

| Status | Meaning | UI |
|--------|---------|----|
| 400 fieldErrors.email | Invalid format | inline under email input |
| 409 | Already a member | inline error |
| 5xx (user not found in system) | Email not registered | inline error: "No user found with this email." |

On success: append to `_tripDetail.members`, toast.

#### Change role

Trigger: role chip on member card → dropdown (`EDITOR / VIEWER`). Cannot change OWNER's role; chip is non-interactive on owner row. Cannot change own role; chip is non-interactive on self-row.

Endpoint: `PUT /trips/{tripId}/members/{userId}`. Optimistic update — change chip immediately; on error, revert and toast.

#### Remove member

Trigger: small "remove" affordance revealed on hover (desktop) / always shown (mobile). Confirmation: "Remove _Name_ from this trip?" Cannot remove OWNER. Cannot remove self via this action — see "Leave trip" below.

Endpoint: `DELETE /trips/{tripId}/members/{userId}`. On success: remove from list, toast.

#### Leave trip

For non-OWNER members, a "Leave trip" action lives in the header overflow menu. Confirmation: "Leave _Trip Name_? You'll lose access until invited again."

Endpoint: same DELETE `/trips/{tripId}/members/{userId}` with current user's id. On success: navigate to `/home`, toast, remove trip from `TripService.trips()`.

## Data Flow & State Management

```
GET /trips/{id}
    ↓
TripService.loadTripDetail(id)
    ↓
_tripDetail / _detailLoading / _detailError signals
    ↓
TripDetailPageComponent (orchestrator)
    ↓ (passed as input)
TripDetailHeaderComponent / TripDayCardComponent[] / TripMembersSectionComponent
```

For Phase 2, mutations follow this pattern:

```
User action
    ↓
Component calls TripDetailMutationsService.method(...)
    ↓ (optimistic) immediately update _tripDetail signal
    ↓ HTTP call
       ├─ success → no-op (state already correct), toast
       └─ error   → revert _tripDetail to pre-action snapshot, surface error
```

Optimistic updates apply to: role change, day notes inline edit, activity reordering by time. Pessimistic (await response, show spinner) for: create operations (need server id), delete trip / leave trip (navigation), invite member (need server-resolved user record).

A `TripDetailMutationsService` should be added in Phase 2 alongside `TripService`. It owns no state; it accepts the current `_tripDetail` writable from `TripService` and applies mutations through it. Splitting reads (`TripService`) from writes (`TripDetailMutationsService`) keeps the file sizes manageable as CRUD lands.

## Error Handling

### Page-level (load errors)

| Status | `TripDetailErrorKind` | Display |
|--------|----------------------|---------|
| 401 | `UNAUTHENTICATED` | In-page error block: "Please sign in." Auth interceptor may also redirect to `/auth/login` first. |
| 403 | `NO_ACCESS` | "No access to this trip." |
| 404 | `NOT_FOUND` | "Trip not found." |
| else | `GENERIC` | "Something went wrong." |

All four render the same component shape: icon + title + message + "Back to dashboard" button.

### Mutation errors (Phase 2)

The backend's `GlobalExceptionHandler` returns either:

```json
// Field-level validation errors
{ "status": 400, "message": "Validation failed", "fieldErrors": { "name": "...", "endDate": "..." } }

// Custom domain errors
{ "status": 400, "message": "End date must be after start date" }
```

Pattern for components:

1. Catch `HttpErrorResponse` in the mutation pipeline.
2. If `fieldErrors` is present, map each key to the matching reactive form control via `setErrors({ server: i18nKey })` and surface in the existing `FormFieldComponent` error slot.
3. Otherwise, surface `message` (or a generic i18n key if absent) via `ToastService`.

This pattern repairs the regression flagged in `docs/explore-fixes.md` issue #2 — `apply-template-dialog` ignores `fieldErrors`.

## Backend Contract

All endpoints are already implemented. Source of truth: `TripController`, `TripDayController`, `ActivityController`, `TripMemberController` in `planner-backend`. Authorization is enforced server-side; the frontend matrix above is for UX gating only.

| Method | Path | Body DTO | Response | Role |
|--------|------|----------|----------|------|
| GET | `/trips` | — | `TripResponse[]` | VIEWER+ |
| POST | `/trips` | `CreateTripDTO` | `TripResponse` | (creator becomes OWNER) |
| GET | `/trips/{tripId}` | — | `TripDetailResponse` | VIEWER+ |
| PUT | `/trips/{tripId}` | `UpdateTripDTO` | `TripResponse` | EDITOR+ |
| DELETE | `/trips/{tripId}` | — | 204 | OWNER |
| POST | `/trips/{tripId}/days` | `CreateTripDayDTO` | `TripDayResponse` | EDITOR+ |
| PUT | `/trips/{tripId}/days/{dayId}` | `UpdateTripDayDTO` | `TripDayResponse` | EDITOR+ |
| DELETE | `/trips/{tripId}/days/{dayId}` | — | 204 | EDITOR+ |
| POST | `/trips/{tripId}/days/{dayId}/activities` | `CreateActivityDTO` | `ActivityResponse` | EDITOR+ |
| PUT | `/trips/{tripId}/days/{dayId}/activities/{activityId}` | `UpdateActivityDTO` | `ActivityResponse` | EDITOR+ |
| DELETE | `/trips/{tripId}/days/{dayId}/activities/{activityId}` | — | 204 | EDITOR+ |
| POST | `/trips/{tripId}/members` | `AddTripMemberDTO` | `TripMemberResponse` | OWNER |
| PUT | `/trips/{tripId}/members/{userId}` | `UpdateTripMemberDTO` | `TripMemberResponse` | OWNER |
| DELETE | `/trips/{tripId}/members/{userId}` | — | 204 | OWNER |

All updates are full PUTs (no PATCH). Sending only changed fields is supported because all `Update*DTO` fields are optional — but the response is the full updated entity, so callers should replace the local copy rather than merge.

### Validation envelope

```json
{
  "status": 400,
  "message": "Validation failed",
  "fieldErrors": {
    "endDate": "End date must be after start date.",
    "budget": "Budget must be a positive number."
  }
}
```

Custom domain errors omit `fieldErrors` and put a human-readable string in `message`.

## Translation Keys

All under `TRIPS.DETAIL.*`. Phase 1 keys (shipped):

| Key | Purpose |
|-----|---------|
| `BACK` | Back link label |
| `DESTINATION_KICKER` | Header kicker label ("Destination") |
| `DATE_SEPARATOR` | "–" between start/end |
| `BUDGET_LABEL` | "Budget" |
| `INTERESTS_TITLE` | (reserved) |
| `ROLE.{OWNER \| EDITOR \| VIEWER}` | Role chip text |
| `MEMBERS.{TITLE,SUBTITLE,JOINED_AT,OVERFLOW,EMPTY}` | Members section copy |
| `DAYS.{TITLE,LABEL,NOTES_LABEL,NO_ACTIVITIES}` | Itinerary copy |
| `DAYS.EMPTY.{TITLE,MESSAGE}` | Empty trip state |
| `LOADING` | Skeleton fallback |
| `ERROR.{NOT_FOUND \| NO_ACCESS \| UNAUTHENTICATED \| GENERIC}.{TITLE,MESSAGE}` | In-page error blocks |
| `ERROR.BACK_TO_DASHBOARD`, `ERROR.RETRY` | Error CTAs |

Phase 2 keys to add (planned):

| Key | Purpose |
|-----|---------|
| `EDIT.SAVE_FAILED` | Generic save failure toast |
| `EDIT.SAVE_SUCCESS` | Generic save success toast |
| `EDIT.{NAME,DESCRIPTION,DESTINATION,BUDGET,DATES,STATUS,INTERESTS}.{LABEL,PLACEHOLDER,VALIDATION.*}` | Inline edits |
| `DELETE.TRIP.{CTA,CONFIRM_TITLE,CONFIRM_MESSAGE,SUCCESS}` | Delete trip flow |
| `DAYS.ADD.{CTA,DIALOG_TITLE,DAY_NUMBER_LABEL,DATE_LABEL,DATE_OUT_OF_RANGE,NOTES_LABEL,SUBMIT,SUCCESS}` | Add day dialog |
| `DAYS.EDIT.{CTA,DIALOG_TITLE,SUBMIT,SUCCESS}` | Edit day dialog |
| `DAYS.DELETE.{CTA,CONFIRM_TITLE,CONFIRM_MESSAGE,SUCCESS}` | Delete day flow |
| `ACTIVITY.ADD.{CTA,DIALOG_TITLE,NAME_LABEL,DESCRIPTION_LABEL,LOCATION_LABEL,START_TIME_LABEL,END_TIME_LABEL,END_BEFORE_START,SUBMIT,SUCCESS}` | Add activity |
| `ACTIVITY.EDIT.{CTA,DIALOG_TITLE,SUBMIT,SUCCESS}` | Edit activity |
| `ACTIVITY.DELETE.{INLINE_CTA,CONFIRM,CANCEL,SUCCESS}` | Delete activity |
| `MEMBERS.INVITE.{CTA,DIALOG_TITLE,EMAIL_LABEL,EMAIL_INVALID,ROLE_LABEL,ROLE.{EDITOR,VIEWER},SUBMIT,SUCCESS}` | Invite |
| `MEMBERS.INVITE.{ALREADY_MEMBER,USER_NOT_FOUND}` | Invite errors |
| `MEMBERS.ROLE_CHANGE.{SUCCESS,FAILED}` | Role change |
| `MEMBERS.REMOVE.{CTA,CONFIRM_TITLE,CONFIRM_MESSAGE,SUCCESS}` | Remove member |
| `LEAVE.{CTA,CONFIRM_TITLE,CONFIRM_MESSAGE,SUCCESS}` | Leave trip |

Both `en.json` and `hr.json` mirror the namespace.

## Component Structure

Phase 1 (current):

```
TripDetailPageComponent
├── TripDetailHeaderComponent
├── TripDayCardComponent (×N)
└── TripMembersSectionComponent
```

Phase 2 (planned additions, shown indented under their parents):

```
TripDetailPageComponent
├── (NEW) TripPermissionsService — computed signals on member role
├── (NEW) TripDetailMutationsService — owns Phase 2 HTTP writes
├── (NEW) TripActionMenuComponent — header overflow menu (delete trip, leave trip)
├── TripDetailHeaderComponent
│   └── (NEW) InlineTextEditDirective / InlineNumberEditDirective — reusable inline-edit wrappers
│   └── (NEW) TripDatesEditDialogComponent
│   └── (NEW) TripInterestsEditDialogComponent
│   └── (NEW) TripStatusDropdownComponent
├── TripDayCardComponent
│   └── (NEW) TripDayEditDialogComponent (used for both add + edit)
│   └── (NEW) ActivityRowComponent — extracted from inline so edit/delete affordances have a home
│       └── (NEW) ActivityEditDialogComponent
└── TripMembersSectionComponent
    └── (NEW) MemberRoleDropdownComponent
    └── (NEW) InviteMemberDialogComponent
```

Activity rows stay inline in `trip-day-card.component.html` for Phase 1; they get extracted in Phase 2 because edit / delete affordances and per-row state push them past the "premature abstraction" threshold.

## Open Questions

1. **Reorder days / move activities** — both need backend support. Add `PATCH /trips/{id}/days/reorder` and `PATCH /trips/{id}/days/{srcDayId}/activities/{actId}/move?targetDayId=N`? Or accept the chatty multi-PUT path?
2. **Inline edit interaction model** — click-to-edit vs hover-pencil vs always-on inputs in an "edit mode" toggle? Click-to-edit is the most common Notion-like pattern; needs careful focus / esc / blur handling.
3. **Locking dates** — when trip startDate/endDate change, days outside the new range become orphaned. Block the date change, warn-and-prune, or accept orphaned days and surface them visually?
4. **Status auto-advancement** — should `status` flip to `IN_PROGRESS` automatically on `startDate`, and to `COMPLETED` on `endDate + 1`? If yes, that's a backend concern (cron) but the UI should reflect it without a manual reload.
5. **Currency** — `budget` is currently rendered as a bare number with `1.0-2` formatting. Add a per-trip currency code? Currently every trip is implicitly EUR-shaped.
6. **Conflict resolution** — two editors saving simultaneously, last write wins. Add ETag / `If-Match` later if it becomes a real problem.
7. **Activity icons / categories** — currently activities have no type. Adding `category` (e.g., FOOD, MUSEUM, TRANSPORT) would let us decorate rows with iconography.
