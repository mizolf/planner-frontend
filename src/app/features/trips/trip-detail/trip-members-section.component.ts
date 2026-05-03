import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TripMemberResponse } from '../../../core/models/trip.model';
import { initialsOf } from '../../../shared/utils/initials';
import { getMemberRoleColor } from '../../../shared/utils/member-role-color';

@Component({
  selector: 'app-trip-members-section',
  standalone: true,
  imports: [DatePipe, TranslateModule],
  templateUrl: './trip-members-section.component.html',
})
export class TripMembersSectionComponent {
  readonly members = input.required<TripMemberResponse[]>();

  initialsOf = initialsOf;
  getMemberRoleColor = getMemberRoleColor;
}
