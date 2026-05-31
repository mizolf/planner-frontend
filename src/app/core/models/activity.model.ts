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
  | 'MEMBER_REMOVED'
  | 'INVITE_SENT'
  | 'INVITE_ACCEPTED'
  | 'INVITE_DECLINED'
  | 'INVITE_CANCELLED'
  | 'INVITE_EXPIRED';

export type EntityType = 'TRIP' | 'TRIP_DAY' | 'ACTIVITY' | 'MEMBER' | 'INVITE';

export interface FieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface DashboardActivityItem {
  id: number;
  eventType: ActivityEventType;
  entityType: EntityType;
  entityId: number;
  entityName: string;
  actorName: string | null;
  actorId: number | null;
  changes: FieldChange[] | null;
  createdAt: string;
  tripId: number;
  tripName: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
