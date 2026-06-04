import { Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { FeaturedTemplateResponse } from '../../../core/models/explore.model';

@Component({
  selector: 'app-template-card',
  standalone: true,
  imports: [TranslateModule],
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
}
