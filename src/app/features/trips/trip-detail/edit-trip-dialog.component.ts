import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { TripService } from '../../../core/services/trip.service';
import { ToastService } from '../../../shared/services/toast.service';
import {
  Interest,
  TripDayResponse,
  TripDetailResponse,
  UpdateTripRequest,
} from '../../../core/models/trip.model';
import { DestinationSuggestion } from '../../../core/services/geocoding.service';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { DestinationAutocompleteComponent } from '../../../shared/components/destination-autocomplete/destination-autocomplete.component';
import { TextareaFieldComponent } from '../../../shared/components/textarea-field/textarea-field.component';
import { InterestChipsComponent } from '../../../shared/components/interest-chips/interest-chips.component';
import { endDateAfterStartDate, budgetMaxDigits } from '../../../shared/validators/trip.validators';

@Component({
  selector: 'app-edit-trip-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslateModule,
    FormFieldComponent,
    DestinationAutocompleteComponent,
    TextareaFieldComponent,
    InterestChipsComponent,
  ],
  templateUrl: './edit-trip-dialog.component.html',
})
export class EditTripDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly tripService = inject(TripService);
  private readonly toastService = inject(ToastService);

  private readonly _tripId = signal<number | null>(null);
  private readonly _originalDays = signal<TripDayResponse[]>([]);

  readonly isOpen = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  // Set by prefill or picking a suggestion; any manual keystroke clears it
  readonly coords = signal<{ lat: number; lon: number } | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', Validators.maxLength(255)],
    destination: ['', [Validators.required, Validators.maxLength(255)]],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    budget: [null as number | null, [Validators.min(0), budgetMaxDigits()]],
    interests: [[] as Interest[]],
  }, {
    validators: endDateAfterStartDate('startDate', 'endDate'),
  });

  // Reactivity for the orphan-day warning. Declared as field initializers so
  // toSignal runs in an injection context (NOT inside open(), NOT in an effect
  // with a signal write — that would throw NG0600).
  private readonly startDate = toSignal(this.form.controls.startDate.valueChanges, {
    initialValue: '',
  });
  private readonly endDate = toSignal(this.form.controls.endDate.valueChanges, {
    initialValue: '',
  });

  readonly orphanDayCount = computed(() => {
    const start = this.startDate();
    const end = this.endDate();
    if (!start || !end) return 0;
    return this._originalDays().filter((d) => d.date < start || d.date > end).length;
  });

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) this.close();
  }

  onDestinationSelected(suggestion: DestinationSuggestion): void {
    this.coords.set({ lat: suggestion.latitude, lon: suggestion.longitude });
  }

  onDestinationCleared(): void {
    this.coords.set(null);
  }

  open(trip: TripDetailResponse): void {
    this._tripId.set(trip.id);
    this._originalDays.set(trip.days);
    this.form.reset({
      name: trip.name,
      description: trip.description ?? '',
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      budget: trip.budget ?? null,
      interests: trip.interests ?? [],
    });
    // Prefill survives form.reset because the autocomplete's search pipeline
    // listens to the DOM (input) event, which reset doesn't fire
    this.coords.set(
      trip.latitude != null && trip.longitude != null
        ? { lat: trip.latitude, lon: trip.longitude }
        : null,
    );
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

    const tripId = this._tripId();
    if (tripId === null) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const v = this.form.getRawValue();
    const request: UpdateTripRequest = {
      name: v.name,
      destination: v.destination,
      // Always sent — explicit null clears stale coordinates server-side
      latitude: this.coords()?.lat ?? null,
      longitude: this.coords()?.lon ?? null,
      description: v.description,
      startDate: v.startDate,
      endDate: v.endDate,
      interests: v.interests,
    };
    if (v.budget !== null) request.budget = v.budget;

    this.tripService.updateTrip(tripId, request).subscribe({
      next: () => {
        this.loading.set(false);
        this.close();
        this.toastService.show({ message: 'TRIPS.DETAIL.EDIT.SUCCESS', type: 'success' });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.applyError(err);
      },
    });
  }

  private applyError(err: HttpErrorResponse): void {
    if (err.status === 409 && err.error?.code === 'OVERLAPPING_DATES') {
      this.errorMessage.set('TRIPS.DETAIL.EDIT.DATES_OVERLAP');
      return;
    }
    const fieldErrors: Record<string, string> | undefined = err.error?.fieldErrors;
    if (err.status === 400 && fieldErrors) {
      let mapped = false;
      for (const [name, _msg] of Object.entries(fieldErrors)) {
        const control = this.form.get(name);
        if (control) {
          control.setErrors({ server: 'TRIPS.DETAIL.EDIT.ERROR_VALIDATION' });
          mapped = true;
        }
      }
      if (!mapped) this.errorMessage.set('TRIPS.DETAIL.EDIT.ERROR_VALIDATION');
    } else if (err.status === 400) {
      this.errorMessage.set('TRIPS.DETAIL.EDIT.ERROR_VALIDATION');
    } else {
      this.errorMessage.set('TRIPS.DETAIL.EDIT.ERROR_GENERIC');
    }
  }
}
