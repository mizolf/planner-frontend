import { Component, computed, input } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { TripDetailResponse } from '../../../core/models/trip.model';
import { initialsOf } from '../../../shared/utils/initials';
import { getTripStatusColor } from '../../../shared/utils/trip-status-color';

const MAX_AVATARS = 4;

@Component({
  selector: 'app-trip-detail-header',
  standalone: true,
  imports: [DatePipe, DecimalPipe, NgClass, RouterLink, TranslateModule],
  templateUrl: './trip-detail-header.component.html',
})
export class TripDetailHeaderComponent {
  readonly trip = input.required<TripDetailResponse>();

  readonly visibleMembers = computed(() => this.trip().members.slice(0, MAX_AVATARS));
  readonly overflowCount = computed(() => Math.max(0, this.trip().members.length - MAX_AVATARS));

  initialsOf = initialsOf;
  getStatusColor = (): string => getTripStatusColor(this.trip().status);
}
