import React from 'react';
import type { DirectMessageDto } from '../../../api/types';
import { formatTimeAgo } from '../format-time';

interface MessageBubbleProps {
  message: DirectMessageDto;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  return (
    <li className={isOwn ? 'flex justify-end' : 'flex justify-start'}>
      <div className="max-w-[75%]">
        <div
          className={[
            'whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm',
            isOwn
              ? 'rounded-br-sm bg-brand-600 text-white dark:bg-brand-500'
              : 'rounded-bl-sm bg-gray-100 text-gray-900 dark:bg-surface-dark-tertiary dark:text-gray-100',
          ].join(' ')}
        >
          {message.content}
        </div>
        <p
          className={[
            'mt-1 text-[10px] text-gray-400 dark:text-gray-500',
            isOwn ? 'text-right' : 'text-left',
          ].join(' ')}
        >
          {formatTimeAgo(message.createdAt)}
        </p>
      </div>
    </li>
  );
}
