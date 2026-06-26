import { Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TripStyleResponse } from '../../../core/models/explore.model';

@Component({
  selector: 'app-style-card',
  standalone: true,
  imports: [NgClass, TranslateModule],
  templateUrl: './style-card.component.html',
})
export class StyleCardComponent {
  readonly style = input.required<TripStyleResponse>();
  readonly cardClick = output<TripStyleResponse>();

  onClick(): void {
    this.cardClick.emit(this.style());
  }

  /**
   * Presentational only: a stable sky/earth/sunset tone for the placeholder
   * gradient cover (used when the style has no image), derived from the slug.
   */
  tone(): 'sky' | 'earth' | 'sunset' {
    const tones = ['sky', 'earth', 'sunset'] as const;
    const key = this.style().slug ?? this.style().name ?? '';
    let sum = 0;
    for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
    return tones[sum % tones.length];
  }
}
