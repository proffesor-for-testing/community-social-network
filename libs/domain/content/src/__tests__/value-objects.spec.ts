import { describe, it, expect } from 'vitest';
import { ValidationError } from '@csn/domain-shared';
import { PublicationId } from '../value-objects/publication-id';
import { PublicationContent } from '../value-objects/publication-content';
import { Visibility, VisibilityEnum } from '../value-objects/visibility';
import {
  PublicationStatus,
  PublicationStatusEnum,
} from '../value-objects/publication-status';
import { ReactionType, ReactionTypeEnum } from '../value-objects/reaction-type';
import { DiscussionId } from '../value-objects/discussion-id';
import { DiscussionContent } from '../value-objects/discussion-content';
import {
  DiscussionStatus,
  DiscussionStatusEnum,
} from '../value-objects/discussion-status';
import { Mention } from '../value-objects/mention';
import { EmptyContentError } from '../errors/empty-content.error';
import { ContentTooLongError } from '../errors/content-too-long.error';

describe('PublicationId', () => {
  it('should create from valid UUID', () => {
    const id = PublicationId.create('550e8400-e29b-41d4-a716-446655440000');
    expect(id.value).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should generate a new UUID', () => {
    const id = PublicationId.generate();
    expect(id.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('should throw on invalid UUID', () => {
    expect(() => PublicationId.create('not-a-uuid')).toThrow(ValidationError);
  });

  it('should support equality', () => {
    const id1 = PublicationId.create('550e8400-e29b-41d4-a716-446655440000');
    const id2 = PublicationId.create('550e8400-e29b-41d4-a716-446655440000');
    expect(id1.equals(id2)).toBe(true);
  });

  it('should convert to string', () => {
    const id = PublicationId.create('550e8400-e29b-41d4-a716-446655440000');
    expect(id.toString()).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});

describe('PublicationContent', () => {
  it('should create with valid text', () => {
    const content = PublicationContent.create('Hello, world!');
    expect(content.text).toBe('Hello, world!');
    expect(content.length).toBe(13);
  });

  it('should trim whitespace', () => {
    const content = PublicationContent.create('  Hello  ');
    expect(content.text).toBe('Hello');
  });

  it('should throw EmptyContentError on empty text', () => {
    expect(() => PublicationContent.create('')).toThrow(EmptyContentError);
  });

  it('should throw EmptyContentError on whitespace-only text', () => {
    expect(() => PublicationContent.create('   ')).toThrow(EmptyContentError);
  });

  it('should throw ContentTooLongError when exceeding limit', () => {
    const longText = 'a'.repeat(5001);
    expect(() => PublicationContent.create(longText)).toThrow(
      ContentTooLongError,
    );
  });

  it('should allow exactly 5000 characters', () => {
    const text = 'a'.repeat(5000);
    const content = PublicationContent.create(text);
    expect(content.length).toBe(5000);
  });
});

describe('Visibility', () => {
  it('should create from valid string', () => {
    const v = Visibility.create('PUBLIC');
    expect(v.value).toBe(VisibilityEnum.PUBLIC);
  });

  it('should throw on invalid visibility', () => {
    expect(() => Visibility.create('INVALID')).toThrow(ValidationError);
  });

  it('should provide static getters', () => {
    expect(Visibility.PUBLIC.value).toBe(VisibilityEnum.PUBLIC);
    expect(Visibility.CONNECTIONS_ONLY.value).toBe(
      VisibilityEnum.CONNECTIONS_ONLY,
    );
    expect(Visibility.GROUP_ONLY.value).toBe(VisibilityEnum.GROUP_ONLY);
    expect(Visibility.PRIVATE.value).toBe(VisibilityEnum.PRIVATE);
  });

  it('should support isPublic', () => {
    expect(Visibility.PUBLIC.isPublic()).toBe(true);
    expect(Visibility.PRIVATE.isPublic()).toBe(false);
  });
});

describe('PublicationStatus', () => {
  it('should create from valid string', () => {
    const s = PublicationStatus.create('PUBLISHED');
    expect(s.value).toBe(PublicationStatusEnum.PUBLISHED);
  });

  it('should throw on invalid status', () => {
    expect(() => PublicationStatus.create('INVALID')).toThrow(ValidationError);
  });

  it('should allow valid transitions', () => {
    expect(
      PublicationStatus.PUBLISHED.canTransitionTo(PublicationStatus.ARCHIVED),
    ).toBe(true);
    expect(
      PublicationStatus.PUBLISHED.canTransitionTo(PublicationStatus.DELETED),
    ).toBe(true);
    expect(
      PublicationStatus.ARCHIVED.canTransitionTo(PublicationStatus.PUBLISHED),
    ).toBe(true);
    expect(
      PublicationStatus.DRAFT.canTransitionTo(PublicationStatus.PUBLISHED),
    ).toBe(true);
  });

  it('should reject invalid transitions', () => {
    expect(
      PublicationStatus.DELETED.canTransitionTo(PublicationStatus.PUBLISHED),
    ).toBe(false);
  });

  it('should throw on invalid transition via transitionTo', () => {
    expect(() =>
      PublicationStatus.DELETED.transitionTo(PublicationStatus.PUBLISHED),
    ).toThrow(ValidationError);
  });

  it('should return target status on valid transitionTo', () => {
    const result = PublicationStatus.PUBLISHED.transitionTo(
      PublicationStatus.ARCHIVED,
    );
    expect(result.value).toBe(PublicationStatusEnum.ARCHIVED);
  });
});

describe('ReactionType', () => {
  it('should create from valid string', () => {
    const r = ReactionType.create('LIKE');
    expect(r.value).toBe(ReactionTypeEnum.LIKE);
  });

  it('should throw on invalid type', () => {
    expect(() => ReactionType.create('DISLIKE')).toThrow(ValidationError);
  });

  it('should provide all static getters', () => {
    expect(ReactionType.LIKE.value).toBe(ReactionTypeEnum.LIKE);
    expect(ReactionType.LOVE.value).toBe(ReactionTypeEnum.LOVE);
    expect(ReactionType.HAHA.value).toBe(ReactionTypeEnum.HAHA);
    expect(ReactionType.WOW.value).toBe(ReactionTypeEnum.WOW);
    expect(ReactionType.SAD.value).toBe(ReactionTypeEnum.SAD);
    expect(ReactionType.ANGRY.value).toBe(ReactionTypeEnum.ANGRY);
  });
});

describe('DiscussionId', () => {
  it('should create from valid UUID', () => {
    const id = DiscussionId.create('550e8400-e29b-41d4-a716-446655440000');
    expect(id.value).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should generate a new UUID', () => {
    const id = DiscussionId.generate();
    expect(id.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('should throw on invalid UUID', () => {
    expect(() => DiscussionId.create('bad')).toThrow(ValidationError);
  });
});

describe('DiscussionContent', () => {
  it('should create with valid text', () => {
    const content = DiscussionContent.create('Nice comment');
    expect(content.text).toBe('Nice comment');
  });

  it('should throw EmptyContentError on empty text', () => {
    expect(() => DiscussionContent.create('')).toThrow(EmptyContentError);
  });

  it('should throw ContentTooLongError when exceeding 2000 chars', () => {
    const longText = 'a'.repeat(2001);
    expect(() => DiscussionContent.create(longText)).toThrow(
      ContentTooLongError,
    );
  });

  it('should allow exactly 2000 characters', () => {
    const text = 'a'.repeat(2000);
    const content = DiscussionContent.create(text);
    expect(content.length).toBe(2000);
  });
});

describe('DiscussionStatus', () => {
  it('should create from valid string', () => {
    const s = DiscussionStatus.create('ACTIVE');
    expect(s.value).toBe(DiscussionStatusEnum.ACTIVE);
  });

  it('should throw on invalid status', () => {
    expect(() => DiscussionStatus.create('INVALID')).toThrow(ValidationError);
  });

  it('should provide static getters', () => {
    expect(DiscussionStatus.ACTIVE.isActive()).toBe(true);
    expect(DiscussionStatus.DELETED.isDeleted()).toBe(true);
    expect(DiscussionStatus.HIDDEN.isActive()).toBe(false);
  });
});

describe('Mention', () => {
  it('should create with valid userId and position', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const mention = Mention.create(userId, 0);
    expect(mention.userId).toBe(userId);
    expect(mention.position).toBe(0);
  });

  it('should throw on invalid userId', () => {
    expect(() => Mention.create('bad-id', 0)).toThrow(ValidationError);
  });

  it('should throw on negative position', () => {
    expect(() =>
      Mention.create('550e8400-e29b-41d4-a716-446655440000', -1),
    ).toThrow(ValidationError);
  });

  it('should throw on non-integer position', () => {
    expect(() =>
      Mention.create('550e8400-e29b-41d4-a716-446655440000', 1.5),
    ).toThrow(ValidationError);
  });

  it('should validate mention count', () => {
    expect(() => Mention.validateCount(10)).not.toThrow();
    expect(() => Mention.validateCount(11)).toThrow(ValidationError);
  });

  it('should support equality', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const m1 = Mention.create(userId, 5);
    const m2 = Mention.create(userId, 5);
    expect(m1.equals(m2)).toBe(true);
  });
});
