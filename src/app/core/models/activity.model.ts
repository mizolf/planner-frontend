export type ActivityEventType =
  | 'TRIP_CREATED'
  | 'TRIP_UPDATED'
  | 'DAY_ADDED'
  | 'DAY_UPDATED'
  | 'DAY_DELETED'
  | 'ACTIVITY_ADDED'
  | 'ACTIVITY_UPDATED'
  | 'ACTIVITY_DELETED'
  | 'MEMBER_ADDED'
  | 'MEMBER_ROLE_CHANGED'
  | 'MEMBER_REMOVED';

export type EntityType = 'TRIP' | 'TRIP_DAY' | 'ACTIVITY' | 'MEMBER';

export interface FieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface TripActivityResponse {
  id: number;
  eventType: ActivityEventType;
  entityType: EntityType;
  entityId: number;
  entityName: string;
  actorName: string;
  actorId: number;
  changes: FieldChange[] | null;
  targetMemberName: string | null;
  createdAt: string;
}

export interface DashboardActivityItem extends TripActivityResponse {
  tripId: number;
  tripName: string;
}
