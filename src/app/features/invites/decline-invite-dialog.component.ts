import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
} from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { TranslateModule } from "@ngx-translate/core";

import { InviteService } from "../../core/services/invite.service";
import { MyInviteResponse } from "../../core/models/invite.model";
import { ToastService } from "../../shared/services/toast.service";

@Component({
  selector: "app-decline-invite-dialog",
  standalone: true,
  imports: [TranslateModule],
  templateUrl: "./decline-invite-dialog.component.html",
})
export class DeclineInviteDialogComponent {
  private readonly inviteService = inject(InviteService);
  private readonly toastService = inject(ToastService);

  private readonly _invite = signal<MyInviteResponse | null>(null);

  readonly invite = this._invite.asReadonly();
  readonly isOpen = computed(() => this._invite() !== null);
  readonly loading = signal(false);

  @ViewChild("cancelBtn") cancelBtn?: ElementRef<HTMLButtonElement>;
  private previouslyFocused: HTMLElement | null = null;

  @HostListener("document:keydown.escape")
  onEscapeKey(): void {
    if (this.isOpen()) this.close();
  }

  open(invite: MyInviteResponse): void {
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    this._invite.set(invite);
    document.body.style.overflow = "hidden";
    queueMicrotask(() => this.cancelBtn?.nativeElement.focus());
  }

  close(): void {
    if (this.loading()) return;
    this._invite.set(null);
    document.body.style.overflow = "";
    this.previouslyFocused?.focus();
    this.previouslyFocused = null;
  }

  confirm(): void {
    const invite = this._invite();
    if (invite === null) return;

    this.loading.set(true);
    this.inviteService.declineInvite(invite.id).subscribe({
      next: () => {
        this.loading.set(false);
        this.close();
        this.toastService.show({
          message: "INVITES.SUCCESS.DECLINED",
          type: "success",
        });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.close();
        this.toastService.show({
          message: this.inviteService.mapToErrorKind(err),
          type: "error",
        });
        this.inviteService.loadMyInvites();
      },
    });
  }
}
