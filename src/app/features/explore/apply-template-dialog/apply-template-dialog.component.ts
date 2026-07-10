import { Component, computed, HostListener, inject, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ExploreService } from '../../../core/services/explore.service';
import { ApplyTripTemplateRequest } from '../../../core/models/explore.model';
import { TripResponse } from '../../../core/models/trip.model';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { BodyScrollLockService } from '../../../shared/services/body-scroll-lock.service';
import { budgetMaxDigits, dateNotInPast } from '../../../shared/validators/trip.validators';

interface ApplyDialogOpenArgs {
  styleSlug: string;
  templateSlug: string;
  templateName: string;
  durationDays: number;
  estimatedBudget: number | null;
}

@Component({
  selector: 'app-apply-template-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, DatePipe, FormFieldComponent],
  templateUrl: './apply-template-dialog.component.html',
})
export class ApplyTemplateDialogComponent {
  private fb = inject(FormBuilder);
  private exploreService = inject(ExploreService);
  private bodyScrollLock = inject(BodyScrollLockService);

  readonly isOpen = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private styleSlug: string | null = null;
  private templateSlug: string | null = null;
  private readonly _durationDays = signal<number>(0);

  readonly tripCreated = output<TripResponse>();

  form = this.fb.nonNullable.group({
    startDate: ['', [Validators.required, dateNotInPast()]],
    name: ['', Validators.maxLength(255)],
    budget: [null as number | null, [Validators.min(0), budgetMaxDigits()]],
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

  open(args: ApplyDialogOpenArgs): void {
    this.styleSlug = args.styleSlug;
    this.templateSlug = args.templateSlug;
    this._durationDays.set(args.durationDays);
    this.form.reset({ startDate: '', name: args.templateName, budget: args.estimatedBudget });
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
    this.styleSlug = null;
    this.templateSlug = null;
    this._durationDays.set(0);
  }

  onSubmit(): void {
    if (this.form.invalid || !this.styleSlug || !this.templateSlug) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const v = this.form.getRawValue();
    const body: ApplyTripTemplateRequest = { startDate: v.startDate };
    if (v.name && v.name.trim().length > 0) body.name = v.name.trim();
    if (v.budget !== null) body.budget = v.budget;

    this.exploreService.applyTemplate(this.styleSlug, this.templateSlug, body).subscribe({
      next: (trip) => {
        this.loading.set(false);
        this.tripCreated.emit(trip);
        this.isOpen.set(false);
        this.bodyScrollLock.unlock();
        this.styleSlug = null;
        this.templateSlug = null;
        this._durationDays.set(0);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 400) {
          this.errorMessage.set('EXPLORE.APPLY.ERROR_VALIDATION');
        } else if (err.status === 401 || err.status === 403) {
          this.errorMessage.set('EXPLORE.APPLY.ERROR_UNAUTHORIZED');
        } else if (err.status === 404) {
          this.errorMessage.set('EXPLORE.APPLY.ERROR_NOT_FOUND');
        } else {
          this.errorMessage.set('EXPLORE.APPLY.ERROR_GENERIC');
        }
      },
    });
  }

}
