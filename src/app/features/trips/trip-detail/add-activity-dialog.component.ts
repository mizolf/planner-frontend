import { Component, HostListener, inject, input, signal } from "@angular/core";
import { FormFieldComponent } from "../../../shared/components/form-field/form-field.component";
import { HttpErrorResponse } from "@angular/common/http";
import {
  FormBuilder,
  Validators,
  ReactiveFormsModule,
} from "@angular/forms";

import { TranslateModule } from "@ngx-translate/core";

import {
  ActivityCategory,
  CreateTripActivityRequest,
} from "../../../core/models/trip.model";
import { toBackendTime } from "../../../shared/utils/format-time";

import { TripService } from "../../../core/services/trip.service";
import { ToastService } from "../../../shared/services/toast.service";

@Component({
  selector: "app-add-activity-dialog",
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule, FormFieldComponent],
  templateUrl: "./add-activity-dialog.component.html",
})
export class AddActivityDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly tripService = inject(TripService);
  private readonly toastService = inject(ToastService);

  private readonly _tripId = signal<number | null>(null);
  private readonly _dayId = signal<number | null>(null);

  readonly isOpen = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly categories: ActivityCategory[] = [
    "ATTRACTION",
    "TRANSPORT",
    "ACCOMMODATION",
    "RESTAURANT",
    "OTHER",
  ];

  readonly form = this.fb.nonNullable.group({
    name: ["", [Validators.required, Validators.maxLength(255)]],
    description: ["", Validators.maxLength(255)],
    location: ["", Validators.maxLength(255)],
    startTime: ["", Validators.required],
    endTime: [""],
    category: [""],
    cost: this.fb.control<number | null>(null, {
      validators: [Validators.min(0), Validators.max(999999.99)],
    }),
  });

  @HostListener("document:keydown.escape")
  onEscapeKey(): void {
    if (this.isOpen()) this.close();
  }

  open(tripId: number, dayId: number): void {
    this._tripId.set(tripId);
    this._dayId.set(dayId);
    this.form.reset({
      name: "",
      description: "",
      location: "",
      startTime: "",
      endTime: "",
      category: "",
      cost: null,
    });
    this.errorMessage.set(null);
    this.isOpen.set(true);
    document.body.style.overflow = "hidden";
  }

  close(): void {
    if (this.loading()) return;
    this._tripId.set(null);
    this._dayId.set(null);
    this.isOpen.set(false);
    this.errorMessage.set(null);
    document.body.style.overflow = "";
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
    const request: CreateTripActivityRequest = {
      name: v.name.trim(),
      startTime: toBackendTime(v.startTime),
      endTime: toBackendTime(v.endTime),
    };

    const trimmedDescription = v.description.trim();
    if (trimmedDescription) request.description = trimmedDescription;

    const trimmedLocation = v.location.trim();
    if (trimmedLocation) request.location = trimmedLocation;

    if (v.category) request.category = v.category as ActivityCategory;
    if (v.cost != null) request.cost = Number(v.cost);

    this.tripService.addActivityToDay(tripId, dayId, request).subscribe({
      next: () => {
        this.loading.set(false);
        this.close();
        this.toastService.show({
          message: "TRIPS.DETAIL.ACTIVITIES.ADD.SUCCESS",
          type: "success",
        });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.applyError(err);
      },
    });
  }

  private applyError(err: HttpErrorResponse): void {
    const fieldErrors: Record<string, string> | undefined =
      err.error?.fieldErrors;
    if (err.status === 400 && fieldErrors) {
      let mapped = false;
      for (const [name, _msg] of Object.entries(fieldErrors)) {
        const control = this.form.get(name);
        if (control) {
          control.setErrors({
            server: "TRIPS.DETAIL.ACTIVITIES.ADD.ERROR_VALIDATION",
          });
          mapped = true;
        }
      }
      if (!mapped)
        this.errorMessage.set("TRIPS.DETAIL.ACTIVITIES.ADD.ERROR_VALIDATION");
    } else if (err.status === 400) {
      this.errorMessage.set("TRIPS.DETAIL.ACTIVITIES.ADD.ERROR_VALIDATION");
    } else {
      this.errorMessage.set("TRIPS.DETAIL.ACTIVITIES.ADD.ERROR_GENERIC");
    }
  }
}
