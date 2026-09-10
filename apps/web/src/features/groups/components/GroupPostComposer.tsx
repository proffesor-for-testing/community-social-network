import React, { useState, type FormEvent } from 'react';
import { Button } from '../../../shared/components/atoms/Button';
import { Avatar } from '../../../shared/components/atoms/Avatar';
import { useCreateGroupPost } from '../hooks/useCreateGroupPost';
import { useAuthStore } from '../../../stores/auth.store';

interface GroupPostComposerProps {
  groupId: string;
}

export function GroupPostComposer({ groupId }: GroupPostComposerProps) {
  const user = useAuthStore((s) => s.user);
  const createMutation = useCreateGroupPost(groupId);
  const [body, setBody] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const content = body.trim();
    if (!content) return;

    createMutation.mutate(content, {
      onSuccess: () => setBody(''),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <div className="flex gap-3">
        <Avatar alt={user?.displayName ?? 'User'} size="md" />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share something with this group…"
          rows={3}
          maxLength={5000}
          aria-label="Group post content"
          className="input-base flex-1 resize-none"
          required
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          loading={createMutation.isPending}
          disabled={!body.trim()}
        >
          Post to group
        </Button>
      </div>
    </form>
  );
}
