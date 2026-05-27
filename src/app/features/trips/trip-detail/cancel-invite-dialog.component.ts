import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  output,
  signal,
} from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { TranslateModule } from "@ngx-translate/core";

import { InviteService } from "../../../core/services/invite.service";
import {
  InviteErrorCode,
  TripInviteResponse,
} from "../../../core/models/invite.model";
import { ToastService } from "../../../shared/services/toast.service";

@Component({
  selector: "app-cancel-invite-dialog",
  standalone: true,
  imports: [TranslateModule],
  templateUrl: "./cancel-invite-dialog.component.html",
})
export class CancelInviteDialogComponent {
  private readonly inviteService = inject(InviteService);
  private readonly toastService = inject(ToastService);

  private readonly _tripId = signal<number | null>(null);
  private readonly _invite = signal<TripInviteResponse | null>(null);

  readonly invite = this._invite.asReadonly();
  readonly isOpen = computed(() => this._invite() !== null);
  readonly loading = signal(false);

  readonly cancelled = output<number>();

  @ViewChild("cancelBtn") cancelBtn?: ElementRef<HTMLButtonElement>;
  private previouslyFocused: HTMLElement | null = null;

  @HostListener("document:keydown.escape")
  onEscapeKey(): void {
    if (this.isOpen()) this.close();
  }

  open(tripId: number, invite: TripInviteResponse): void {
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this._tripId.set(tripId);
    this._invite.set(invite);
    document.body.style.overflow = "hidden";
    queueMicrotask(() => this.cancelBtn?.nativeElement.focus());
  }

  close(): void {
    if (this.loading()) return;
    this._invite.set(null);
    this._tripId.set(null);
    document.body.style.overflow = "";
    this.previouslyFocused?.focus();
    this.previouslyFocused = null;
  }

  confirm(): void {
    const tripId = this._tripId();
    const invite = this._invite();
    if (tripId === null || invite === null) return;

    this.loading.set(true);
    this.inviteService.cancelInvite(tripId, invite.id).subscribe({
      next: () => {
        this.loading.set(false);
        this.cancelled.emit(invite.id);
        this.close();
        this.toastService.show({
          message: "INVITES.SUCCESS.CANCELLED",
          type: "success",
        });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const code = err.error?.code as InviteErrorCode | undefined;
        const alreadyGone =
          err.status === 404 ||
          (err.status === 409 && code === "INVITE_NOT_PENDING");
        if (alreadyGone) {
          this.cancelled.emit(invite.id);
          this.close();
        }
        this.toastService.show({
          message: this.inviteService.mapToErrorKind(err),
          type: "error",
        });
      },
    });
  }
}
