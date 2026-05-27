import {
  Component,
  OnInit,
  ViewChild,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { TranslateModule } from "@ngx-translate/core";

import { InviteService } from "../../../core/services/invite.service";
import { TripInviteResponse } from "../../../core/models/invite.model";
import { getMemberRoleColor } from "../../../shared/utils/member-role-color";
import { CancelInviteDialogComponent } from "./cancel-invite-dialog.component";

@Component({
  selector: "app-pending-invites-section",
  standalone: true,
  imports: [TranslateModule, CancelInviteDialogComponent],
  templateUrl: "./pending-invites-section.component.html",
})
export class PendingInvitesSectionComponent implements OnInit {
  private readonly inviteService = inject(InviteService);

  readonly tripId = input.required<number>();
  readonly isOwner = input.required<boolean>();

  private readonly _invites = signal<TripInviteResponse[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly invites = this._invites.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly visible = computed(
    () => this.isOwner() && this._invites().length > 0,
  );

  @ViewChild(CancelInviteDialogComponent)
  cancelDialog?: CancelInviteDialogComponent;

  getMemberRoleColor = getMemberRoleColor;

  ngOnInit(): void {
    if (!this.isOwner()) return;
    this.load(this.tripId());
  }

  addInvite(invite: TripInviteResponse): void {
    this._invites.update((arr) => {
      const idx = arr.findIndex((i) => i.id === invite.id);
      if (idx === -1) return [invite, ...arr];
      const copy = [...arr];
      copy[idx] = invite;
      return copy;
    });
  }

  openCancel(invite: TripInviteResponse): void {
    this.cancelDialog?.open(this.tripId(), invite);
  }

  onCancelled(inviteId: number): void {
    this._invites.update((arr) => arr.filter((i) => i.id !== inviteId));
  }

  daysUntil(iso: string): number {
    const ms = new Date(iso).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  private load(tripId: number): void {
    this._loading.set(true);
    this._error.set(null);
    this.inviteService.listTripInvites(tripId, "PENDING").subscribe({
      next: (invites) => {
        this._invites.set(invites);
        this._loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this._loading.set(false);
        this._error.set(this.inviteService.mapToErrorKind(err));
      },
    });
  }
}
