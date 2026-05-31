import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { TripDetailResponse } from '../../../core/models/trip.model';
import { TripService } from '../../../core/services/trip.service';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-leave-trip-dialog',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './leave-trip-dialog.component.html',
})
export class LeaveTripDialogComponent {
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
    this.tripService.leaveTrip(trip.id).subscribe({
      next: () => {
        this.leaveSucceeded();
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        // Already not a member — the desired end state is reached anyway.
        if (err.status === 404) {
          this.leaveSucceeded();
          return;
        }
        // Owner can't leave; they should delete the trip instead. Keep the
        // dialog open so they can cancel. Not reachable through the UI (owners
        // see "Delete trip", not "Leave trip") — purely defensive.
        if (err.status === 409 && err.error?.code === 'OWNER_CANNOT_LEAVE') {
          this.toastService.show({ message: 'TRIPS.DETAIL.LEAVE.ERROR_OWNER', type: 'error' });
          return;
        }
        this.toastService.show({ message: 'TRIPS.DETAIL.LEAVE.ERROR_GENERIC', type: 'error' });
      },
    });
  }

  private leaveSucceeded(): void {
    this.loading.set(false);
    this._trip.set(null);
    document.body.style.overflow = '';
    this.router.navigate(['/home']);
    this.toastService.show({ message: 'TRIPS.DETAIL.LEAVE.SUCCESS', type: 'success' });
  }
}
