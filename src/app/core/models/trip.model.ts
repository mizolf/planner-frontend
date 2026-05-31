export type TripStatus = "UPCOMING" | "IN_PROGRESS" | "COMPLETED";

export type Interest =
  | "CULTURE"
  | "FOOD"
  | "ADVENTURE"
  | "NATURE"
  | "NIGHTLIFE"
  | "SHOPPING"
  | "RELAXATION"
  | "HISTORY";

export interface CreateTripRequest {
  name: string;
  description?: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget?: number;
  interests?: Interest[];
}

export interface UpdateTripRequest {
  name?: string;
  description?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  interests?: Interest[];
}

export interface TripResponse {
  id: number;
  name: string;
  description: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  budget: number;
  interests: Interest[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTripDayRequest {
  dayNumber: number;
  date: string;
  title?: string;
  notes?: string;
}

export interface UpdateTripDayRequest {
  dayNumber?: number;
  date?: string;
  title?: string;
  notes?: string;
}

export type MemberRole = "OWNER" | "EDITOR" | "VIEWER";

export interface UpdateMemberRoleRequest {
  role: MemberRole;
}

export interface ActivityResponse {
  id: number;
  name: string;
  description: string | null;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface CreateTripActivityRequest {
  name: string;
  description?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
}

export interface TripActivityResponse {
  id: number;
  name: string;
  description: string | null;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface UpdateTripActivityRequest {
  name?: string;
  description?: string;
  location?: string;
  startTime?: string;
  endTime?: string;
}

export interface TripDayResponse {
  id: number;
  dayNumber: number;
  date: string;
  title: string | null;
  notes: string | null;
  activities: ActivityResponse[];
}

export interface TripMemberResponse {
  userId: number;
  fullName: string;
  email: string;
  role: MemberRole;
  joinedAt: string;
}

export interface TripDetailResponse extends TripResponse {
  days: TripDayResponse[];
  members: TripMemberResponse[];
}

export type TripDetailErrorKind =
  | "NOT_FOUND"
  | "NO_ACCESS"
  | "UNAUTHENTICATED"
  | "GENERIC";
