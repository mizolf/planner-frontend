import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { TripDayResponse } from '../../../core/models/trip.model';
import { TripService } from '../../../core/services/trip.service';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-delete-day-dialog',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './delete-day-dialog.component.html',
})
export class DeleteDayDialogComponent {
  private readonly tripService = inject(TripService);
  private readonly toastService = inject(ToastService);

  private readonly _tripId = signal<number | null>(null);
  private readonly _day = signal<TripDayResponse | null>(null);

  readonly day = this._day.asReadonly();
  readonly isOpen = computed(() => this._day() !== null);
  readonly loading = signal(false);

  readonly activityCount = computed(() => this._day()?.activities.length ?? 0);

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) this.close();
  }

  open(tripId: number, day: TripDayResponse): void {
    this._tripId.set(tripId);
    this._day.set(day);
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    if (this.loading()) return;
    this._day.set(null);
    this._tripId.set(null);
    document.body.style.overflow = '';
  }

  confirm(): void {
    const tripId = this._tripId();
    const day = this._day();
    if (tripId === null || day === null) return;

    this.loading.set(true);
    this.tripService.deleteDayFromTrip(tripId, day.id).subscribe({
      next: () => {
        this.loading.set(false);
        this.close();
        this.toastService.show({ message: 'TRIPS.DETAIL.DAYS.DELETE.SUCCESS', type: 'success' });
      },
      error: (_err: HttpErrorResponse) => {
        this.loading.set(false);
        this.toastService.show({ message: 'TRIPS.DETAIL.DAYS.DELETE.ERROR_GENERIC', type: 'error' });
      },
    });
  }
}
