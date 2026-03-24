import React, { useState, type FormEvent } from 'react';
import { Button } from '../../../shared/components/atoms/Button';
import { Avatar } from '../../../shared/components/atoms/Avatar';
import { useCreatePost } from '../hooks/useCreatePost';
import { useAuthStore } from '../../../stores/auth.store';

export function CreatePostForm() {
  const user = useAuthStore((s) => s.user);
  const createMutation = useCreatePost();

  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    createMutation.mutate(
      { body: body.trim(), type: 'post', tags: tagList.length > 0 ? tagList : undefined },
      {
        onSuccess: () => {
          setBody('');
          setTags('');
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <div className="flex gap-3">
        <Avatar
          alt={user?.displayName ?? 'User'}
          size="md"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What's on your mind?"
          rows={3}
          maxLength={5000}
          className="input-base flex-1 resize-none"
          required
        />
      </div>

      <div className="flex items-center justify-between">
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags (comma-separated)"
          className="input-base max-w-xs text-sm"
        />
        <Button type="submit" loading={createMutation.isPending} disabled={!body.trim()}>
          Post
        </Button>
      </div>
    </form>
  );
}
