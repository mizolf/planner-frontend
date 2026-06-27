import { Component, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FeaturedTemplateResponse } from '../../../core/models/explore.model';

@Component({
  selector: 'app-template-card',
  standalone: true,
  imports: [NgClass, TranslateModule],
  templateUrl: './template-card.component.html',
})
export class TemplateCardComponent {
  readonly template = input.required<FeaturedTemplateResponse>();
  readonly cardClick = output<FeaturedTemplateResponse>();

  onClick(): void {
    this.cardClick.emit(this.template());
  }

  seasonKey(season: string): string {
    return `EXPLORE.SEASON.${season}`;
  }

  /**
   * Presentational only: a stable sky/earth/sunset tone for the placeholder cover,
   * derived from the template id so the same template always gets the same colour.
   */
  tone(): 'sky' | 'earth' | 'sunset' {
    const tones = ['sky', 'earth', 'sunset'] as const;
    const key = String(this.template().id ?? this.template().name ?? '');
    let sum = 0;
    for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
    return tones[sum % tones.length];
  }

  /**
   * Presentational only: a short cover label derived from the destination city
   * (e.g. "Amsterdam, Netherlands" → "AMS"). Stands in for a cover image.
   */
  coverLabel(): string {
    const city = (this.template().destination ?? '').split(',')[0];
    const letters = city.replace(/[^a-zA-ZÀ-ſ]/g, '');
    return (letters.slice(0, 3) || '—').toUpperCase();
  }
}
