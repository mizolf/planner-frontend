import { Component, computed, inject, OnInit, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { UserService } from '../../core/services/user.service';
import { TripService } from '../../core/services/trip.service';
import { TripStatus } from '../../core/models/trip.model';
import { CreateTripDialogComponent } from '../trips/create-trip-dialog/create-trip-dialog.component';
import { TripCardComponent } from '../trips/trip-card/trip-card.component';
import { ActivityFeedComponent } from '../activity-feed/activity-feed.component';
import { ExploreSectionComponent } from '../explore/explore-section/explore-section.component';
import { RecommendedTripsComponent } from '../explore/recommended-trips/recommended-trips.component';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [TranslateModule, RouterLink, CreateTripDialogComponent, TripCardComponent, ActivityFeedComponent, RecommendedTripsComponent, ExploreSectionComponent],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent implements OnInit {
  @ViewChild(CreateTripDialogComponent) dialog!: CreateTripDialogComponent;

  private userService = inject(UserService);
  private tripService = inject(TripService);

  readonly user = this.userService.currentUser;
  readonly trips = this.tripService.trips;
  readonly tripsLoading = this.tripService.loading;
  readonly tripsError = this.tripService.error;

  readonly totalTrips = computed(() => this.trips().length);
  readonly upcomingCount = computed(() =>
    this.trips().filter(t => t.status === 'UPCOMING').length,
  );
  readonly inProgressCount = computed(() =>
    this.trips().filter(t => t.status === 'IN_PROGRESS').length,
  );

  readonly sortedTrips = computed(() => {
    const statusOrder: Record<TripStatus, number> = {
      IN_PROGRESS: 0,
      UPCOMING: 1,
      COMPLETED: 2,
    };
    return [...this.trips()]
      .filter(t => t.status !== 'COMPLETED')
      .sort((a, b) => {
        const orderDiff = statusOrder[a.status] - statusOrder[b.status];
        if (orderDiff !== 0) return orderDiff;
        return a.startDate.localeCompare(b.startDate);
      });
  });

  readonly previewTrips = computed(() => this.sortedTrips().slice(0, 3));
  readonly moreTripsCount = computed(() => this.sortedTrips().length - this.previewTrips().length);

  readonly hasTrips = computed(() => this.trips().length > 0);

  readonly greetingKey = this.getGreetingKey();

  ngOnInit(): void {
    this.tripService.loadTrips();
  }

  openCreateTripDialog(): void {
    this.dialog.open();
  }

  retryLoadTrips(): void {
    this.tripService.loadTrips();
  }

  getFirstName(): string {
    const fullName = this.user()?.fullName ?? '';
    return fullName.split(' ')[0];
  }

  private getGreetingKey(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'HOME.GREETING_MORNING';
    if (hour < 18) return 'HOME.GREETING_AFTERNOON';
    return 'HOME.GREETING_EVENING';
  }
}
