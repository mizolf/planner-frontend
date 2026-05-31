import { Component, computed, inject, OnInit } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivityFeedService } from '../../core/services/activity-feed.service';
import { ActivityEventType, DashboardActivityItem, EntityType } from '../../core/models/activity.model';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';

// Only events with an entry here are rendered. The 4 hidden invite events
// (ACCEPTED/DECLINED/CANCELLED/EXPIRED) and any unknown future event type are
// intentionally absent, so `visibleActivities` filters them out instead of
// rendering a blank row.
const EVENT_TRANSLATION_KEYS: Partial<Record<ActivityEventType, string>> = {
  TRIP_CREATED: 'ACTIVITY_FEED.EVENTS.TRIP_CREATED',
  TRIP_UPDATED: 'ACTIVITY_FEED.EVENTS.TRIP_UPDATED',
  DAY_ADDED: 'ACTIVITY_FEED.EVENTS.DAY_ADDED',
  DAY_UPDATED: 'ACTIVITY_FEED.EVENTS.DAY_UPDATED',
  DAY_DELETED: 'ACTIVITY_FEED.EVENTS.DAY_DELETED',
  ACTIVITY_ADDED: 'ACTIVITY_FEED.EVENTS.ACTIVITY_ADDED',
  ACTIVITY_UPDATED: 'ACTIVITY_FEED.EVENTS.ACTIVITY_UPDATED',
  ACTIVITY_DELETED: 'ACTIVITY_FEED.EVENTS.ACTIVITY_DELETED',
  MEMBER_ADDED: 'ACTIVITY_FEED.EVENTS.MEMBER_ADDED',
  MEMBER_ROLE_CHANGED: 'ACTIVITY_FEED.EVENTS.MEMBER_ROLE_CHANGED',
  MEMBER_REMOVED: 'ACTIVITY_FEED.EVENTS.MEMBER_REMOVED',
  MEMBER_LEFT: 'ACTIVITY_FEED.EVENTS.MEMBER_LEFT',
  INVITE_SENT: 'ACTIVITY_FEED.EVENTS.INVITE_SENT',
};

// Synthetic key (not a backend event type): a MEMBER_ADDED event where the actor
// added themselves reads better as "X joined" than "X added X".
const MEMBER_JOINED_KEY = 'ACTIVITY_FEED.EVENTS.MEMBER_JOINED';

const ENTITY_ICONS: Record<EntityType, string> = {
  TRIP: 'luggage',
  TRIP_DAY: 'calendar_today',
  ACTIVITY: 'place',
  MEMBER: 'group',
  INVITE: 'forward_to_inbox',
};

const AVATAR_COLORS = [
  'bg-primary text-on-primary',
  'bg-secondary text-on-secondary',
  'bg-tertiary text-on-tertiary',
  'bg-primary-container text-on-primary-container',
  'bg-secondary-container text-on-secondary-container',
];

@Component({
  selector: 'app-activity-feed',
  standalone: true,
  imports: [TranslateModule, RelativeTimePipe],
  templateUrl: './activity-feed.component.html',
  styleUrl: './activity-feed.component.scss',
})
export class ActivityFeedComponent implements OnInit {
  private feedService = inject(ActivityFeedService);
  private translate = inject(TranslateService);

  readonly activities = this.feedService.activities;
  readonly loading = this.feedService.loading;
  readonly error = this.feedService.error;

  // Drops events we don't render (hidden invite events, unknown future types),
  // so they never reach the template as blank rows.
  readonly visibleActivities = computed(() =>
    this.activities().filter((a) => EVENT_TRANSLATION_KEYS[a.eventType] != null),
  );

  ngOnInit(): void {
    this.feedService.loadRecentActivities();
  }

  retry(): void {
    this.feedService.loadRecentActivities();
  }

  getTranslationKey(item: DashboardActivityItem): string {
    // A self-add (actor added themselves — i.e. accepting an invite) reads as "joined".
    if (item.eventType === 'MEMBER_ADDED' && item.actorId != null && item.actorId === item.entityId) {
      return MEMBER_JOINED_KEY;
    }
    // Safe: the template only renders items from visibleActivities(), which guarantees a key exists.
    return EVENT_TRANSLATION_KEYS[item.eventType]!;
  }

  getTranslationParams(item: DashboardActivityItem): Record<string, string> {
    return {
      actor: this.getActorDisplayName(item),
      entity: item.entityName,
      trip: item.tripName,
      member: item.entityName,
    };
  }

  getEntityIcon(item: DashboardActivityItem): string {
    return ENTITY_ICONS[item.entityType];
  }

  getInitial(item: DashboardActivityItem): string {
    const name = item.actorName;
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  }

  getAvatarColor(item: DashboardActivityItem): string {
    const name = item.actorName ?? 'deleted';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  private getActorDisplayName(item: DashboardActivityItem): string {
    if (!item.actorName) {
      return this.translate.instant('ACTIVITY_FEED.DELETED_USER');
    }
    return item.actorName.split(' ')[0];
  }
}
