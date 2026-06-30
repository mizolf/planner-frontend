// Wire shapes for the trip chat. Mirrors the backend contract documented in
// docs/trip-chat.md: every write goes through REST, the WebSocket only pushes
// `ChatEvent` broadcasts which the client applies (deduped by id).

export interface ChatMessageResponse {
  id: number;
  senderId: number;
  senderName: string;
  content: string;
  createdAt: string; // ISO instant
  edited: boolean;
}

/** One page of history. `content` is ordered oldest → newest. */
export interface ChatMessagePage {
  content: ChatMessageResponse[];
  hasMore: boolean;
}

export interface SendMessageRequest {
  content: string;
}

export interface UpdateMessageRequest {
  content: string;
}

export interface UnreadCountResponse {
  count: number;
}

/** Broadcast frame received on /topic/trips/{tripId}. For DELETED only `id` matters. */
export type ChatEvent =
  | { type: "CREATED" | "UPDATED"; message: ChatMessageResponse }
  | { type: "DELETED"; message: { id: number } };
