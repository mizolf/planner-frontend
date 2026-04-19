import { Injectable, signal } from '@angular/core';
import { DashboardActivityItem } from '../models/activity.model';

const MOCK_ACTIVITIES: DashboardActivityItem[] = [
  {
    id: 1,
    eventType: 'ACTIVITY_ADDED',
    entityType: 'ACTIVITY',
    entityId: 12,
    entityName: 'Visit Colosseum',
    actorName: 'Sarah Miller',
    actorId: 2,
    changes: null,
    targetMemberName: null,
    createdAt: hoursAgo(2),
    tripId: 1,
    tripName: 'Rome Getaway',
  },
  {
    id: 2,
    eventType: 'TRIP_UPDATED',
    entityType: 'TRIP',
    entityId: 3,
    entityName: 'Kyoto Trip',
    actorName: 'Mike Chen',
    actorId: 3,
    changes: [{ field: 'budget', oldValue: '2000', newValue: '2500' }],
    targetMemberName: null,
    createdAt: hoursAgo(5),
    tripId: 3,
    tripName: 'Kyoto Trip',
  },
  {
    id: 3,
    eventType: 'MEMBER_ADDED',
    entityType: 'MEMBER',
    entityId: 8,
    entityName: 'Luka Modrić',
    actorName: 'Ana Horvat',
    actorId: 4,
    changes: null,
    targetMemberName: 'Luka Modrić',
    createdAt: daysAgo(1),
    tripId: 2,
    tripName: 'Summer Europe Trip',
  },
  {
    id: 4,
    eventType: 'DAY_ADDED',
    entityType: 'TRIP_DAY',
    entityId: 9,
    entityName: 'Day 3',
    actorName: 'Mislav Novak',
    actorId: 1,
    changes: null,
    targetMemberName: null,
    createdAt: daysAgo(2),
    tripId: 5,
    tripName: 'Weekend in Vienna',
  },
  {
    id: 5,
    eventType: 'ACTIVITY_DELETED',
    entityType: 'ACTIVITY',
    entityId: 7,
    entityName: 'Old Restaurant',
    actorName: 'Sarah Miller',
    actorId: 2,
    changes: null,
    targetMemberName: null,
    createdAt: daysAgo(3),
    tripId: 1,
    tripName: 'Rome Getaway',
  },
  {
    id: 6,
    eventType: 'TRIP_CREATED',
    entityType: 'TRIP',
    entityId: 5,
    entityName: 'Weekend in Vienna',
    actorName: 'Mislav Novak',
    actorId: 1,
    changes: null,
    targetMemberName: null,
    createdAt: daysAgo(5),
    tripId: 5,
    tripName: 'Weekend in Vienna',
  },
];

function hoursAgo(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

@Injectable({ providedIn: 'root' })
export class ActivityFeedService {
  private readonly _activities = signal<DashboardActivityItem[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly activities = this._activities.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  loadRecentActivities(): void {
    this._loading.set(true);
    this._error.set(null);

    // Simulate API latency — replace with real HTTP call when backend is ready
    setTimeout(() => {
      this._activities.set(MOCK_ACTIVITIES);
      this._loading.set(false);
    }, 600);
  }
}
