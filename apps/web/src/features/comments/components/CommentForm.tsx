import React, { useState, type FormEvent } from 'react';
import { Button } from '../../../shared/components/atoms/Button';
import { useCreateComment } from '../hooks/useCreateComment';

interface CommentFormProps {
  publicationId: string;
  parentId?: string;
  onSuccess?: () => void;
  compact?: boolean;
}

export function CommentForm({
  publicationId,
  parentId,
  onSuccess,
  compact = false,
}: CommentFormProps) {
  const [body, setBody] = useState('');
  const createMutation = useCreateComment();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    createMutation.mutate(
      { publicationId, body: body.trim(), parentId },
      {
        onSuccess: () => {
          setBody('');
          onSuccess?.();
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentId ? 'Write a reply...' : 'Write a comment...'}
        rows={compact ? 2 : 3}
        maxLength={2000}
        className="input-base flex-1 resize-none"
        required
      />
      <Button
        type="submit"
        size={compact ? 'sm' : 'md'}
        loading={createMutation.isPending}
        disabled={!body.trim()}
        className="self-end"
      >
        {parentId ? 'Reply' : 'Comment'}
      </Button>
    </form>
  );
}
