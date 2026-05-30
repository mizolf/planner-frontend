# Follow-ups

Backlog of features to add or change. These are captured as-is for later refinement —
nothing here is a committed plan yet. Each item notes the current state (where relevant)
and the open questions to resolve before implementing.

---

## 1. Limit the activity feed view

**Now:** `app-activity-feed` lives in the home-page sidebar (`home-page.component.html`)
and loads recent activities via `ActivityFeedService.loadRecentActivities()` with no
visible cap.

**Goal:** give the feed a limited / bounded view instead of an open-ended list.

**Open questions:**
- How to limit — cap the item count (e.g. show latest N), collapse with a "view all" link,
  or paginate?
- If "view all" — does it link to a dedicated full activity page or expand in place?
- Should the limit differ between the dashboard sidebar and any future full view?

---

## 2. My Trips & Explore pages

**Now:** the navbar "My Trips" and "Explore" links both point to `/home` (placeholders).
There are no dedicated routes. Trip cards and the explore section currently render inside
the home dashboard.

**Goal:** implement My Trips and Explore as real, navigable pages.

**Open questions:**
- Dedicated routed pages (`/trips`, `/explore`) vs. keeping everything on `/home` with
  clearer sections?
- If dedicated pages — what does the home dashboard become (overview + activity only)?
- What does each page show: My Trips = all the user's trips with filtering/sorting;
  Explore = templates / styles already built in `features/explore`?

---

## 3. My Profile page

**Now:** "My Profile" in the avatar dropdown (`navbar.component.html`) points to `/home`.
No profile page exists.

**Goal:** implement a My Profile page.

**Open questions:**
- What does it contain — account info, editable fields (name, email, interests),
  avatar, password change?
- Read-only view vs. edit form, or both?
- Route (`/profile`) and where it lives in the app structure.

---

## 4. Notifications bell — decide direction

**Now:** the bell in the navbar links to `/invites` and its badge shows `pendingCount()`
(pending invites only).

**Goal:** decide what the bell should be. Two directions to weigh later:
- **Keep as pending invites only** — leave it scoped to invites, just polish.
- **Rebuild into a full notification center** — invites + activity events, with
  read/unread state and a dedicated notifications surface.

**To think about:** which direction fits the product, and what the backend would need
to support a real notification model.

---

## 5. Complete UI redesign

**Goal:** consider a full UI redesign of the app.

**To think about:** scope and ambition — incremental polish of the current design system
vs. a ground-up redesign. Revisit once the items above are clearer, since pages added
above will shape the overall layout.
