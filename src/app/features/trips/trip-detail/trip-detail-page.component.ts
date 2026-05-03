import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { TripService } from '../../../core/services/trip.service';
import { TripDayCardComponent } from './trip-day-card.component';
import { TripDetailHeaderComponent } from './trip-detail-header.component';
import { TripMembersSectionComponent } from './trip-members-section.component';

@Component({
  selector: 'app-trip-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    TranslateModule,
    TripDayCardComponent,
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

  private paramSub?: Subscription;

  ngOnInit(): void {
    this.paramSub = this.route.paramMap.subscribe(params => {
      const raw = params.get('id');
      const id = Number(raw);
      if (raw === null || !Number.isFinite(id) || id <= 0) {
        return;
      }
      this.tripService.loadTripDetail(id);
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
    this.tripService.clearTripDetail();
  }
}
