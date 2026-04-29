import { Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TripStyleResponse } from '../../../core/models/explore.model';

@Component({
  selector: 'app-style-card',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './style-card.component.html',
})
export class StyleCardComponent {
  readonly style = input.required<TripStyleResponse>();
  readonly cardClick = output<TripStyleResponse>();

  onClick(): void {
    this.cardClick.emit(this.style());
  }
}
