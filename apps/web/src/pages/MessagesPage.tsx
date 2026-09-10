import React from 'react';
import { useParams } from 'react-router-dom';
import { ConversationList } from '../features/messages/components/ConversationList';
import { MessageThread } from '../features/messages/components/MessageThread';

/**
 * Two-pane inbox: conversations on the left, the open thread on the right.
 * On narrow screens the thread replaces the list once one is selected.
 */
export default function MessagesPage() {
  const { conversationId } = useParams<{ conversationId: string }>();

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-surface-dark-secondary">
      <aside
        className={[
          'w-full shrink-0 overflow-y-auto border-gray-200 dark:border-gray-700 md:w-80 md:border-r',
          conversationId ? 'hidden md:block' : 'block',
        ].join(' ')}
      >
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Messages
          </h1>
        </div>
        <ConversationList activeConversationId={conversationId} />
      </aside>

      <section className={conversationId ? 'flex-1' : 'hidden flex-1 md:block'}>
        {conversationId ? (
          <MessageThread key={conversationId} conversationId={conversationId} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select a conversation to start reading.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
