import { Component, input, output } from "@angular/core";
import { DatePipe } from "@angular/common";
import { TranslateModule } from "@ngx-translate/core";
import {
  TripActivityResponse,
  TripDayResponse,
} from "../../../core/models/trip.model";
import { formatTime } from "../../../shared/utils/format-time";

@Component({
  selector: "app-trip-day-card",
  standalone: true,
  imports: [DatePipe, TranslateModule],
  templateUrl: "./trip-day-card.component.html",
})
export class TripDayCardComponent {
  readonly day = input.required<TripDayResponse>();

  readonly canEditDay = input(false);
  readonly editDay = output<void>();

  readonly canDelete = input(false);
  readonly deleteDay = output<void>();

  readonly canAddActivity = input(false);
  readonly addActivity = output<void>();

  readonly canEditActivity = input(false);
  readonly editActivity = output<TripActivityResponse>();

  formatTime = formatTime;
}
