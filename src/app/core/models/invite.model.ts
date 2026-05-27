import { MemberRole } from "./trip.model";

export type InviteStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED";

export type TripRole = MemberRole;

export interface CreateInviteRequest {
  email: string;
  role: "EDITOR" | "VIEWER";
}

export interface TripInviteResponse {
  id: number;
  email: string;
  role: TripRole;
  status: InviteStatus;
  inviterName: string;
  createdAt: string;
  expiresAt: string;
}

export interface MyInviteResponse {
  id: number;
  tripId: number;
  tripName: string;
  tripDestination: string | null;
  inviterName: string;
  role: TripRole;
  expiresAt: string;
}

export type InviteErrorCode =
  | "CONCURRENT_MODIFICATION"
  | "SELF_INVITE"
  | "ALREADY_MEMBER"
  | "INVITE_NOT_PENDING"
  | "INVITE_EXPIRED";

export interface ErrorResponse {
  status: number;
  code?: InviteErrorCode | string;
  message: string;
  fieldErrors?: Record<string, string>;
  timestamp?: string;
}
