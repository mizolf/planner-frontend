import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { TripDetailResponse } from '../../../core/models/trip.model';
import { TripService } from '../../../core/services/trip.service';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-delete-trip-dialog',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './delete-trip-dialog.component.html',
})
export class DeleteTripDialogComponent {
  private readonly tripService = inject(TripService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  private readonly _trip = signal<TripDetailResponse | null>(null);

  readonly trip = this._trip.asReadonly();
  readonly isOpen = computed(() => this._trip() !== null);
  readonly loading = signal(false);

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) this.close();
  }

  open(trip: TripDetailResponse): void {
    this._trip.set(trip);
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    if (this.loading()) return;
    this._trip.set(null);
    document.body.style.overflow = '';
  }

  confirm(): void {
    const trip = this._trip();
    if (trip === null) return;

    this.loading.set(true);
    this.tripService.deleteTrip(trip.id).subscribe({
      next: () => {
        this.loading.set(false);
        document.body.style.overflow = '';
        this.router.navigate(['/home']);
        this.toastService.show({ message: 'TRIPS.DETAIL.DELETE.SUCCESS', type: 'success' });
      },
      error: (_err: HttpErrorResponse) => {
        this.loading.set(false);
        this.toastService.show({ message: 'TRIPS.DETAIL.DELETE.ERROR_GENERIC', type: 'error' });
      },
    });
  }
}
