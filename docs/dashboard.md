# Dashboard Home Page

## Overview

The dashboard (`/home`) is the landing page after login. It provides an overview of the user's travel plans with quick stats, upcoming trip countdown, recent trip cards, and a CTA to create new trips.

## Data Flow

```
Backend: GET /trips
    ↓
TripService.loadTrips()
    ↓
Private signals: _trips, _loading, _error
    ↓
Public readonly signals: trips, loading, error
    ↓
HomePageComponent computed signals:
    ├── totalTrips      (trips.length)
    ├── upcomingCount   (filter by UPCOMING status)
    ├── inProgressCount (filter by IN_PROGRESS status)
    ├── nextTrip        (soonest UPCOMING trip with future startDate)
    ├── daysUntilNextTrip (diff between today and nextTrip.startDate)
    ├── recentTrips     (top 4 sorted by updatedAt desc)
    └── hasTrips        (boolean for empty state)
    ↓
Template sections (conditional rendering via @if)
```

User data is fetched separately by `DashboardLayoutComponent` via `UserService.loadCurrentUser()` — the layout blocks rendering until user data is ready. Trip data is fetched by the home page component itself in `ngOnInit`.

## Component Structure

```
DashboardLayoutComponent (fetches user, renders navbar + router-outlet)
├── NavbarComponent (reads UserService.currentUser for avatar)
└── HomePageComponent (fetches trips, renders dashboard)
        ├── Loading state (skeleton placeholder)
        ├── Error state (message + retry button)
        ├── Empty state (icon + text + CTA for zero trips)
        └── Dashboard (greeting, stats, countdown, trip cards, CTA)
```

No sub-components — the entire dashboard is a single template. Extract trip cards into a shared component when they're reused on the My Trips page.

## Template Sections

### 1. Greeting
- Time-of-day greeting: "Good morning/afternoon/evening, {firstName}!"
- Computed once on component init (not reactive to clock changes)

### 2. Quick Stats Row (3 cards)
| Card | Color Token | Icon | Value |
|------|-------------|------|-------|
| Total Trips | `primary` | `luggage` | `totalTrips()` |
| Upcoming | `secondary` | `schedule` | `upcomingCount()` |
| In Progress | `tertiary` | `flight_takeoff` | `inProgressCount()` |

### 3. Next Trip Countdown (conditional)
Shown only when `nextTrip()` exists. Displays trip name, destination, date, and a large "X days to go" number.

### 4. Recent Trips Grid (up to 4 cards)
Each card shows:
- Status badge (tonal: `bg-{color}/10 text-{color}`)
- Trip name
- Destination
- Date range
- Budget (if set, formatted as EUR)
- Clickable → navigates to `/trips/:id`

### 5. Plan a New Trip CTA
Primary-colored button linking to `/trips/new` (currently redirects to `/home`).

## Trip Status Styling

| Status | Color | Icon |
|--------|-------|------|
| PLANNING | `primary` | `edit_note` |
| UPCOMING | `secondary` | `schedule` |
| IN_PROGRESS | `tertiary` | `flight_takeoff` |
| COMPLETED | `on-surface-variant` | `check_circle` |

## Models

### TripResponse
```typescript
interface TripResponse {
  id: number;
  name: string;
  description: string;
  destination: string;
  startDate: string;    // ISO "YYYY-MM-DD"
  endDate: string;
  status: TripStatus;   // 'PLANNING' | 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED'
  budget: number;
  interests: Interest[];
  createdAt: string;    // ISO instant
  updatedAt: string;
}
```

## Translation Keys

All under the `HOME` namespace:

| Key | Purpose | Example (EN) |
|-----|---------|--------------|
| `GREETING_MORNING` | Morning greeting | "Good morning, {{name}}!" |
| `GREETING_AFTERNOON` | Afternoon greeting | "Good afternoon, {{name}}!" |
| `GREETING_EVENING` | Evening greeting | "Good evening, {{name}}!" |
| `SUBTITLE` | Dashboard subtitle | "Here's what's happening with your travels." |
| `STATS.TOTAL` | Stats card label | "Total Trips" |
| `STATS.UPCOMING` | Stats card label | "Upcoming" |
| `STATS.IN_PROGRESS` | Stats card label | "In Progress" |
| `NEXT_TRIP` | Countdown label | "Your next adventure" |
| `DAYS_UNTIL` | Countdown suffix | "days to go" |
| `RECENT_TRIPS` | Section title | "Recent Trips" |
| `PLAN_NEW_TRIP` | CTA button | "Plan a new trip" |
| `STATUS.*` | Status badge text | "Planning", "Upcoming", etc. |
| `EMPTY.TITLE` | Empty state title | "No trips yet" |
| `EMPTY.DESCRIPTION` | Empty state text | "Start planning your first adventure..." |
| `EMPTY.CTA` | Empty state button | "Plan your first trip" |
| `ERROR_LOADING_TRIPS` | Error message | "Failed to load your trips." |
| `RETRY` | Retry button | "Try again" |

## Routes

```
/           → redirects to /home
/home       → DashboardLayout > HomePageComponent
/trips/new  → redirects to /home (placeholder)
/trips/:id  → redirects to /home (placeholder)
```

All routes under the dashboard layout are protected by `authGuard`.
