import { Component, computed, HostListener, inject, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { PublicTripsService } from '../../../core/services/public-trips.service';
import { CloneTripRequest } from '../../../core/models/community.model';
import { TripResponse } from '../../../core/models/trip.model';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { BodyScrollLockService } from '../../../shared/services/body-scroll-lock.service';
import { dateNotInPast } from '../../../shared/validators/trip.validators';

interface CloneDialogOpenArgs {
  tripId: number;
  tripName: string;
  durationDays: number;
}

@Component({
  selector: 'app-clone-trip-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, DatePipe, FormFieldComponent],
  templateUrl: './clone-trip-dialog.component.html',
})
export class CloneTripDialogComponent {
  private fb = inject(FormBuilder);
  private publicTripsService = inject(PublicTripsService);
  private bodyScrollLock = inject(BodyScrollLockService);

  readonly isOpen = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private tripId: number | null = null;
  private readonly _durationDays = signal<number>(0);

  readonly tripCreated = output<TripResponse>();

  // No budget field — clone body is { startDate, name? }; budget is not copied.
  form = this.fb.nonNullable.group({
    startDate: ['', [Validators.required, dateNotInPast()]],
    name: ['', Validators.maxLength(255)],
  });

  private startDateValue = toSignal(this.form.controls.startDate.valueChanges, {
    initialValue: '',
  });

  readonly endDate = computed(() => {
    const start = this.startDateValue();
    const duration = this._durationDays();
    if (!start || !duration) return null;
    const date = new Date(start);
    if (isNaN(date.getTime())) return null;
    date.setDate(date.getDate() + (duration - 1));
    return date;
  });

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) this.close();
  }

  open(args: CloneDialogOpenArgs): void {
    this.tripId = args.tripId;
    this._durationDays.set(args.durationDays);
    this.form.reset({ startDate: '', name: args.tripName });
    this.errorMessage.set(null);
    this.isOpen.set(true);
    this.bodyScrollLock.lock();
  }

  close(): void {
    if (this.loading()) return;
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.bodyScrollLock.unlock();
    this.errorMessage.set(null);
    this.tripId = null;
    this._durationDays.set(0);
  }

  onSubmit(): void {
    if (this.form.invalid || this.tripId === null) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const v = this.form.getRawValue();
    const body: CloneTripRequest = { startDate: v.startDate };
    if (v.name && v.name.trim().length > 0) body.name = v.name.trim();

    this.publicTripsService.clone(this.tripId, body).subscribe({
      next: (trip) => {
        this.loading.set(false);
        this.tripCreated.emit(trip);
        this.isOpen.set(false);
        this.bodyScrollLock.unlock();
        this.tripId = null;
        this._durationDays.set(0);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 400) {
          this.errorMessage.set('EXPLORE.COMMUNITY.CLONE.ERROR_VALIDATION');
        } else if (err.status === 401 || err.status === 403) {
          this.errorMessage.set('EXPLORE.COMMUNITY.CLONE.ERROR_UNAUTHORIZED');
        } else if (err.status === 404) {
          this.errorMessage.set('EXPLORE.COMMUNITY.CLONE.ERROR_NOT_FOUND');
        } else {
          this.errorMessage.set('EXPLORE.COMMUNITY.CLONE.ERROR_GENERIC');
        }
      },
    });
  }
}
