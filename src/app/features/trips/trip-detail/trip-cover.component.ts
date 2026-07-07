import { Component, inject, input, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { TripService } from '../../../core/services/trip.service';
import { ToastService } from '../../../shared/services/toast.service';
import { validateImageFile } from '../../../shared/utils/image-file';

@Component({
  selector: 'app-trip-cover',
  standalone: true,
  imports: [NgClass, TranslateModule],
  templateUrl: './trip-cover.component.html',
})
export class TripCoverComponent {
  private readonly tripService = inject(TripService);
  private readonly toastService = inject(ToastService);

  readonly tripId = input.required<number>();
  readonly imageUrl = input.required<string | null>();
  readonly tripName = input.required<string>();
  readonly canManage = input(false);

  readonly uploading = signal(false);
  readonly deleting = signal(false);
  readonly confirmingDelete = signal(false);

  /**
   * Presentational only: same id-hash as trip-card's tone(), so the hero and
   * the trip's card share the gradient colour.
   */
  tone(): 'sky' | 'earth' | 'sunset' {
    const tones = ['sky', 'earth', 'sunset'] as const;
    const key = String(this.tripId());
    let sum = 0;
    for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
    return tones[sum % tones.length];
  }

  coverLabel(): string {
    const letters = this.tripName().replace(/[^a-zA-ZÀ-ſ]/g, '');
    return (letters.slice(0, 3) || '—').toUpperCase();
  }

  onFileSelected(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    if (!file) return;

    const error = validateImageFile(file);
    if (error) {
      this.toastService.show({ message: error, type: 'error' });
      inputEl.value = '';
      return;
    }
    this.upload(file, inputEl);
  }

  confirmDelete(): void {
    this.deleting.set(true);
    this.tripService
      .deleteTripImage(this.tripId())
      .pipe(
        finalize(() => {
          this.deleting.set(false);
          this.confirmingDelete.set(false);
        }),
      )
      .subscribe({
        next: () =>
          this.toastService.show({
            message: 'TRIPS.DETAIL.IMAGE.DELETE_SUCCESS',
            type: 'success',
          }),
        error: (err: HttpErrorResponse) =>
          this.toastService.show({ message: this.mapError(err), type: 'error' }),
      });
  }

  private upload(file: File, inputEl: HTMLInputElement): void {
    this.uploading.set(true);
    this.tripService
      .uploadTripImage(this.tripId(), file)
      .pipe(
        finalize(() => {
          this.uploading.set(false);
          inputEl.value = '';
        }),
      )
      .subscribe({
        next: () =>
          this.toastService.show({
            message: 'TRIPS.DETAIL.IMAGE.UPLOAD_SUCCESS',
            type: 'success',
          }),
        error: (err: HttpErrorResponse) =>
          this.toastService.show({ message: this.mapError(err), type: 'error' }),
      });
  }

  // status 0: very large uploads can drop the connection before a clean 413.
  private mapError(err: HttpErrorResponse): string {
    const code: string | undefined = err.error?.code;
    if (err.status === 403) return 'TRIPS.DETAIL.IMAGE.ERRORS.FORBIDDEN';
    if (err.status === 404) return 'TRIPS.DETAIL.IMAGE.ERRORS.NOT_FOUND';
    if (err.status === 413 || code === 'FILE_TOO_LARGE' || err.status === 0) {
      return 'TRIPS.DETAIL.IMAGE.ERRORS.TOO_LARGE';
    }
    if (err.status === 400 || code === 'INVALID_FILE') {
      return 'TRIPS.DETAIL.IMAGE.ERRORS.INVALID_TYPE';
    }
    if (err.status === 502 || code === 'IMAGE_UPLOAD_FAILED') {
      return 'TRIPS.DETAIL.IMAGE.ERRORS.UPLOAD_FAILED';
    }
    return 'TRIPS.DETAIL.IMAGE.ERRORS.GENERIC';
  }
}
