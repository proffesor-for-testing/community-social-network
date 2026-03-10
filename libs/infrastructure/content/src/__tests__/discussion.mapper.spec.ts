import { describe, it, expect } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Discussion,
  DiscussionId,
  PublicationId,
  DiscussionContent,
  DiscussionStatus,
} from '@csn/domain-content';
import { DiscussionMapper } from '../mappers/discussion.mapper';
import { DiscussionEntity } from '../entities/discussion.entity';

describe('DiscussionMapper', () => {
  const mapper = new DiscussionMapper();

  function buildDiscussionEntity(overrides: Partial<DiscussionEntity> = {}): DiscussionEntity {
    const entity = new DiscussionEntity();
    entity.id = overrides.id ?? 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    entity.publicationId = overrides.publicationId ?? 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
    entity.authorId = overrides.authorId ?? 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
    entity.parentId = overrides.parentId !== undefined ? overrides.parentId : null;
    entity.content = overrides.content ?? 'This is a comment';
    entity.status = overrides.status ?? 'ACTIVE';
    entity.createdAt = overrides.createdAt ?? new Date('2024-01-20T14:00:00Z');
    entity.version = overrides.version ?? 1;
    return entity;
  }

  describe('toDomain', () => {
    it('should map a discussion entity to a domain aggregate', () => {
      const entity = buildDiscussionEntity();

      const domain = mapper.toDomain(entity);

      expect(domain).toBeInstanceOf(Discussion);
      expect(domain.id.value).toBe(entity.id);
      expect(domain.publicationId.value).toBe(entity.publicationId);
      expect(domain.authorId.value).toBe(entity.authorId);
      expect(domain.content.text).toBe('This is a comment');
      expect(domain.status.value).toBe('ACTIVE');
      expect(domain.parentId).toBeNull();
      expect(domain.version).toBe(1);
    });

    it('should map a discussion with a parent reference', () => {
      const parentId = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';
      const entity = buildDiscussionEntity({ parentId });

      const domain = mapper.toDomain(entity);

      expect(domain.parentId).not.toBeNull();
      expect(domain.parentId!.value).toBe(parentId);
      expect(domain.isReply()).toBe(true);
    });

    it('should handle null parentId correctly', () => {
      const entity = buildDiscussionEntity({ parentId: null });

      const domain = mapper.toDomain(entity);

      expect(domain.parentId).toBeNull();
      expect(domain.isReply()).toBe(false);
    });
  });

  describe('toPersistence', () => {
    it('should map a domain aggregate to a discussion entity', () => {
      const id = DiscussionId.create('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      const pubId = PublicationId.create('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
      const authorId = UserId.create('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33');
      const now = Timestamp.now();

      const domain = Discussion.reconstitute(
        id,
        pubId,
        authorId,
        DiscussionContent.create('Persisted comment'),
        null,
        DiscussionStatus.ACTIVE,
        now,
        2,
      );

      const entity = mapper.toPersistence(domain);

      expect(entity.id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(entity.publicationId).toBe('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
      expect(entity.authorId).toBe('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33');
      expect(entity.content).toBe('Persisted comment');
      expect(entity.status).toBe('ACTIVE');
      expect(entity.parentId).toBeNull();
      expect(entity.version).toBe(2);
    });

    it('should map parentId when present', () => {
      const parentId = DiscussionId.create('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44');
      const domain = Discussion.reconstitute(
        DiscussionId.create('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
        PublicationId.create('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'),
        UserId.create('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33'),
        DiscussionContent.create('Reply comment'),
        parentId,
        DiscussionStatus.ACTIVE,
        Timestamp.now(),
        1,
      );

      const entity = mapper.toPersistence(domain);

      expect(entity.parentId).toBe('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44');
    });
  });

  describe('round-trip', () => {
    it('should preserve data through toPersistence then toDomain', () => {
      const id = DiscussionId.create('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      const pubId = PublicationId.create('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
      const authorId = UserId.create('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33');
      const created = Timestamp.fromDate(new Date('2024-02-10T08:00:00Z'));

      const original = Discussion.reconstitute(
        id,
        pubId,
        authorId,
        DiscussionContent.create('Round-trip test'),
        null,
        DiscussionStatus.ACTIVE,
        created,
        4,
      );

      const entity = mapper.toPersistence(original);
      const reconstructed = mapper.toDomain(entity);

      expect(reconstructed.id.value).toBe(original.id.value);
      expect(reconstructed.publicationId.value).toBe(original.publicationId.value);
      expect(reconstructed.authorId.value).toBe(original.authorId.value);
      expect(reconstructed.content.text).toBe('Round-trip test');
      expect(reconstructed.status.value).toBe('ACTIVE');
      expect(reconstructed.parentId).toBeNull();
      expect(reconstructed.version).toBe(4);
    });

    it('should preserve data through round-trip including parent reference', () => {
      const parentId = DiscussionId.create('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44');

      const original = Discussion.reconstitute(
        DiscussionId.create('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
        PublicationId.create('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'),
        UserId.create('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33'),
        DiscussionContent.create('Threaded reply'),
        parentId,
        DiscussionStatus.HIDDEN,
        Timestamp.fromDate(new Date('2024-02-10T09:30:00Z')),
        7,
      );

      const entity = mapper.toPersistence(original);
      const reconstructed = mapper.toDomain(entity);

      expect(reconstructed.parentId).not.toBeNull();
      expect(reconstructed.parentId!.value).toBe(parentId.value);
      expect(reconstructed.isReply()).toBe(true);
      expect(reconstructed.status.value).toBe('HIDDEN');
      expect(reconstructed.version).toBe(7);
    });
  });
});
