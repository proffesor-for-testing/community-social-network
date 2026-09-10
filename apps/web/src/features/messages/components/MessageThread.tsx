import React, { useEffect, useMemo, useRef } from 'react';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { Button } from '../../../shared/components/atoms/Button';
import { useAuthStore } from '../../../stores/auth.store';
import { useMessages } from '../hooks/useMessages';
import { useSendMessage } from '../hooks/useSendMessage';
import { useMarkReadOnOpen } from '../hooks/useMarkConversationRead';
import { useConversations } from '../hooks/useConversations';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';

interface MessageThreadProps {
  conversationId: string;
}

export function MessageThread({ conversationId }: MessageThreadProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessages(conversationId);
  const sendMutation = useSendMessage(conversationId);
  const { data: conversationList } = useConversations();
  const bottomRef = useRef<HTMLDivElement>(null);

  useMarkReadOnOpen(conversationId);

  // Pages arrive newest-page-first, each page ordered oldest -> newest.
  // Reverse the page order to render the whole thread chronologically.
  const messages = useMemo(
    () => (data?.pages ?? []).slice().reverse().flatMap((page) => page.items),
    [data],
  );

  const header = conversationList?.items.find((c) => c.id === conversationId);
  const newestId = messages[messages.length - 1]?.id;

  // Stick to the bottom as new messages land.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [newestId, conversationId]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="m-4 rounded-lg bg-red-50 p-6 text-center dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">
          {error?.message ?? 'Failed to load this conversation.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {header?.otherDisplayName ?? 'Conversation'}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {hasNextPage && (
          <div className="mb-3 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              loading={isFetchingNextPage}
            >
              Load earlier messages
            </Button>
          </div>
        )}

        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No messages yet. Say something.
          </p>
        ) : (
          <ul className="space-y-2">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.senderId === currentUserId}
              />
            ))}
          </ul>
        )}

        <div ref={bottomRef} />
      </div>

      <MessageComposer
        onSend={(content) => sendMutation.mutate(content)}
        isSending={sendMutation.isPending}
      />
    </div>
  );
}
