import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, NgClass } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TripResponse, TripStatus } from '../../../core/models/trip.model';

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
    const colors: Record<TripStatus, string> = {
      PLANNING: 'bg-primary/10 text-primary',
      UPCOMING: 'bg-secondary/10 text-secondary',
      IN_PROGRESS: 'bg-tertiary/10 text-tertiary',
      COMPLETED: 'bg-on-surface-variant/10 text-on-surface-variant',
    };
    return colors[this.trip().status];
  }
}
