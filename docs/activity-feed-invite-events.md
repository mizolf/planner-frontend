# Activity Feed — Invite Events

## Overview

The dashboard activity feed (`ActivityFeedComponent`, sourced from `GET /activity-feed`) is
server-driven: it renders whatever `eventType` values the backend sends, mapping each to a
translation string and an icon. The invite flow added 5 new backend event types under a new
`INVITE` entity type. This change teaches the frontend to render the relevant ones.

**This is a pure frontend rendering task.** The events already flow from the existing
`/activity-feed` endpoint — no service or backend changes.

## Backend contract (already emitted)

The backend emits 5 new `TripEventType` values, all with `entityType = INVITE` and
`entityName = <invitee email>`, `changes = null`:

| eventType | actor | entityName | Notes |
|---|---|---|---|
| `INVITE_SENT` | inviter (owner) | invitee email | Owner sent an invite |
| `INVITE_ACCEPTED` | invitee | invitee email | Paired with a `MEMBER_ADDED` event |
| `INVITE_DECLINED` | invitee | invitee email | |
| `INVITE_CANCELLED` | inviter (owner) | invitee email | |
| `INVITE_EXPIRED` | **null (system job)** | invitee email | No actor — scheduled/lazy expiry |

On **accept**, the backend fires two events:
- `INVITE_ACCEPTED` (actor = invitee), and
- `MEMBER_ADDED` (actor = invitee, `entityId` = invitee's own user id) via
  `materializeMembership`.

Because the old `POST /trips/{id}/members` endpoint was removed (membership is now invite-only),
`MEMBER_ADDED` today *only ever* fires through accept — always a self-add where
`actorId === entityId`. Its current wording ("X added X to Trip") reads awkwardly as a result.

## Decisions

| Decision | Value | Rationale |
|---|---|---|
| Which invite events render | **`INVITE_SENT` only** | Shows the owner's action; the acceptance is covered by the fixed `MEMBER_ADDED` row instead, avoiding two near-duplicate "accepted / joined" rows |
| Hidden events | `INVITE_ACCEPTED`, `INVITE_DECLINED`, `INVITE_CANCELLED`, `INVITE_EXPIRED` | Reduce noise; accept is shown via `MEMBER_ADDED` |
| How events are hidden | Filtered out by a computed (no translation key) | Robust: also drops any unknown future backend event instead of rendering a blank row |
| `MEMBER_ADDED` wording | "X joined Trip" when `actorId === entityId` | Fixes the awkward self-add; complements the `INVITE_SENT` row |
| `INVITE` entity icon | `forward_to_inbox` | Material Symbols outlined, consistent with existing icon set |

### Resulting feed across a full invite lifecycle

> **Ana** invited **bob@mail.com** to **Rome Getaway** &nbsp;← `INVITE_SENT`
> **Bob** joined **Rome Getaway** &nbsp;← `MEMBER_ADDED` (self-add → "joined")

Declined / cancelled / expired produce no visible feed rows.

## The render-or-break constraint

`EVENT_TRANSLATION_KEYS` is a lookup. If the backend sends an `eventType` with no entry, the
`translate` pipe receives `undefined` and the row renders blank. So every event the backend can
emit must be *handled* — either rendered or explicitly filtered. We handle this with a single
guard: the `visibleActivities` computed keeps only items whose `eventType` has a translation
key. The 4 hidden invite events (and any future unknown event) drop out cleanly.

## Changes

### 1. `src/app/core/models/activity.model.ts`

- Extend `ActivityEventType` with all 5 invite values (so the type accurately reflects what the
  backend can send, even the ones we hide):
  `INVITE_SENT | INVITE_ACCEPTED | INVITE_DECLINED | INVITE_CANCELLED | INVITE_EXPIRED`.
- Extend `EntityType` with `INVITE`.

### 2. `src/app/features/activity-feed/activity-feed.component.ts`

- Change `EVENT_TRANSLATION_KEYS` from `Record<ActivityEventType, string>` to
  `Partial<Record<ActivityEventType, string>>`. Add one entry: `INVITE_SENT`. Add a
  `MEMBER_JOINED` key used by the conditional below. Do **not** add entries for the 4 hidden
  invite events.
- `getTranslationKey(item)`: when `item.eventType === 'MEMBER_ADDED'` and `item.actorId != null`
  and `item.actorId === item.entityId`, return the `MEMBER_JOINED` key; otherwise the normal
  lookup.
- Add `INVITE: 'forward_to_inbox'` to `ENTITY_ICONS` (required — `EntityType` now includes
  `INVITE`).
- Add a computed:
  `visibleActivities = computed(() => this.activities().filter(a => EVENT_TRANSLATION_KEYS[a.eventType] != null))`.
- Template (`activity-feed.component.html`): iterate `visibleActivities()` instead of
  `activities()`; the empty-state check uses `visibleActivities().length === 0`. Loading/error
  branches unchanged.

### 3. `public/assets/i18n/en.json` and `hr.json`

Add under `ACTIVITY_FEED.EVENTS`:

| Key | EN | HR |
|---|---|---|
| `INVITE_SENT` | `<strong>{{actor}}</strong> invited <em>{{entity}}</em> to <em>{{trip}}</em>.` | `<strong>{{actor}}</strong> je pozvao/la <em>{{entity}}</em> na <em>{{trip}}</em>.` |
| `MEMBER_JOINED` | `<strong>{{actor}}</strong> joined <em>{{trip}}</em>.` | `<strong>{{actor}}</strong> se pridružio/la putovanju <em>{{trip}}</em>.` |

`{{entity}}` resolves to `entityName` (the invitee email) via the existing
`getTranslationParams`. No new params needed.

## Edge cases

- **Unknown future eventType** → filtered by `visibleActivities`, renders nothing (no blank row).
- **Null actor** → only `INVITE_EXPIRED` had a null actor, and it is hidden, so the existing
  "Deleted user" fallback is never triggered by an invite event. `INVITE_SENT` (owner) and
  `MEMBER_ADDED` (invitee) always have a real actor.
- **Avatar / initial / color** → driven by `actorName`, non-null for both rendered events.
- **`MEMBER_ADDED` from a non-self add** (if admin-add is ever reintroduced) → `actorId !==
  entityId`, falls through to the existing `MEMBER_ADDED` wording. The guard is defensive, not
  assumed-always-true.

## Risks / notes

- **VIEWER visibility:** the backend privacy rule hides only `MEMBER` entityType events from
  VIEWERs. `INVITE` events are **not** hidden, so a VIEWER on a trip will see `INVITE_SENT`
  rows ("Ana invited bob@…"). This is a backend contract decision; the frontend cannot filter
  it and renders whatever the feed returns. Out of scope here — flagged for awareness.
- **Pagination count:** hidden events still count toward the backend page size, so a page of 20
  may render fewer than 20 visible rows. Acceptable for the dashboard sidebar; not worth a
  client-side refetch.

## Verification (manual smoke)

1. Owner sends an invite → feed shows "**Owner** invited **email** to **Trip**".
2. Invitee accepts → feed shows "**Invitee** joined **Trip**" (not "added Invitee to Trip"); no
   separate "accepted" row appears.
3. Decline / cancel an invite → no new feed row appears.
4. Existing events (trip/day/activity/member-role/member-removed) still render unchanged.
5. HR and EN locales both render the two new strings correctly.
