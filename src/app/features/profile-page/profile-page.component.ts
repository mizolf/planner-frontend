import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { UserService } from '../../core/services/user.service';
import { TripService } from '../../core/services/trip.service';
import { TripCardComponent } from '../trips/trip-card/trip-card.component';
import { ActivityFeedComponent } from '../activity-feed/activity-feed.component';

const RECENT_TRIPS_LIMIT = 4;

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [TranslateModule, RouterLink, TripCardComponent, ActivityFeedComponent],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
})
export class ProfilePageComponent implements OnInit {
  private userService = inject(UserService);
  private tripService = inject(TripService);

  readonly user = this.userService.currentUser;
  readonly trips = this.tripService.trips;
  
  readonly tripsLoading = this.tripService.loading;
  readonly tripsError = this.tripService.error;

  readonly totalTrips = computed(() => this.trips().length);
  readonly uniqueDestinations = computed(
    () => new Set(this.trips().map((t) => t.destination)).size,
  );
  readonly completedCount = computed(
    () => this.trips().filter((t) => t.status === 'COMPLETED').length,
  );

  readonly recentTrips = computed(() =>
    [...this.trips()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, RECENT_TRIPS_LIMIT),
  );
  readonly moreTripsCount = computed(
    () => this.trips().length - this.recentTrips().length,
  );

  readonly preferredInterests = computed(
    () => this.user()?.preferredInterests ?? [],
  );

  ngOnInit(): void {
    this.tripService.loadTrips();
  }

  retryLoadTrips(): void {
    this.tripService.loadTrips();
  }

  getInitials(): string {
    const name = this.user()?.fullName;
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}
