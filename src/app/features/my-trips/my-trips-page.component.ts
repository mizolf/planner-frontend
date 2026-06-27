import { Component, computed, inject, OnInit, signal, ViewChild } from "@angular/core";
import { NgClass } from "@angular/common";
import { TranslateModule } from "@ngx-translate/core";
import { TripCardComponent } from "../trips/trip-card/trip-card.component";
import { CreateTripDialogComponent } from "../trips/create-trip-dialog/create-trip-dialog.component";
import { TripService } from "../../core/services/trip.service";
import { TripResponse, TripStatus } from "../../core/models/trip.model";

type MyTripsTab = 'ALL' | 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED';
type SortOption = 'DEFAULT' | 'START_ASC' | 'START_DESC' | 'NAME_ASC' | 'RECENT';

@Component({
  selector: 'app-my-trips-page',
  standalone: true,
  imports: [NgClass, TranslateModule, TripCardComponent, CreateTripDialogComponent],
  templateUrl: './my-trips-page.component.html',
})
export class MyTripsPageComponent implements OnInit {
  @ViewChild(CreateTripDialogComponent) dialog!: CreateTripDialogComponent;

  private tripService = inject(TripService);

  readonly trips = this.tripService.trips;
  readonly tripsLoading = this.tripService.loading;
  readonly tripsError = this.tripService.error;

  readonly activeTab = signal<MyTripsTab>('ALL');

  // search / filter / sort kontrole
  readonly searchTerm = signal('');
  readonly dateFrom = signal('');   // 'yyyy-MM-dd' iz date inputa; '' = bez granice
  readonly dateTo = signal('');
  readonly sortBy = signal<SortOption>('DEFAULT');

  // brojači za labele tabova
  readonly totalTrips = computed(() => this.trips().length);
  readonly upcomingCount = computed(() => this.countBy('UPCOMING'));
  readonly inProgressCount = computed(() => this.countBy('IN_PROGRESS'));
  readonly completedCount = computed(() => this.countBy('COMPLETED'));

  // popis za prikaz: tab → search → filter po datumu → sort (vidi spec §5)
  readonly filteredTrips = computed(() => {
    const tab = this.activeTab();
    const term = this.searchTerm().trim().toLowerCase();
    const from = this.dateFrom();
    const to = this.dateTo();

    // 1. tab filter
    let list = tab === 'ALL'
      ? [...this.trips()]
      : this.trips().filter(t => t.status === tab);

    // 2. search (naziv + odredište)
    if (term) {
      list = list.filter(t =>
        t.name.toLowerCase().includes(term) ||
        t.destination.toLowerCase().includes(term));
    }

    // 3. filter po datumu početka (usporedba na 'yyyy-MM-dd' prefiksu)
    if (from) list = list.filter(t => t.startDate.slice(0, 10) >= from);
    if (to) list = list.filter(t => t.startDate.slice(0, 10) <= to);

    // 4. sort
    return this.applySort(list, tab, this.sortBy());
  });

  readonly hasTrips = computed(() => this.trips().length > 0);

  readonly hasActiveFilters = computed(() =>
    !!this.searchTerm().trim() || !!this.dateFrom() || !!this.dateTo());

  // broj tripova u trenutnom tabu (neovisno o search/datum filteru)
  readonly currentTabCount = computed(() => {
    switch (this.activeTab()) {
      case 'UPCOMING': return this.upcomingCount();
      case 'IN_PROGRESS': return this.inProgressCount();
      case 'COMPLETED': return this.completedCount();
      default: return this.totalTrips();
    }
  });

  // kontrolna traka vidljiva kad tab ima tripova ILI je filter aktivan (da ga možeš očistiti)
  readonly showControls = computed(() => this.currentTabCount() > 0 || this.hasActiveFilters());

  ngOnInit(): void { this.tripService.loadTrips(); }

  setTab(tab: MyTripsTab): void { this.activeTab.set(tab); }

  /** Presentational only: tonal pill classes for the active/inactive tab. */
  tabClasses(tab: MyTripsTab): string {
    return this.activeTab() === tab
      ? 'bg-surface-container-lowest text-primary shadow-ambient'
      : 'text-on-surface-variant hover:text-on-surface';
  }
  openCreateTripDialog(): void { this.dialog.open(); }
  retryLoadTrips(): void { this.tripService.loadTrips(); }

  clearFilters(): void {
    this.searchTerm.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
  }

  private countBy(status: TripStatus): number {
    return this.trips().filter(t => t.status === status).length;
  }

  private applySort(list: TripResponse[], tab: MyTripsTab, sort: SortOption): TripResponse[] {
    switch (sort) {
      case 'START_ASC': return [...list].sort((a, b) => a.startDate.localeCompare(b.startDate));
      case 'START_DESC': return [...list].sort((a, b) => b.startDate.localeCompare(a.startDate));
      case 'NAME_ASC': return [...list].sort((a, b) => a.name.localeCompare(b.name));
      case 'RECENT': return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      default: return this.defaultSort(list, tab);
    }
  }

  // postojeći per-tab pametni sort (§5); lista je već filtrirana po tabu
  private defaultSort(list: TripResponse[], tab: MyTripsTab): TripResponse[] {
    if (tab === 'ALL') {
      const statusOrder: Record<TripStatus, number> = { IN_PROGRESS: 0, UPCOMING: 1, COMPLETED: 2 };
      return [...list].sort((a, b) =>
        (statusOrder[a.status] - statusOrder[b.status]) || a.startDate.localeCompare(b.startDate));
    }
    if (tab === 'COMPLETED') return [...list].sort((a, b) => b.endDate.localeCompare(a.endDate));
    return [...list].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }
}