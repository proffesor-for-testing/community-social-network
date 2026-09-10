import React from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../../shared/components/atoms/Avatar';
import { Spinner } from '../../../shared/components/atoms/Spinner';
import { useConversations } from '../hooks/useConversations';
import { formatTimeAgo } from '../format-time';

interface ConversationListProps {
  /** The conversation currently open in the thread pane, if any. */
  activeConversationId?: string;
}

export function ConversationList({ activeConversationId }: ConversationListProps) {
  const { data, isLoading, isError, error } = useConversations();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-center dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">
          {error?.message ?? 'Failed to load conversations.'}
        </p>
      </div>
    );
  }

  const conversations = data?.items ?? [];

  if (conversations.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        No conversations yet. Open someone&apos;s profile and say hello.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
      {conversations.map((conversation) => {
        const isActive = conversation.id === activeConversationId;
        return (
          <li key={conversation.id}>
            <Link
              to={`/messages/${conversation.id}`}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'flex items-start gap-3 px-4 py-3 transition-colors',
                isActive
                  ? 'bg-brand-50 dark:bg-surface-dark-tertiary'
                  : 'hover:bg-gray-50 dark:hover:bg-surface-dark-tertiary',
              ].join(' ')}
            >
              <Avatar src={null} alt={conversation.otherDisplayName} size="md" />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {conversation.otherDisplayName}
                  </p>
                  <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                    {formatTimeAgo(
                      conversation.lastMessage?.createdAt ?? conversation.updatedAt,
                    )}
                  </span>
                </div>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {conversation.lastMessage?.content ?? 'No messages yet'}
                </p>
              </div>

              {conversation.unreadCount > 0 && (
                <span
                  aria-label={`${conversation.unreadCount} unread`}
                  className="mt-1 flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white dark:bg-brand-500"
                >
                  {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
