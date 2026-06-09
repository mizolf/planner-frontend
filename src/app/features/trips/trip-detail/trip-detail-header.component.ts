import { Component, computed, input, output, signal } from '@angular/core';
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
  readonly canEdit = input(false);
  readonly canDelete = input(false);
  readonly canLeave = input(false);

  readonly edit = output<void>();
  readonly delete = output<void>();
  readonly leave = output<void>();

  readonly menuOpen = signal(false);

  readonly visibleMembers = computed(() => this.trip().members.slice(0, MAX_AVATARS));
  readonly overflowCount = computed(() => Math.max(0, this.trip().members.length - MAX_AVATARS));

  readonly totalSpent = computed(() =>
    this.trip().days.reduce(
      (sum, d) => sum + d.activities.reduce((s, a) => s + (a.cost ?? 0), 0),
      0,
    ),
  );
  readonly hasSpent = computed(() => this.totalSpent() > 0);
  readonly hasBudget = computed(() => {
    const b = this.trip().budget;
    return b != null && b > 0;
  });
  readonly overBudget = computed(() => {
    const b = this.trip().budget;
    return b != null && this.totalSpent() > b;
  });
  /** Spent as a % of budget (can exceed 100 when over budget). */
  readonly spentPercent = computed(() => {
    const b = this.trip().budget;
    if (b == null || b <= 0) return 0;
    return Math.round((this.totalSpent() / b) * 100);
  });
  /** Bar fill width, capped at 100% even when over budget. */
  readonly barWidth = computed(() => Math.min(100, this.spentPercent()));

  initialsOf = initialsOf;
  getStatusColor = (): string => getTripStatusColor(this.trip().status);

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }
}
