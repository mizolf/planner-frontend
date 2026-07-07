import { ActivityCategory, Interest } from './trip.model';

// Public, privacy-stripped views of a trip published to the Community tab.
// Owner email and per-member data are never present here — only ownerDisplayName
// and memberCount. Budget / activity cost are also omitted (financial, private).

// GET /trips/public → one card per public trip.
export interface PublicTripSummaryResponse {
  id: number;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  // Server-computed (endDate - startDate + 1); the card does no date math.
  durationDays: number;
  interests: Interest[];
  ownerDisplayName: string;
  memberCount: number;
  imageUrl: string | null;
}

// GET /trips/public/{id} → full itinerary for the preview dialog.
export interface PublicTripDetailResponse {
  id: number;
  name: string;
  description: string | null;
  destination: string;
  latitude: number | null;
  longitude: number | null;
  startDate: string;
  endDate: string;
  durationDays: number;
  interests: Interest[];
  ownerDisplayName: string;
  memberCount: number;
  imageUrl: string | null;
  days: PublicTripDayResponse[];
}

// Superset of TemplateDayResponse: shares dayNumber/notes/activities so the
// preview render loop is reused, plus date/title which the loop ignores.
export interface PublicTripDayResponse {
  dayNumber: number;
  date: string | null;
  title: string | null;
  notes: string | null;
  activities: PublicTripActivityResponse[];
}

// Superset of TemplateActivityResponse: adds latitude/longitude/category.
export interface PublicTripActivityResponse {
  name: string;
  description: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  startTime: string | null;
  endTime: string | null;
  category: ActivityCategory | null;
}

// POST /trips/{id}/clone — user picks startDate; budget is NOT carried over.
export interface CloneTripRequest {
  startDate: string;
  name?: string;
}
