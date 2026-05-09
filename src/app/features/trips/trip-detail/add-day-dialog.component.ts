import { Component, HostListener, inject, input, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { CreateTripDayRequest, TripDayResponse } from '../../../core/models/trip.model';
import { TripService } from '../../../core/services/trip.service';
import { ToastService } from '../../../shared/services/toast.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';

@Component({
  selector: 'app-add-day-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, FormFieldComponent],
  templateUrl: './add-day-dialog.component.html',
})
export class AddDayDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly tripService = inject(TripService);
  private readonly toastService = inject(ToastService);

  readonly tripId = input.required<number>();
  readonly tripStartDate = input.required<string>();
  readonly tripEndDate = input.required<string>();
  readonly existingDays = input.required<TripDayResponse[]>();

  readonly isOpen = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.maxLength(255)],
    date: ['', [Validators.required, this.dateInRange.bind(this)]],
  });

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) this.close();
  }

  open(): void {
    this.form.reset({ title: '', date: this.suggestNextDate() });
    this.errorMessage.set(null);
    this.isOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    if (this.loading()) return;
    this.isOpen.set(false);
    this.errorMessage.set(null);
    document.body.style.overflow = '';
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const v = this.form.getRawValue();
    const request: CreateTripDayRequest = {
      dayNumber: this.suggestNextDayNumber(),
      date: v.date,
    };
    const trimmedTitle = v.title.trim();
    if (trimmedTitle) request.title = trimmedTitle;

    this.tripService.addDayToTrip(this.tripId(), request).subscribe({
      next: () => {
        this.loading.set(false);
        this.close();
        this.toastService.show({ message: 'TRIPS.DETAIL.DAYS.ADD.SUCCESS', type: 'success' });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.applyError(err);
      },
    });
  }

  private suggestNextDayNumber(): number {
    const days = this.existingDays();
    if (days.length === 0) return 1;
    return Math.max(...days.map(d => d.dayNumber)) + 1;
  }

  private suggestNextDate(): string {
    const days = this.existingDays();
    const start = this.tripStartDate();
    const end = this.tripEndDate();

    if (days.length === 0) return start;

    const lastDate = days
      .map(d => d.date)
      .sort()
      .at(-1)!;
    const next = addOneDay(lastDate);
    return next > end ? end : next;
  }

  private dateInRange(control: AbstractControl): ValidationErrors | null {
    const value = control.value as string;
    if (!value) return null;
    const start = this.tripStartDate?.();
    const end = this.tripEndDate?.();
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
          control.setErrors({ server: 'TRIPS.DETAIL.DAYS.ADD.ERROR_VALIDATION' });
          mapped = true;
        }
      }
      if (!mapped) this.errorMessage.set('TRIPS.DETAIL.DAYS.ADD.ERROR_VALIDATION');
    } else if (err.status === 400) {
      this.errorMessage.set('TRIPS.DETAIL.DAYS.ADD.ERROR_VALIDATION');
    } else {
      this.errorMessage.set('TRIPS.DETAIL.DAYS.ADD.ERROR_GENERIC');
    }
  }
}

function addOneDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
