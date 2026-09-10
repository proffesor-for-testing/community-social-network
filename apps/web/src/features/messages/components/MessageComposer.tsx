import React, { useState, type KeyboardEvent } from 'react';
import { Button } from '../../../shared/components/atoms/Button';

interface MessageComposerProps {
  onSend: (content: string) => void;
  isSending: boolean;
}

const MAX_LENGTH = 2000;

export function MessageComposer({ onSend, isSending }: MessageComposerProps) {
  const [draft, setDraft] = useState('');
  const canSend = draft.trim().length > 0 && !isSending;

  function submit() {
    if (!canSend) return;
    onSend(draft.trim());
    setDraft('');
  }

  // Enter sends; Shift+Enter keeps the newline.
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-gray-200 p-3 dark:border-gray-700">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
        onKeyDown={handleKeyDown}
        rows={1}
        maxLength={MAX_LENGTH}
        aria-label="Message"
        placeholder="Write a message…"
        className="max-h-32 min-h-[38px] flex-1 resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-surface-dark-secondary dark:text-gray-100"
      />
      <Button
        type="button"
        size="md"
        onClick={submit}
        disabled={!canSend}
        loading={isSending}
      >
        Send
      </Button>
    </div>
  );
}
