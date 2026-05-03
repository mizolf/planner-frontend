import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TripDayResponse } from '../../../core/models/trip.model';
import { formatTime } from '../../../shared/utils/format-time';

@Component({
  selector: 'app-trip-day-card',
  standalone: true,
  imports: [DatePipe, TranslateModule],
  templateUrl: './trip-day-card.component.html',
})
export class TripDayCardComponent {
  readonly day = input.required<TripDayResponse>();
  readonly isLast = input(false);
  readonly index = input(0);

  formatTime = formatTime;
}
