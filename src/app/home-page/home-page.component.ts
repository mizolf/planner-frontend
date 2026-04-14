import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, CurrencyPipe, NgClass } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { UserService } from '../core/services/user.service';
import { TripService } from '../core/services/trip.service';
import { TripStatus } from '../core/models/trip.model';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [TranslateModule, RouterLink, DatePipe, CurrencyPipe, NgClass],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent implements OnInit {
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

  // Soonest UPCOMING trip with a future startDate
  readonly nextTrip = computed(() => {
    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD" — lexicographic compare works
    return this.trips()
      .filter(t => t.status === 'UPCOMING' && t.startDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null;
  });

  readonly daysUntilNextTrip = computed(() => {
    const trip = this.nextTrip();
    if (!trip) return null;
    const start = new Date(trip.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  });

  // Top 4 most recently updated trips
  readonly recentTrips = computed(() =>
    [...this.trips()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 4),
  );

  readonly hasTrips = computed(() => this.trips().length > 0);

  readonly greetingKey = this.getGreetingKey();

  ngOnInit(): void {
    this.tripService.loadTrips();
  }

  retryLoadTrips(): void {
    this.tripService.loadTrips();
  }

  getFirstName(): string {
    const fullName = this.user()?.fullName ?? '';
    return fullName.split(' ')[0];
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

  getStatusIcon(status: TripStatus): string {
    const icons: Record<TripStatus, string> = {
      PLANNING: 'edit_note',
      UPCOMING: 'schedule',
      IN_PROGRESS: 'flight_takeoff',
      COMPLETED: 'check_circle',
    };
    return icons[status];
  }

  private getGreetingKey(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'HOME.GREETING_MORNING';
    if (hour < 18) return 'HOME.GREETING_AFTERNOON';
    return 'HOME.GREETING_EVENING';
  }
}
