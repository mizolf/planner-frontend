import { Component, inject, signal, HostListener } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { TripService } from '../../../core/services/trip.service';
import { ToastService } from '../../../shared/services/toast.service';
import { CreateTripRequest, Interest } from '../../../core/models/trip.model';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { TextareaFieldComponent } from '../../../shared/components/textarea-field/textarea-field.component';
import { InterestChipsComponent } from '../../../shared/components/interest-chips/interest-chips.component';
import { endDateAfterStartDate, budgetMaxDigits } from '../../../shared/validators/trip.validators';

@Component({
  selector: 'app-create-trip-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslateModule,
    FormFieldComponent,
    TextareaFieldComponent,
    InterestChipsComponent,
  ],
  templateUrl: './create-trip-dialog.component.html',
})
export class CreateTripDialogComponent {
  private fb = inject(FormBuilder);
  private tripService = inject(TripService);
  private toastService = inject(ToastService);

  isOpen = signal(false);
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.nonNullable.group({
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

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) this.close();
  }

  open(): void {
    this.form.reset();
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
    const request: CreateTripRequest = {
      name: v.name,
      destination: v.destination,
      startDate: v.startDate,
      endDate: v.endDate,
    };
    if (v.description) request.description = v.description;
    if (v.budget !== null) request.budget = v.budget;
    if (v.interests.length > 0) request.interests = v.interests;

    this.tripService.createTrip(request).subscribe({
      next: () => {
        this.loading.set(false);
        this.close();
        this.toastService.show({ message: 'TRIPS.CREATE.SUCCESS', type: 'success' });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 400) {
          const msg = err.error?.message ?? err.error;
          this.errorMessage.set(
            typeof msg === 'string' && msg.includes('End date must not be before start date')
              ? 'TRIPS.CREATE.END_BEFORE_START'
              : 'TRIPS.CREATE.ERROR_VALIDATION',
          );
        } else {
          this.errorMessage.set('TRIPS.CREATE.ERROR_GENERIC');
        }
      },
    });
  }
}
