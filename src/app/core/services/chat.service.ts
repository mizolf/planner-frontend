import { Injectable, inject, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, finalize } from "rxjs";
import { Client, IMessage } from "@stomp/stompjs";
import { environment } from "../../../environments/environment";
import { AuthService } from "../../auth/services/auth.service";
import {
  ChatEvent,
  ChatMessagePage,
  ChatMessageResponse,
  UnreadCountResponse,
} from "../models/chat.model";

const PAGE_SIZE = 30;

// Trip chat state + transport. Every write goes through REST; the WebSocket only
// pushes ChatEvent broadcasts which `applyEvent` folds into the message list
// (deduped by id). The service is a singleton — one trip is in focus at a time,
// so connect()/disconnect() reset state via clear(). See docs/trip-chat.md.
@Injectable({ providedIn: "root" })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/trips`;

  private readonly _messages = signal<ChatMessageResponse[]>([]);
  private readonly _loading = signal(false);
  private readonly _loadingOlder = signal(false);
  private readonly _error = signal(false);
  private readonly _hasMore = signal(false);
  private readonly _sending = signal(false);
  private readonly _unreadCount = signal(0);
  private readonly _connected = signal(false);

  readonly messages = this._messages.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loadingOlder = this._loadingOlder.asReadonly();
  readonly error = this._error.asReadonly();
  readonly hasMore = this._hasMore.asReadonly();
  readonly sending = this._sending.asReadonly();
  readonly unreadCount = this._unreadCount.asReadonly();
  readonly connected = this._connected.asReadonly();

  // Internal control state (not reactive): drives the unread reducer + socket.
  private _client?: Client;
  private _tripId: number | null = null;
  private _currentUserId: number | null = null;
  private _active = false; // is the chat panel currently open?

  // ── REST: history ──

  /** First page — newest PAGE_SIZE messages, ordered oldest → newest. */
  loadMessages(tripId: number): void {
    this._loading.set(true);
    this._error.set(false);
    this.http
      .get<ChatMessagePage>(`${this.apiUrl}/${tripId}/messages`, {
        params: { limit: PAGE_SIZE },
      })
      .subscribe({
        next: (page) => {
          this._messages.set(page.content);
          this._hasMore.set(page.hasMore);
          this._loading.set(false);
        },
        error: () => {
          this._loading.set(false);
          this._error.set(true);
        },
      });
  }

  /** Older page — keyset paginate backward using the oldest loaded id. */
  loadOlder(tripId: number): void {
    const current = this._messages();
    if (current.length === 0 || this._loadingOlder()) return;
    const before = current[0].id; // content is oldest → newest, so [0] is oldest
    this._loadingOlder.set(true);
    this.http
      .get<ChatMessagePage>(`${this.apiUrl}/${tripId}/messages`, {
        params: { before, limit: PAGE_SIZE },
      })
      .subscribe({
        next: (page) => {
          this._messages.update((msgs) => [...page.content, ...msgs]);
          this._hasMore.set(page.hasMore);
          this._loadingOlder.set(false);
        },
        error: () => {
          this._loadingOlder.set(false);
        },
      });
  }

  // ── REST: writes (list updates arrive via broadcast, never mutated here) ──

  sendMessage(
    tripId: number,
    content: string,
  ): Observable<ChatMessageResponse> {
    this._sending.set(true);
    return this.http
      .post<ChatMessageResponse>(`${this.apiUrl}/${tripId}/messages`, {
        content,
      })
      .pipe(finalize(() => this._sending.set(false)));
  }

  editMessage(
    tripId: number,
    messageId: number,
    content: string,
  ): Observable<ChatMessageResponse> {
    return this.http.put<ChatMessageResponse>(
      `${this.apiUrl}/${tripId}/messages/${messageId}`,
      { content },
    );
  }

  deleteMessage(tripId: number, messageId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${tripId}/messages/${messageId}`,
    );
  }

  // ── REST: unread badge ──

  loadUnreadCount(tripId: number): void {
    this.http
      .get<UnreadCountResponse>(`${this.apiUrl}/${tripId}/messages/unread-count`)
      .subscribe({
        next: (res) => this._unreadCount.set(res.count),
        error: () => {},
      });
  }

  markRead(tripId: number): void {
    this._unreadCount.set(0); // optimistic — badge clears the moment the panel opens
    this.http
      .post<void>(`${this.apiUrl}/${tripId}/messages/read`, {})
      .subscribe({ error: () => {} });
  }

  // ── WebSocket / STOMP (receive-only) ──

  connect(tripId: number, currentUserId: number | null): void {
    this.clear();
    this._tripId = tripId;
    this._currentUserId = currentUserId;

    const client = new Client({
      brokerURL: environment.wsUrl,
      reconnectDelay: 5000,
      // Read a fresh token on every (re)connect so a rotated token still works.
      beforeConnect: () => {
        client.connectHeaders = {
          Authorization: `Bearer ${this.authService.token() ?? ""}`,
        };
      },
      onConnect: () => {
        this._connected.set(true);
        client.subscribe(`/topic/trips/${tripId}`, (frame: IMessage) => {
          this.applyEvent(JSON.parse(frame.body) as ChatEvent);
        });
        // Re-sync over REST to fill any events missed while the socket was down.
        this.loadUnreadCount(tripId);
        if (this._active) {
          this.loadMessages(tripId);
        }
      },
      onWebSocketClose: () => this._connected.set(false),
      onStompError: () => this._connected.set(false),
    });

    this._client = client;
    client.activate();
  }

  disconnect(): void {
    this._client?.deactivate();
    this._client = undefined;
    this.clear();
  }

  /** The chat panel reports its open/closed state so unread isn't counted while visible. */
  setActive(open: boolean): void {
    this._active = open;
  }

  private applyEvent(event: ChatEvent): void {
    switch (event.type) {
      case "CREATED": {
        const msg = event.message;
        this._messages.update((msgs) =>
          msgs.some((m) => m.id === msg.id) ? msgs : [...msgs, msg],
        );
        if (msg.senderId !== this._currentUserId) {
          if (this._active && this._tripId !== null) {
            // Panel is open → the user is seeing it; persist read so the
            // backend's last-read keeps up (and a reconnect won't re-flag it).
            this.markRead(this._tripId);
          } else {
            this._unreadCount.update((n) => n + 1);
          }
        }
        break;
      }
      case "UPDATED": {
        const msg = event.message;
        this._messages.update((msgs) =>
          msgs.map((m) => (m.id === msg.id ? msg : m)),
        );
        break;
      }
      case "DELETED": {
        const id = event.message.id;
        this._messages.update((msgs) => msgs.filter((m) => m.id !== id));
        break;
      }
    }
  }

  private clear(): void {
    this._messages.set([]);
    this._loading.set(false);
    this._loadingOlder.set(false);
    this._error.set(false);
    this._hasMore.set(false);
    this._sending.set(false);
    this._unreadCount.set(0);
    this._connected.set(false);
    this._tripId = null;
    this._currentUserId = null;
    this._active = false;
  }
}
