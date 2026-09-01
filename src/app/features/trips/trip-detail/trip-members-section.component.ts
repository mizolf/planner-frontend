import { Component, ViewChild, inject, input, output } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import {
  MemberRole,
  TripMemberResponse,
} from '../../../core/models/trip.model';
import { TripService } from '../../../core/services/trip.service';
import { ToastService } from '../../../shared/services/toast.service';
import { initialsOf } from '../../../shared/utils/initials';
import { getMemberRoleColor } from '../../../shared/utils/member-role-color';
import { RemoveMemberDialogComponent } from './remove-member-dialog.component';
import { LocalizedDatePipe } from '../../../shared/pipes/localized-date.pipe';

@Component({
  selector: 'app-trip-members-section',
  standalone: true,
  imports: [LocalizedDatePipe, TranslateModule, RemoveMemberDialogComponent],
  templateUrl: './trip-members-section.component.html',
})
export class TripMembersSectionComponent {
  private readonly tripService = inject(TripService);
  private readonly toastService = inject(ToastService);

  readonly tripId = input.required<number>();
  readonly members = input.required<TripMemberResponse[]>();
  readonly isOwner = input(false);
  readonly currentUserId = input<number | null>(null);
  readonly invite = output<void>();

  @ViewChild(RemoveMemberDialogComponent)
  removeDialog?: RemoveMemberDialogComponent;

  initialsOf = initialsOf;
  getMemberRoleColor = getMemberRoleColor;

  canManage(member: TripMemberResponse): boolean {
    return (
      this.isOwner() &&
      member.userId !== this.currentUserId() &&
      member.role !== 'OWNER'
    );
  }

  onRoleChange(
    member: TripMemberResponse,
    newRole: MemberRole,
    selectEl: HTMLSelectElement,
  ): void {
    if (newRole === member.role) return;

    this.tripService
      .updateMemberRole(this.tripId(), member.userId, newRole)
      .subscribe({
        next: () => {
          this.toastService.show({
            message: 'TRIPS.DETAIL.MEMBERS.ROLE_CHANGE.SUCCESS',
            type: 'success',
          });
        },
        error: (err: HttpErrorResponse) => {
          // Revert the native select to the role we still have in state.
          selectEl.value = member.role;
          this.toastService.show({
            message:
              err.status === 403
                ? 'TRIPS.DETAIL.MEMBERS.ROLE_CHANGE.ERROR_FORBIDDEN'
                : 'TRIPS.DETAIL.MEMBERS.ROLE_CHANGE.ERROR_GENERIC',
            type: 'error',
          });
        },
      });
  }

  openRemove(member: TripMemberResponse): void {
    this.removeDialog?.open(this.tripId(), member);
  }
}
