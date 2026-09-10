import type { ConversationDto, DirectMessageDto } from '../../api/types';
import { apiClient } from '../../api/client';

// ── Query Key Factories ─────────────────────────────────────────

export const messageKeys = {
  all: ['conversations'] as const,
  list: () => [...messageKeys.all, 'list'] as const,
  thread: (conversationId: string) =>
    [...messageKeys.all, 'thread', conversationId] as const,
};

// ── API shapes ──────────────────────────────────────────────────

// The API returns the conversation with a nested otherParticipant block;
// the FE flattens it so list rows read without drilling.
type ApiMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
};

type ApiConversation = {
  id: string;
  otherParticipant?: { memberId?: string; displayName?: string };
  lastMessage?: ApiMessage | null;
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
};

type ApiConversationList = {
  items: ApiConversation[];
  totalUnread: number;
};

type ApiMessagePage = {
  items: ApiMessage[];
  nextCursor: string | null;
  hasMore: boolean;
};

// ── Adapters ────────────────────────────────────────────────────

export function adaptMessage(m: ApiMessage): DirectMessageDto {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    content: m.content ?? '',
    createdAt: m.createdAt,
    readAt: m.readAt ?? null,
  };
}

export function adaptConversation(c: ApiConversation): ConversationDto {
  const displayName = c.otherParticipant?.displayName;
  return {
    id: c.id,
    otherMemberId: c.otherParticipant?.memberId ?? '',
    otherDisplayName: displayName?.trim() ? displayName : 'Member',
    lastMessage: c.lastMessage ? adaptMessage(c.lastMessage) : null,
    unreadCount: c.unreadCount ?? 0,
    updatedAt: c.updatedAt,
  };
}

// ── Page shapes returned to the hooks ───────────────────────────

export interface ConversationListPage {
  items: ConversationDto[];
  totalUnread: number;
}

export interface MessageThreadPage {
  items: DirectMessageDto[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ── API Functions ───────────────────────────────────────────────

export async function fetchConversations(): Promise<ConversationListPage> {
  const { data } = await apiClient.get<ApiConversationList>('/conversations');
  return {
    items: (data.items ?? []).map(adaptConversation),
    totalUnread: data.totalUnread ?? 0,
  };
}

export async function startConversation(
  recipientId: string,
): Promise<ConversationDto> {
  const { data } = await apiClient.post<ApiConversation>('/conversations', {
    recipientId,
  });
  return adaptConversation(data);
}

export async function fetchMessages(
  conversationId: string,
  cursor?: string,
): Promise<MessageThreadPage> {
  const params: Record<string, string> = { limit: '30' };
  if (cursor) {
    params.cursor = cursor;
  }
  const { data } = await apiClient.get<ApiMessagePage>(
    `/conversations/${conversationId}/messages`,
    { params },
  );
  return {
    items: (data.items ?? []).map(adaptMessage),
    nextCursor: data.nextCursor ?? null,
    hasMore: data.hasMore ?? false,
  };
}

export async function sendMessage(
  conversationId: string,
  content: string,
): Promise<DirectMessageDto> {
  const { data } = await apiClient.post<ApiMessage>(
    `/conversations/${conversationId}/messages`,
    { content },
  );
  return adaptMessage(data);
}

export async function markConversationRead(
  conversationId: string,
): Promise<{ markedCount: number }> {
  const { data } = await apiClient.post<{ markedCount: number }>(
    `/conversations/${conversationId}/read`,
  );
  return { markedCount: data?.markedCount ?? 0 };
}
