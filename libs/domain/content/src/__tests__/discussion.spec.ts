import { describe, it, expect } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import { Discussion } from '../aggregates/discussion';
import { DiscussionId } from '../value-objects/discussion-id';
import { PublicationId } from '../value-objects/publication-id';
import { DiscussionContent } from '../value-objects/discussion-content';
import { DiscussionStatus } from '../value-objects/discussion-status';
import { DiscussionCreatedEvent } from '../events/discussion-created.event';

function createDiscussion(
  overrides: { parentId?: DiscussionId | null } = {},
): Discussion {
  return Discussion.create(
    DiscussionId.generate(),
    PublicationId.generate(),
    UserId.generate(),
    DiscussionContent.create('This is a comment'),
    overrides.parentId,
  );
}

describe('Discussion', () => {
  describe('create', () => {
    it('should create a discussion with ACTIVE status', () => {
      const id = DiscussionId.generate();
      const pubId = PublicationId.generate();
      const authorId = UserId.generate();
      const content = DiscussionContent.create('Great post!');

      const discussion = Discussion.create(id, pubId, authorId, content);

      expect(discussion.id.equals(id)).toBe(true);
      expect(discussion.publicationId.equals(pubId)).toBe(true);
      expect(discussion.authorId.equals(authorId)).toBe(true);
      expect(discussion.content.text).toBe('Great post!');
      expect(discussion.status.isActive()).toBe(true);
      expect(discussion.parentId).toBeNull();
    });

    it('should emit DiscussionCreatedEvent', () => {
      const discussion = createDiscussion();
      const events = discussion.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(DiscussionCreatedEvent);
      const event = events[0] as DiscussionCreatedEvent;
      expect(event.aggregateId).toBe(discussion.id.value);
      expect(event.authorId).toBe(discussion.authorId.value);
      expect(event.publicationId).toBe(discussion.publicationId.value);
      expect(event.parentId).toBeNull();
      expect(event.aggregateType).toBe('Discussion');
    });

    it('should not be a reply when no parentId', () => {
      const discussion = createDiscussion();

      expect(discussion.isReply()).toBe(false);
    });
  });

  describe('reply', () => {
    it('should create a reply with parentId', () => {
      const parentId = DiscussionId.generate();
      const discussion = createDiscussion({ parentId });

      expect(discussion.parentId).not.toBeNull();
      expect(discussion.parentId!.equals(parentId)).toBe(true);
      expect(discussion.isReply()).toBe(true);
    });

    it('should include parentId in DiscussionCreatedEvent', () => {
      const parentId = DiscussionId.generate();
      const discussion = createDiscussion({ parentId });
      const events = discussion.pullDomainEvents();
      const event = events[0] as DiscussionCreatedEvent;

      expect(event.parentId).toBe(parentId.value);
    });
  });

  describe('hide', () => {
    it('should transition status to HIDDEN', () => {
      const discussion = createDiscussion();

      discussion.hide();

      expect(discussion.status.value).toBe('HIDDEN');
      expect(discussion.status.isActive()).toBe(false);
    });

    it('should increment version', () => {
      const discussion = createDiscussion();

      discussion.hide();

      expect(discussion.version).toBe(1);
    });
  });

  describe('delete', () => {
    it('should transition status to DELETED', () => {
      const discussion = createDiscussion();

      discussion.delete();

      expect(discussion.status.isDeleted()).toBe(true);
    });

    it('should increment version', () => {
      const discussion = createDiscussion();

      discussion.delete();

      expect(discussion.version).toBe(1);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute without emitting events', () => {
      const discussion = Discussion.reconstitute(
        DiscussionId.generate(),
        PublicationId.generate(),
        UserId.generate(),
        DiscussionContent.create('Reconstituted comment'),
        null,
        DiscussionStatus.ACTIVE,
        Timestamp.now(),
        3,
      );

      expect(discussion.pullDomainEvents()).toHaveLength(0);
      expect(discussion.version).toBe(3);
    });
  });
});
