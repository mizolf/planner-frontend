import { Component, ViewChild, inject } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { Router } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";

import { InviteService } from "../../core/services/invite.service";
import {
  InviteErrorCode,
  MyInviteResponse,
} from "../../core/models/invite.model";
import { ToastService } from "../../shared/services/toast.service";
import { getMemberRoleColor } from "../../shared/utils/member-role-color";
import { DeclineInviteDialogComponent } from "./decline-invite-dialog.component";

@Component({
  selector: "app-invites-page",
  standalone: true,
  imports: [TranslateModule, DeclineInviteDialogComponent],
  templateUrl: "./invites-page.component.html",
})
export class InvitesPageComponent {
  private readonly inviteService = inject(InviteService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  readonly invites = this.inviteService.myPendingInvites;
  readonly loading = this.inviteService.loading;
  readonly accepting = new Set<number>();

  @ViewChild(DeclineInviteDialogComponent)
  declineDialog?: DeclineInviteDialogComponent;

  getMemberRoleColor = getMemberRoleColor;

  accept(invite: MyInviteResponse): void {
    if (this.accepting.has(invite.id)) return;
    this.accepting.add(invite.id);

    this.inviteService.acceptInvite(invite.id).subscribe({
      next: () => {
        this.accepting.delete(invite.id);
        this.toastService.show({
          message: "INVITES.SUCCESS.ACCEPTED",
          type: "success",
          action: {
            label: "INVITES.MINE.VIEW_TRIP",
            onClick: () => this.router.navigate(["/trips", invite.tripId]),
          },
        });
      },
      error: (err: HttpErrorResponse) => {
        this.accepting.delete(invite.id);
        this.handleError(err);
      },
    });
  }

  decline(invite: MyInviteResponse): void {
    this.declineDialog?.open(invite);
  }

  daysUntil(iso: string): number {
    const ms = new Date(iso).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  private handleError(err: HttpErrorResponse): void {
    const code = err.error?.code as InviteErrorCode | undefined;
    const shouldRefresh =
      err.status === 403 ||
      err.status === 404 ||
      (err.status === 409 &&
        (code === "INVITE_NOT_PENDING" || code === "INVITE_EXPIRED"));

    this.toastService.show({
      message: this.inviteService.mapToErrorKind(err),
      type: "error",
    });

    if (shouldRefresh) {
      this.inviteService.loadMyInvites();
    }
  }
}
