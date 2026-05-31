import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { TripMemberResponse } from '../../../core/models/trip.model';
import { TripService } from '../../../core/services/trip.service';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-remove-member-dialog',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './remove-member-dialog.component.html',
})
export class RemoveMemberDialogComponent {
  private readonly tripService = inject(TripService);
  private readonly toastService = inject(ToastService);

  private readonly _tripId = signal<number | null>(null);
  private readonly _member = signal<TripMemberResponse | null>(null);

  readonly member = this._member.asReadonly();
  readonly isOpen = computed(() => this._member() !== null);
  readonly loading = signal(false);

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) this.close();
  }

  open(tripId: number, member: TripMemberResponse): void {
    this._tripId.set(tripId);
    this._member.set(member);
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    if (this.loading()) return;
    this._tripId.set(null);
    this._member.set(null);
    document.body.style.overflow = '';
  }

  confirm(): void {
    const tripId = this._tripId();
    const member = this._member();
    if (tripId === null || member === null) return;

    this.loading.set(true);
    this.tripService.removeMember(tripId, member.userId).subscribe({
      next: () => {
        this.removeSucceeded();
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        // Already gone — the desired end state is reached anyway.
        if (err.status === 404) {
          this.removeSucceeded();
          return;
        }
        if (err.status === 403) {
          this.toastService.show({
            message: 'TRIPS.DETAIL.MEMBERS.REMOVE.ERROR_FORBIDDEN',
            type: 'error',
          });
          return;
        }
        this.toastService.show({
          message: 'TRIPS.DETAIL.MEMBERS.REMOVE.ERROR_GENERIC',
          type: 'error',
        });
      },
    });
  }

  private removeSucceeded(): void {
    this.loading.set(false);
    this._tripId.set(null);
    this._member.set(null);
    document.body.style.overflow = '';
    this.toastService.show({
      message: 'TRIPS.DETAIL.MEMBERS.REMOVE.SUCCESS',
      type: 'success',
    });
  }
}
