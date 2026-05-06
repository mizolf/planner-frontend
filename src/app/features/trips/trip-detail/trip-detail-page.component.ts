import { Component, computed, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { TripService } from '../../../core/services/trip.service';
import { TripDayCardComponent } from './trip-day-card.component';
import { TripDayPickerComponent } from './trip-day-picker.component';
import { TripDetailHeaderComponent } from './trip-detail-header.component';
import { TripMembersSectionComponent } from './trip-members-section.component';

@Component({
  selector: 'app-trip-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    TripDayCardComponent,
    TripDayPickerComponent,
    TripDetailHeaderComponent,
    TripMembersSectionComponent,
  ],
  templateUrl: './trip-detail-page.component.html',
})
export class TripDetailPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly tripService = inject(TripService);

  readonly trip = this.tripService.tripDetail;
  readonly loading = this.tripService.detailLoading;
  readonly error = this.tripService.detailError;

  private readonly userSelectedDayId = signal<number | null>(null);

  readonly selectedDay = computed(() => {
    const t = this.trip();
    if (!t || t.days.length === 0) return null;
    const sorted = [...t.days].sort((a, b) => a.dayNumber - b.dayNumber);
    const explicit = this.userSelectedDayId();
    if (explicit !== null) {
      const found = t.days.find(d => d.id === explicit);
      if (found) return found;
    }
    return sorted[0];
  });

  readonly selectedDayId = computed(() => this.selectedDay()?.id ?? null);

  private paramSub?: Subscription;

  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe(params => {
      const raw = params.get('id');
      const id = Number(raw);
      if (raw === null || !Number.isFinite(id) || id <= 0) {
        return;
      }
      this.userSelectedDayId.set(null);
      this.tripService.loadTripDetail(id);
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
    this.tripService.clearTripDetail();
  }

  selectDay(id: number): void {
    this.userSelectedDayId.set(id);
  }
}
