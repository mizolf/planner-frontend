import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, NgClass } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TripResponse } from '../../../core/models/trip.model';
import { getTripStatusColor } from '../../../shared/utils/trip-status-color';

@Component({
  selector: 'app-trip-card',
  standalone: true,
  imports: [RouterLink, DatePipe, NgClass, TranslateModule],
  templateUrl: './trip-card.component.html',
})
export class TripCardComponent {
  readonly trip = input.required<TripResponse>();

  getDaysToGo(): number | null {
    const trip = this.trip();
    if (trip.status !== 'UPCOMING') return null;
    const start = new Date(trip.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  }

  getStatusColor(): string {
    return getTripStatusColor(this.trip().status);
  }
}
