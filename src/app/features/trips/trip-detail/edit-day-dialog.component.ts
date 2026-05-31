import { Component, HostListener, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { TripDayResponse, UpdateTripDayRequest } from '../../../core/models/trip.model';
import { TripService } from '../../../core/services/trip.service';
import { ToastService } from '../../../shared/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';

@Component({
  selector: 'app-edit-day-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, FormFieldComponent],
  templateUrl: './edit-day-dialog.component.html',
})
export class EditDayDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly tripService = inject(TripService);
  private readonly toastService = inject(ToastService);

  private readonly _tripId = signal<number | null>(null);
  private readonly _dayId = signal<number | null>(null);
  private readonly _tripStartDate = signal<string | null>(null);
  private readonly _tripEndDate = signal<string | null>(null);

  readonly isOpen = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.maxLength(255)],
    date: ['', [Validators.required, this.dateInRange.bind(this)]],
    notes: ['', Validators.maxLength(255)],
  });

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) this.close();
  }

  open(tripId: number, day: TripDayResponse, tripStartDate: string, tripEndDate: string): void {
    this._tripId.set(tripId);
    this._dayId.set(day.id);
    this._tripStartDate.set(tripStartDate);
    this._tripEndDate.set(tripEndDate);
    this.form.reset({
      title: day.title ?? '',
      date: day.date,
      notes: day.notes ?? '',
    });
    this.errorMessage.set(null);
    this.isOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    if (this.loading()) return;
    this._tripId.set(null);
    this._dayId.set(null);
    this._tripStartDate.set(null);
    this._tripEndDate.set(null);
    this.isOpen.set(false);
    this.errorMessage.set(null);
    document.body.style.overflow = '';
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const tripId = this._tripId();
    const dayId = this._dayId();
    if (tripId === null || dayId === null) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const v = this.form.getRawValue();
    const request: UpdateTripDayRequest = {
      date: v.date,
      title: v.title.trim(),
      notes: v.notes.trim(),
    };

    this.tripService.updateDay(tripId, dayId, request).subscribe({
      next: () => {
        this.loading.set(false);
        this.close();
        this.toastService.show({ message: 'TRIPS.DETAIL.DAYS.EDIT.SUCCESS', type: 'success' });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.applyError(err);
      },
    });
  }

  private dateInRange(control: AbstractControl): ValidationErrors | null {
    const value = control.value as string;
    if (!value) return null;
    const start = this._tripStartDate();
    const end = this._tripEndDate();
    if (!start || !end) return null;
    if (value < start || value > end) {
      return { dateOutOfRange: true };
    }
    return null;
  }

  private applyError(err: HttpErrorResponse): void {
    const fieldErrors: Record<string, string> | undefined = err.error?.fieldErrors;
    if (err.status === 400 && fieldErrors) {
      let mapped = false;
      for (const [name, _msg] of Object.entries(fieldErrors)) {
        const control = this.form.get(name);
        if (control) {
          control.setErrors({ server: 'TRIPS.DETAIL.DAYS.EDIT.ERROR_VALIDATION' });
          mapped = true;
        }
      }
      if (!mapped) this.errorMessage.set('TRIPS.DETAIL.DAYS.EDIT.ERROR_VALIDATION');
    } else if (err.status === 400) {
      this.errorMessage.set('TRIPS.DETAIL.DAYS.EDIT.ERROR_VALIDATION');
    } else {
      this.errorMessage.set('TRIPS.DETAIL.DAYS.EDIT.ERROR_GENERIC');
    }
  }
}
