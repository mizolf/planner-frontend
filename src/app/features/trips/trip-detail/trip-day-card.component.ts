import { Component, input, output } from "@angular/core";
import { DecimalPipe, NgClass } from "@angular/common";
import { TranslateModule } from "@ngx-translate/core";
import {
  CATEGORY_ICONS,
  TripActivityResponse,
  TripDayResponse,
} from "../../../core/models/trip.model";
import { formatTime } from "../../../shared/utils/format-time";
import { LocalizedDatePipe } from "../../../shared/pipes/localized-date.pipe";

@Component({
  selector: "app-trip-day-card",
  standalone: true,
  imports: [LocalizedDatePipe, DecimalPipe, NgClass, TranslateModule],
  templateUrl: "./trip-day-card.component.html",
})
export class TripDayCardComponent {
  readonly day = input.required<TripDayResponse>();

  readonly categoryIcons = CATEGORY_ICONS;

  readonly canEditDay = input(false);
  readonly editDay = output<void>();

  readonly canDelete = input(false);
  readonly deleteDay = output<void>();

  readonly canAddActivity = input(false);
  readonly addActivity = output<void>();

  readonly canEditActivity = input(false);
  readonly editActivity = output<TripActivityResponse>();

  readonly focusedActivityId = input<number | null>(null);
  readonly focusActivity = output<number>();

  formatTime = formatTime;

  /**
   * Presentational only: soft tonal classes for an activity's category icon box.
   * Full class strings (not interpolated) so Tailwind's content scan keeps them.
   */
  toneClasses(activity: TripActivityResponse): string {
    switch (activity.category) {
      case "RESTAURANT":
        return "bg-tertiary/10 text-tertiary";
      case "ACCOMMODATION":
        return "bg-secondary/10 text-secondary";
      case "ATTRACTION":
      case "TRANSPORT":
        return "bg-primary/10 text-primary";
      default:
        return "bg-surface-container-high text-on-surface-variant";
    }
  }
}
