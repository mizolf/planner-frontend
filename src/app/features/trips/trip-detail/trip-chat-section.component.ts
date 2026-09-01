import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { TranslateModule } from "@ngx-translate/core";
import { ChatMessageResponse } from "../../../core/models/chat.model";
import { ChatService } from "../../../core/services/chat.service";
import { ToastService } from "../../../shared/services/toast.service";
import { initialsOf } from "../../../shared/utils/initials";
import { DeleteMessageDialogComponent } from "./delete-message-dialog.component";
import { LocalizedDatePipe } from "../../../shared/pipes/localized-date.pipe";

@Component({
  selector: "app-trip-chat-section",
  standalone: true,
  imports: [LocalizedDatePipe, TranslateModule, DeleteMessageDialogComponent],
  templateUrl: "./trip-chat-section.component.html",
})
export class TripChatSectionComponent implements OnInit, OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly toastService = inject(ToastService);

  readonly tripId = input.required<number>();
  readonly currentUserId = input<number | null>(null);

  // Expose the service's reactive state straight to the template.
  readonly messages = this.chatService.messages;
  readonly loading = this.chatService.loading;
  readonly loadingOlder = this.chatService.loadingOlder;
  readonly error = this.chatService.error;
  readonly hasMore = this.chatService.hasMore;
  readonly sending = this.chatService.sending;
  readonly unreadCount = this.chatService.unreadCount;
  readonly connected = this.chatService.connected;

  readonly expanded = signal(false);
  readonly draft = signal("");
  readonly editingId = signal<number | null>(null);
  readonly editDraft = signal("");

  // Track whether history has been fetched once (live messages keep it current after).
  private loaded = false;
  // Plain flag (not a signal): tells the auto-scroll effect to jump to the bottom.
  private pendingScrollToBottom = false;

  private readonly scrollBox =
    viewChild<ElementRef<HTMLElement>>("scrollBox");
  private readonly deleteDialog = viewChild(DeleteMessageDialogComponent);

  readonly initialsOf = initialsOf;

  constructor() {
    // Auto-scroll to newest. DOM-only side effect (no signal writes → no NG0600).
    effect(() => {
      this.messages(); // track new/changed messages
      if (!this.expanded()) return;
      const el = this.scrollBox()?.nativeElement;
      if (!el) return;
      const nearBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      if (this.pendingScrollToBottom || nearBottom) {
        this.pendingScrollToBottom = false;
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      }
    });
  }

  ngOnInit(): void {
    // Connect the socket from the start so the unread badge grows live even
    // while the panel is collapsed. History is fetched lazily on first open.
    this.chatService.loadUnreadCount(this.tripId());
    this.chatService.connect(this.tripId(), this.currentUserId());
  }

  ngOnDestroy(): void {
    this.chatService.disconnect();
  }

  isOwn(message: ChatMessageResponse): boolean {
    // senderId is null for deleted authors; without the guard a null senderId
    // would match currentUserId while it is still null (user not yet loaded).
    return message.senderId !== null && message.senderId === this.currentUserId();
  }

  toggle(): void {
    const open = !this.expanded();
    this.expanded.set(open);
    this.chatService.setActive(open);
    if (!open) return;

    if (!this.loaded) {
      this.chatService.loadMessages(this.tripId());
      this.loaded = true;
    }
    this.chatService.markRead(this.tripId());
    this.pendingScrollToBottom = true;
  }

  loadOlder(): void {
    this.chatService.loadOlder(this.tripId());
  }

  retry(): void {
    this.chatService.loadMessages(this.tripId());
  }

  send(): void {
    const content = this.draft().trim();
    if (!content || content.length > 2000 || this.sending()) return;
    this.chatService.sendMessage(this.tripId(), content).subscribe({
      next: () => {
        this.draft.set("");
        this.pendingScrollToBottom = true;
      },
      error: () => this.showGenericError(),
    });
  }

  onComposerKeydown(event: KeyboardEvent): void {
    // Enter sends; Shift+Enter inserts a newline.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  startEdit(message: ChatMessageResponse): void {
    if (!this.isOwn(message)) return;
    this.editingId.set(message.id);
    this.editDraft.set(message.content);
  }

  saveEdit(message: ChatMessageResponse): void {
    const content = this.editDraft().trim();
    if (!content || content.length > 2000) return;
    if (content === message.content) {
      this.editingId.set(null);
      return;
    }
    this.chatService.editMessage(this.tripId(), message.id, content).subscribe({
      next: () => this.editingId.set(null),
      error: () => this.showGenericError(),
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  confirmDelete(message: ChatMessageResponse): void {
    this.deleteDialog()?.open(this.tripId(), message);
  }

  private showGenericError(): void {
    this.toastService.show({
      message: "TRIPS.DETAIL.CHAT.ERROR.GENERIC",
      type: "error",
    });
  }
}
