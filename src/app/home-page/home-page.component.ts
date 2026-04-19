import { Component, computed, inject, OnInit, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, NgClass } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { UserService } from '../core/services/user.service';
import { TripService } from '../core/services/trip.service';
import { TripResponse, TripStatus } from '../core/models/trip.model';
import { CreateTripDialogComponent } from '../features/trips/create-trip-dialog/create-trip-dialog.component';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [TranslateModule, RouterLink, DatePipe, NgClass, CreateTripDialogComponent],
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

  // Top 2 active trips: IN_PROGRESS first, then UPCOMING (soonest), then PLANNING
  readonly upcomingTrips = computed(() => {
    const statusOrder: Record<TripStatus, number> = {
      IN_PROGRESS: 0,
      UPCOMING: 1,
      PLANNING: 2,
      COMPLETED: 3,
    };
    return [...this.trips()]
      .filter(t => t.status !== 'COMPLETED')
      .sort((a, b) => {
        const orderDiff = statusOrder[a.status] - statusOrder[b.status];
        if (orderDiff !== 0) return orderDiff;
        return a.startDate.localeCompare(b.startDate);
      })
      .slice(0, 2);
  });

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

  getDaysToGo(trip: TripResponse): number | null {
    if (trip.status !== 'UPCOMING') return null;
    const start = new Date(trip.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  }

  getStatusColor(status: TripStatus): string {
    const colors: Record<TripStatus, string> = {
      PLANNING: 'bg-primary/10 text-primary',
      UPCOMING: 'bg-secondary/10 text-secondary',
      IN_PROGRESS: 'bg-tertiary/10 text-tertiary',
      COMPLETED: 'bg-on-surface-variant/10 text-on-surface-variant',
    };
    return colors[status];
  }

  private getGreetingKey(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'HOME.GREETING_MORNING';
    if (hour < 18) return 'HOME.GREETING_AFTERNOON';
    return 'HOME.GREETING_EVENING';
  }
}
