import { Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TripDayResponse } from '../../../core/models/trip.model';

@Component({
  selector: 'app-trip-day-picker',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './trip-day-picker.component.html',
})
export class TripDayPickerComponent {
  readonly days = input.required<TripDayResponse[]>();
  readonly selectedDayId = input<number | null>(null);
  readonly selectDay = output<number>();

  onSelect(id: number): void {
    this.selectDay.emit(id);
  }
}
