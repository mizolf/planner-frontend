import { Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { PublicTripSummaryResponse } from '../../../core/models/community.model';
import { initialsOf } from '../../../shared/utils/initials';

@Component({
  selector: 'app-public-trip-card',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './public-trip-card.component.html',
})
export class PublicTripCardComponent {
  readonly trip = input.required<PublicTripSummaryResponse>();
  readonly cardClick = output<PublicTripSummaryResponse>();

  initialsOf = initialsOf;

  onClick(): void {
    this.cardClick.emit(this.trip());
  }
}
