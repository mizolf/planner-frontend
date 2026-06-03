import { Component, computed, inject, OnInit, signal, ViewChild } from "@angular/core";
import { TranslateModule } from "@ngx-translate/core";
import { TripCardComponent } from "../trips/trip-card/trip-card.component";
import { CreateTripDialogComponent } from "../trips/create-trip-dialog/create-trip-dialog.component";
import { TripService } from "../../core/services/trip.service";
import { TripStatus } from "../../core/models/trip.model";

type MyTripsTab = 'ALL' | 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED';

@Component({
  selector: 'app-my-trips-page',
  standalone: true,
  imports: [TranslateModule, TripCardComponent, CreateTripDialogComponent],
  templateUrl: './my-trips-page.component.html',
})
export class MyTripsPageComponent implements OnInit {
  @ViewChild(CreateTripDialogComponent) dialog!: CreateTripDialogComponent;

  private tripService = inject(TripService);

  readonly trips = this.tripService.trips;
  readonly tripsLoading = this.tripService.loading;
  readonly tripsError = this.tripService.error;

  readonly activeTab = signal<MyTripsTab>('ALL');

  // brojači za labele tabova
  readonly totalTrips = computed(() => this.trips().length);
  readonly upcomingCount = computed(() => this.countBy('UPCOMING'));
  readonly inProgressCount = computed(() => this.countBy('IN_PROGRESS'));
  readonly completedCount = computed(() => this.countBy('COMPLETED'));

  // popis za prikaz, ovisno o aktivnom tabu + sortiran (vidi spec §5)
  readonly filteredTrips = computed(() => {
    const tab = this.activeTab();
    const all = this.trips();

    if (tab === 'ALL') {
      const statusOrder: Record<TripStatus, number> = {
        IN_PROGRESS: 0,
        UPCOMING: 1,
        COMPLETED: 2,
      };
      return [...all].sort((a, b) => {
        const orderDiff = statusOrder[a.status] - statusOrder[b.status];
        if (orderDiff !== 0) return orderDiff;
        return a.startDate.localeCompare(b.startDate);
      });
    }

    if (tab === 'COMPLETED') {
      return all
        .filter(t => t.status === 'COMPLETED')
        .sort((a, b) => b.endDate.localeCompare(a.endDate));
    }

    // UPCOMING / IN_PROGRESS: filtriraj po statusu, sortiraj po startDate uzlazno
    return all
      .filter(t => t.status === tab)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  });

  readonly hasTrips = computed(() => this.trips().length > 0);

  ngOnInit(): void { this.tripService.loadTrips(); }

  setTab(tab: MyTripsTab): void { this.activeTab.set(tab); }
  openCreateTripDialog(): void { this.dialog.open(); }
  retryLoadTrips(): void { this.tripService.loadTrips(); }

  private countBy(status: TripStatus): number {
    return this.trips().filter(t => t.status === status).length;
  }
}