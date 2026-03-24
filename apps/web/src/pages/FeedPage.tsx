import React from 'react';
import { CreatePostForm } from '../features/feed/components/CreatePostForm';
import { FeedList } from '../features/feed/components/FeedList';

export default function FeedPage() {
  return (
    <div className="space-y-6">
      <CreatePostForm />
      <FeedList />
    </div>
  );
}
