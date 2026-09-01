import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TripResponse } from '../../../core/models/trip.model';
import { getTripStatusColor } from '../../../shared/utils/trip-status-color';
import { LocalizedDatePipe } from '../../../shared/pipes/localized-date.pipe';

@Component({
  selector: 'app-trip-card',
  standalone: true,
  imports: [RouterLink, LocalizedDatePipe, NgClass, TranslateModule],
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

  /**
   * Presentational only: a stable sky/earth/sunset tone for the gradient cover,
   * derived from the trip id so the same trip always gets the same colour.
   */
  tone(): 'sky' | 'earth' | 'sunset' {
    const tones = ['sky', 'earth', 'sunset'] as const;
    const key = String(this.trip().id ?? this.trip().name ?? '');
    let sum = 0;
    for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
    return tones[sum % tones.length];
  }

  /**
   * Presentational only: a short cover label derived from the destination city
   * (e.g. "Amsterdam, Netherlands" → "AMS"). Stands in for a cover image.
   */
  coverLabel(): string {
    const city = (this.trip().destination ?? '').split(',')[0];
    const letters = city.replace(/[^a-zA-ZÀ-ſ]/g, '');
    return (letters.slice(0, 3) || '—').toUpperCase();
  }
}
