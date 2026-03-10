import { describe, it, expect } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import { Publication } from '../aggregates/publication';
import { PublicationId } from '../value-objects/publication-id';
import { PublicationContent } from '../value-objects/publication-content';
import { Visibility } from '../value-objects/visibility';
import { PublicationStatus } from '../value-objects/publication-status';
import { ReactionType } from '../value-objects/reaction-type';
import { Mention } from '../value-objects/mention';
import { PublicationCreatedEvent } from '../events/publication-created.event';
import { PublicationEditedEvent } from '../events/publication-edited.event';
import { PublicationDeletedEvent } from '../events/publication-deleted.event';
import { MemberMentionedEvent } from '../events/member-mentioned.event';
import { ReactionAddedEvent } from '../events/reaction-added.event';
import { CannotEditError } from '../errors/cannot-edit.error';
import { MaxMentionsExceededError } from '../errors/max-mentions-exceeded.error';

function createPublication(
  overrides: { visibility?: Visibility } = {},
): Publication {
  return Publication.create(
    PublicationId.generate(),
    UserId.generate(),
    PublicationContent.create('Hello, world!'),
    overrides.visibility ?? Visibility.PUBLIC,
  );
}

describe('Publication', () => {
  describe('create', () => {
    it('should create a publication with PUBLISHED status', () => {
      const id = PublicationId.generate();
      const authorId = UserId.generate();
      const content = PublicationContent.create('Test post content');
      const visibility = Visibility.PUBLIC;

      const pub = Publication.create(id, authorId, content, visibility);

      expect(pub.id.equals(id)).toBe(true);
      expect(pub.authorId.equals(authorId)).toBe(true);
      expect(pub.content.text).toBe('Test post content');
      expect(pub.visibility.isPublic()).toBe(true);
      expect(pub.status.isPublished()).toBe(true);
      expect(pub.mentions).toHaveLength(0);
      expect(pub.mediaIds).toHaveLength(0);
    });

    it('should emit PublicationCreatedEvent', () => {
      const pub = createPublication();
      const events = pub.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(PublicationCreatedEvent);
      const event = events[0] as PublicationCreatedEvent;
      expect(event.aggregateId).toBe(pub.id.value);
      expect(event.authorId).toBe(pub.authorId.value);
      expect(event.visibility).toBe('PUBLIC');
      expect(event.aggregateType).toBe('Publication');
    });

    it('should set createdAt and updatedAt timestamps', () => {
      const pub = createPublication();

      expect(pub.createdAt).toBeInstanceOf(Timestamp);
      expect(pub.updatedAt).toBeInstanceOf(Timestamp);
    });
  });

  describe('edit', () => {
    it('should update content when published', () => {
      const pub = createPublication();
      pub.pullDomainEvents(); // clear creation event
      const newContent = PublicationContent.create('Updated content');

      pub.edit(newContent);

      expect(pub.content.text).toBe('Updated content');
      expect(pub.version).toBe(1);
    });

    it('should emit PublicationEditedEvent', () => {
      const pub = createPublication();
      pub.pullDomainEvents();

      pub.edit(PublicationContent.create('New content'));
      const events = pub.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(PublicationEditedEvent);
      const event = events[0] as PublicationEditedEvent;
      expect(event.editedFields).toEqual(['content']);
    });

    it('should throw CannotEditError when archived', () => {
      const pub = createPublication();
      pub.archive();

      expect(() =>
        pub.edit(PublicationContent.create('New content')),
      ).toThrow(CannotEditError);
    });

    it('should throw CannotEditError when deleted', () => {
      const pub = createPublication();
      pub.delete();

      expect(() =>
        pub.edit(PublicationContent.create('New content')),
      ).toThrow(CannotEditError);
    });
  });

  describe('delete', () => {
    it('should transition status to DELETED', () => {
      const pub = createPublication();

      pub.delete();

      expect(pub.status.isDeleted()).toBe(true);
    });

    it('should emit PublicationDeletedEvent', () => {
      const pub = createPublication();
      pub.pullDomainEvents();

      pub.delete();
      const events = pub.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(PublicationDeletedEvent);
    });

    it('should increment version', () => {
      const pub = createPublication();

      pub.delete();

      expect(pub.version).toBe(1);
    });
  });

  describe('archive', () => {
    it('should transition status to ARCHIVED', () => {
      const pub = createPublication();

      pub.archive();

      expect(pub.status.value).toBe('ARCHIVED');
    });

    it('should increment version', () => {
      const pub = createPublication();

      pub.archive();

      expect(pub.version).toBe(1);
    });

    it('should allow re-publish from archived by reconstituting', () => {
      // Archived publications can transition back to PUBLISHED
      const status = PublicationStatus.ARCHIVED;
      expect(status.canTransitionTo(PublicationStatus.PUBLISHED)).toBe(true);
    });
  });

  describe('addMentions', () => {
    it('should add mentions to the publication', () => {
      const pub = createPublication();
      const mention1 = Mention.create(UserId.generate().value, 0);
      const mention2 = Mention.create(UserId.generate().value, 5);

      pub.addMentions([mention1, mention2]);

      expect(pub.mentions).toHaveLength(2);
    });

    it('should emit MemberMentionedEvent for each mention', () => {
      const pub = createPublication();
      pub.pullDomainEvents();
      const userId1 = UserId.generate().value;
      const userId2 = UserId.generate().value;

      pub.addMentions([
        Mention.create(userId1, 0),
        Mention.create(userId2, 5),
      ]);
      const events = pub.pullDomainEvents();

      expect(events).toHaveLength(2);
      expect(events[0]).toBeInstanceOf(MemberMentionedEvent);
      expect(events[1]).toBeInstanceOf(MemberMentionedEvent);
      expect((events[0] as MemberMentionedEvent).mentionedUserId).toBe(
        userId1,
      );
      expect((events[1] as MemberMentionedEvent).mentionedUserId).toBe(
        userId2,
      );
    });

    it('should throw MaxMentionsExceededError when exceeding limit', () => {
      const pub = createPublication();
      const mentions = Array.from({ length: 11 }, (_, i) =>
        Mention.create(UserId.generate().value, i),
      );

      expect(() => pub.addMentions(mentions)).toThrow(
        MaxMentionsExceededError,
      );
    });

    it('should throw when adding mentions that exceed cumulative limit', () => {
      const pub = createPublication();
      const first = Array.from({ length: 8 }, (_, i) =>
        Mention.create(UserId.generate().value, i),
      );
      pub.addMentions(first);

      const second = Array.from({ length: 3 }, (_, i) =>
        Mention.create(UserId.generate().value, i + 8),
      );

      expect(() => pub.addMentions(second)).toThrow(MaxMentionsExceededError);
    });

    it('should allow exactly 10 mentions', () => {
      const pub = createPublication();
      const mentions = Array.from({ length: 10 }, (_, i) =>
        Mention.create(UserId.generate().value, i),
      );

      pub.addMentions(mentions);

      expect(pub.mentions).toHaveLength(10);
    });
  });

  describe('reactions', () => {
    it('should add a reaction and update counts', () => {
      const pub = createPublication();
      const userId = UserId.generate().value;

      pub.addReaction(userId, ReactionType.LIKE);

      expect(pub.reactionCounts.get('LIKE')).toBe(1);
    });

    it('should emit ReactionAddedEvent', () => {
      const pub = createPublication();
      pub.pullDomainEvents();
      const userId = UserId.generate().value;

      pub.addReaction(userId, ReactionType.LOVE);
      const events = pub.pullDomainEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(ReactionAddedEvent);
      const event = events[0] as ReactionAddedEvent;
      expect(event.userId).toBe(userId);
      expect(event.reactionType).toBe('LOVE');
    });

    it('should accumulate reaction counts', () => {
      const pub = createPublication();

      pub.addReaction('user-1', ReactionType.LIKE);
      pub.addReaction('user-2', ReactionType.LIKE);
      pub.addReaction('user-3', ReactionType.HAHA);

      expect(pub.reactionCounts.get('LIKE')).toBe(2);
      expect(pub.reactionCounts.get('HAHA')).toBe(1);
    });

    it('should remove a reaction and decrement count', () => {
      const pub = createPublication();
      pub.addReaction('user-1', ReactionType.LIKE);
      pub.addReaction('user-2', ReactionType.LIKE);

      pub.removeReaction('user-1', ReactionType.LIKE);

      expect(pub.reactionCounts.get('LIKE')).toBe(1);
    });

    it('should not go below zero when removing', () => {
      const pub = createPublication();

      pub.removeReaction('user-1', ReactionType.LIKE);

      expect(pub.reactionCounts.get('LIKE')).toBeUndefined();
    });
  });

  describe('isVisibleTo', () => {
    it('should always be visible to the author', () => {
      const authorId = UserId.generate();
      const pub = Publication.create(
        PublicationId.generate(),
        authorId,
        PublicationContent.create('Test'),
        Visibility.PRIVATE,
      );

      expect(pub.isVisibleTo(authorId, false, false)).toBe(true);
    });

    it('should be visible to everyone when PUBLIC', () => {
      const pub = createPublication({ visibility: Visibility.PUBLIC });
      const stranger = UserId.generate();

      expect(pub.isVisibleTo(stranger, false, false)).toBe(true);
    });

    it('should only be visible to connections when CONNECTIONS_ONLY', () => {
      const pub = createPublication({
        visibility: Visibility.CONNECTIONS_ONLY,
      });
      const other = UserId.generate();

      expect(pub.isVisibleTo(other, true, false)).toBe(true);
      expect(pub.isVisibleTo(other, false, false)).toBe(false);
    });

    it('should only be visible to group members when GROUP_ONLY', () => {
      const pub = createPublication({ visibility: Visibility.GROUP_ONLY });
      const other = UserId.generate();

      expect(pub.isVisibleTo(other, false, true)).toBe(true);
      expect(pub.isVisibleTo(other, false, false)).toBe(false);
    });

    it('should not be visible when PRIVATE (except author)', () => {
      const pub = createPublication({ visibility: Visibility.PRIVATE });
      const other = UserId.generate();

      expect(pub.isVisibleTo(other, true, true)).toBe(false);
    });

    it('should not be visible when DELETED (except author)', () => {
      const pub = createPublication({ visibility: Visibility.PUBLIC });
      pub.delete();
      const other = UserId.generate();

      expect(pub.isVisibleTo(other, false, false)).toBe(false);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute without emitting events', () => {
      const pub = Publication.reconstitute(
        PublicationId.generate(),
        UserId.generate(),
        PublicationContent.create('Existing content'),
        Visibility.PUBLIC,
        PublicationStatus.PUBLISHED,
        [],
        [],
        new Map<string, number>(),
        Timestamp.now(),
        Timestamp.now(),
        5,
      );

      expect(pub.pullDomainEvents()).toHaveLength(0);
      expect(pub.version).toBe(5);
      expect(pub.status.isPublished()).toBe(true);
    });
  });
});
