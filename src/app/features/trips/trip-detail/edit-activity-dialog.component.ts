import { Component, HostListener, inject, signal } from "@angular/core";
import { FormFieldComponent } from "../../../shared/components/form-field/form-field.component";
import { DestinationAutocompleteComponent } from "../../../shared/components/destination-autocomplete/destination-autocomplete.component";
import { HttpErrorResponse } from "@angular/common/http";
import {
  FormBuilder,
  Validators,
  ReactiveFormsModule,
} from "@angular/forms";

import { TranslateModule } from "@ngx-translate/core";

import {
  ActivityCategory,
  TripActivityResponse,
  UpdateTripActivityRequest,
} from "../../../core/models/trip.model";
import {
  DestinationSuggestion,
  GeoBias,
} from "../../../core/services/geocoding.service";
import { formatTime, toBackendTime } from "../../../shared/utils/format-time";

import { TripService } from "../../../core/services/trip.service";
import { ToastService } from "../../../shared/services/toast.service";

@Component({
  selector: "app-edit-activity-dialog",
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslateModule,
    FormFieldComponent,
    DestinationAutocompleteComponent,
  ],
  templateUrl: "./edit-activity-dialog.component.html",
})
export class EditActivityDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly tripService = inject(TripService);
  private readonly toastService = inject(ToastService);

  private readonly _tripId = signal<number | null>(null);
  private readonly _dayId = signal<number | null>(null);
  private readonly _activityId = signal<number | null>(null);

  readonly isOpen = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly confirmingDelete = signal(false);
  // Set by prefill or picking a suggestion; any manual keystroke clears it
  readonly coords = signal<{ lat: number; lon: number } | null>(null);
  // Biases Photon search toward the parent trip's location (null = global search)
  readonly bias = signal<GeoBias | null>(null);

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

  open(
    tripId: number,
    dayId: number,
    activity: TripActivityResponse,
    bias: GeoBias | null,
  ): void {
    this._tripId.set(tripId);
    this._dayId.set(dayId);
    this._activityId.set(activity.id);
    this.form.reset({
      name: activity.name,
      description: activity.description ?? "",
      location: activity.location ?? "",
      startTime: formatTime(activity.startTime),
      endTime: formatTime(activity.endTime),
      category: activity.category ?? "",
      cost: activity.cost ?? null,
    });
    this.bias.set(bias);
    // Prefill survives form.reset because the autocomplete's search pipeline
    // listens to the DOM (input) event, which reset doesn't fire
    this.coords.set(
      activity.latitude != null && activity.longitude != null
        ? { lat: activity.latitude, lon: activity.longitude }
        : null,
    );
    this.errorMessage.set(null);
    this.confirmingDelete.set(false);
    this.isOpen.set(true);
    document.body.style.overflow = "hidden";
  }

  close(): void {
    if (this.loading()) return;
    this._tripId.set(null);
    this._dayId.set(null);
    this._activityId.set(null);
    this.coords.set(null);
    this.bias.set(null);
    this.isOpen.set(false);
    this.errorMessage.set(null);
    this.confirmingDelete.set(false);
    document.body.style.overflow = "";
  }

  onDestinationSelected(suggestion: DestinationSuggestion): void {
    this.coords.set({ lat: suggestion.latitude, lon: suggestion.longitude });
  }

  onDestinationCleared(): void {
    this.coords.set(null);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const tripId = this._tripId();
    const dayId = this._dayId();
    const activityId = this._activityId();
    if (tripId === null || dayId === null || activityId === null) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const v = this.form.getRawValue();
    const request: UpdateTripActivityRequest = {
      name: v.name.trim(),
      description: v.description.trim(),
      location: v.location.trim(),
      // Always sent — explicit null clears stale coordinates (mirrors edit-trip)
      latitude: this.coords()?.lat ?? null,
      longitude: this.coords()?.lon ?? null,
    };
    const start = toBackendTime(v.startTime);
    if (start) request.startTime = start;
    const end = toBackendTime(v.endTime);
    if (end) request.endTime = end;

    // category/cost attach conditionally (omit when empty/null) so they are not
    // wiped on every edit — backend updateEntity ignores nulls.
    if (v.category) request.category = v.category as ActivityCategory;
    if (v.cost != null) request.cost = Number(v.cost);

    this.tripService
      .updateActivityInDay(tripId, dayId, activityId, request)
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.close();
          this.toastService.show({
            message: "TRIPS.DETAIL.ACTIVITIES.EDIT.SUCCESS",
            type: "success",
          });
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.applyError(err);
        },
      });
  }

  requestDelete(): void {
    this.confirmingDelete.set(true);
  }

  cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  confirmDelete(): void {
    const tripId = this._tripId();
    const dayId = this._dayId();
    const activityId = this._activityId();
    if (tripId === null || dayId === null || activityId === null) return;

    this.loading.set(true);
    this.tripService
      .deleteActivityFromDay(tripId, dayId, activityId)
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.close();
          this.toastService.show({
            message: "TRIPS.DETAIL.ACTIVITIES.DELETE.SUCCESS",
            type: "success",
          });
        },
        error: () => {
          this.loading.set(false);
          this.toastService.show({
            message: "TRIPS.DETAIL.ACTIVITIES.DELETE.ERROR_GENERIC",
            type: "error",
          });
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
      this.errorMessage.set("TRIPS.DETAIL.ACTIVITIES.EDIT.ERROR_GENERIC");
    }
  }
}
