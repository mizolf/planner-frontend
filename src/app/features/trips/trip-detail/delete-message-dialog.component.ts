import { Component, HostListener, computed, inject, signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { TranslateModule } from "@ngx-translate/core";
import { ChatMessageResponse } from "../../../core/models/chat.model";
import { ChatService } from "../../../core/services/chat.service";
import { ToastService } from "../../../shared/services/toast.service";

@Component({
  selector: "app-delete-message-dialog",
  standalone: true,
  imports: [TranslateModule],
  templateUrl: "./delete-message-dialog.component.html",
})
export class DeleteMessageDialogComponent {
  private readonly chatService = inject(ChatService);
  private readonly toastService = inject(ToastService);

  private readonly _tripId = signal<number | null>(null);
  private readonly _message = signal<ChatMessageResponse | null>(null);

  readonly message = this._message.asReadonly();
  readonly isOpen = computed(() => this._message() !== null);
  readonly loading = signal(false);

  @HostListener("document:keydown.escape")
  onEscapeKey(): void {
    if (this.isOpen()) this.close();
  }

  open(tripId: number, message: ChatMessageResponse): void {
    this._tripId.set(tripId);
    this._message.set(message);
    document.body.style.overflow = "hidden";
  }

  close(): void {
    if (this.loading()) return;
    this._tripId.set(null);
    this._message.set(null);
    document.body.style.overflow = "";
  }

  confirm(): void {
    const tripId = this._tripId();
    const message = this._message();
    if (tripId === null || message === null) return;

    this.loading.set(true);
    this.chatService.deleteMessage(tripId, message.id).subscribe({
      next: () => this.deleteSucceeded(),
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        // Already gone — the desired end state is reached anyway.
        if (err.status === 404) {
          this.deleteSucceeded();
          return;
        }
        if (err.status === 403) {
          this.toastService.show({
            message: "TRIPS.DETAIL.CHAT.DELETE_CONFIRM.ERROR_FORBIDDEN",
            type: "error",
          });
          return;
        }
        this.toastService.show({
          message: "TRIPS.DETAIL.CHAT.DELETE_CONFIRM.ERROR_GENERIC",
          type: "error",
        });
      },
    });
  }

  private deleteSucceeded(): void {
    this.loading.set(false);
    this._tripId.set(null);
    this._message.set(null);
    document.body.style.overflow = "";
    this.toastService.show({
      message: "TRIPS.DETAIL.CHAT.DELETE_CONFIRM.SUCCESS",
      type: "success",
    });
  }
}
