import { Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { PublicTripSummaryResponse } from '../../../core/models/community.model';
import { initialsOf } from '../../../shared/utils/initials';

@Component({
  selector: 'app-public-trip-card',
  standalone: true,
  imports: [NgClass, TranslateModule],
  templateUrl: './public-trip-card.component.html',
})
export class PublicTripCardComponent {
  readonly trip = input.required<PublicTripSummaryResponse>();
  readonly cardClick = output<PublicTripSummaryResponse>();

  initialsOf = initialsOf;

  onClick(): void {
    this.cardClick.emit(this.trip());
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
