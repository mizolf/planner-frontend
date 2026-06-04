import { Interest } from './trip.model';

export type Season = 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER' | 'YEAR_ROUND';

export interface TripStyleResponse {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  templateCount: number;
}

export interface TripTemplateSummaryResponse {
  id: number;
  slug: string;
  name: string;
  destination: string;
  durationDays: number;
  recommendedSeason: Season;
  imageUrl: string | null;
  estimatedBudget: number | null;
  interests: Interest[];
}

// GET /explore/templates → flat list of every template, tagged with its parent style.
export interface FeaturedTemplateResponse {
  id: number;
  slug: string;
  name: string;
  description: string;        // tagline for the card
  destination: string;
  durationDays: number;
  recommendedSeason: Season;
  imageUrl: string | null;
  estimatedBudget: number;
  interests: Interest[];
  styleSlug: string;          // for the template-detail deep-link
  styleName: string;          // category badge
}

export interface TripStyleDetailResponse {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  templates: TripTemplateSummaryResponse[];
}

export interface TemplateActivityResponse {
  name: string;
  description: string | null;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface TemplateDayResponse {
  dayNumber: number;
  notes: string | null;
  activities: TemplateActivityResponse[];
}

export interface TripTemplateDetailResponse {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  destination: string;
  durationDays: number;
  recommendedSeason: Season;
  imageUrl: string | null;
  estimatedBudget: number | null;
  interests: Interest[];
  days: TemplateDayResponse[];
}

export interface ApplyTripTemplateRequest {
  startDate: string;
  name?: string;
  budget?: number;
}
