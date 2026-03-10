import { describe, it, expect } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Publication,
  PublicationId,
  PublicationContent,
  Visibility,
  PublicationStatus,
  Mention,
} from '@csn/domain-content';
import { PublicationMapper } from '../mappers/publication.mapper';
import { PublicationEntity } from '../entities/publication.entity';
import { MentionEntity } from '../entities/mention.entity';
import { ReactionEntity } from '../entities/reaction.entity';

describe('PublicationMapper', () => {
  const mapper = new PublicationMapper();

  function buildPublicationEntity(overrides: Partial<PublicationEntity> = {}): PublicationEntity {
    const entity = new PublicationEntity();
    entity.id = overrides.id ?? 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    entity.authorId = overrides.authorId ?? 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
    entity.content = overrides.content ?? 'Hello world';
    entity.status = overrides.status ?? 'PUBLISHED';
    entity.visibility = overrides.visibility ?? 'PUBLIC';
    entity.createdAt = overrides.createdAt ?? new Date('2024-01-15T10:00:00Z');
    entity.updatedAt = overrides.updatedAt ?? new Date('2024-01-15T12:00:00Z');
    entity.version = overrides.version ?? 3;
    return entity;
  }

  function buildMentionEntity(
    publicationId: string,
    userId: string,
    position: number,
  ): MentionEntity {
    const entity = new MentionEntity();
    entity.id = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
    entity.publicationId = publicationId;
    entity.userId = userId;
    entity.position = position;
    return entity;
  }

  function buildReactionEntity(
    publicationId: string,
    userId: string,
    type: string,
  ): ReactionEntity {
    const entity = new ReactionEntity();
    entity.id = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';
    entity.publicationId = publicationId;
    entity.userId = userId;
    entity.type = type;
    return entity;
  }

  describe('toDomain', () => {
    it('should map a publication entity to a domain aggregate', () => {
      const pubEntity = buildPublicationEntity();

      const domain = mapper.toDomain({
        publication: pubEntity,
        mentions: [],
        reactions: [],
      });

      expect(domain).toBeInstanceOf(Publication);
      expect(domain.id.value).toBe(pubEntity.id);
      expect(domain.authorId.value).toBe(pubEntity.authorId);
      expect(domain.content.text).toBe('Hello world');
      expect(domain.status.value).toBe('PUBLISHED');
      expect(domain.visibility.value).toBe('PUBLIC');
      expect(domain.version).toBe(3);
    });

    it('should map mentions correctly', () => {
      const pubId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const userId1 = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55';
      const userId2 = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66';
      const pubEntity = buildPublicationEntity({ id: pubId });
      const mention1 = buildMentionEntity(pubId, userId1, 0);
      const mention2 = buildMentionEntity(pubId, userId2, 10);

      const domain = mapper.toDomain({
        publication: pubEntity,
        mentions: [mention1, mention2],
        reactions: [],
      });

      expect(domain.mentions).toHaveLength(2);
      expect(domain.mentions[0].userId).toBe(userId1);
      expect(domain.mentions[0].position).toBe(0);
      expect(domain.mentions[1].userId).toBe(userId2);
      expect(domain.mentions[1].position).toBe(10);
    });

    it('should aggregate reactions into counts', () => {
      const pubId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const pubEntity = buildPublicationEntity({ id: pubId });
      const reaction1 = buildReactionEntity(pubId, 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', 'LIKE');
      const reaction2 = buildReactionEntity(pubId, 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66', 'LIKE');
      const reaction3 = buildReactionEntity(pubId, 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a77', 'LOVE');

      const domain = mapper.toDomain({
        publication: pubEntity,
        mentions: [],
        reactions: [reaction1, reaction2, reaction3],
      });

      expect(domain.reactionCounts.get('LIKE')).toBe(2);
      expect(domain.reactionCounts.get('LOVE')).toBe(1);
    });
  });

  describe('toPersistence', () => {
    it('should map a domain aggregate to persistence entities', () => {
      const pubId = PublicationId.create('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      const authorId = UserId.create('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
      const now = Timestamp.now();
      const domain = Publication.reconstitute(
        pubId,
        authorId,
        PublicationContent.create('Test content'),
        Visibility.PUBLIC,
        PublicationStatus.PUBLISHED,
        [],
        [],
        new Map<string, number>(),
        now,
        now,
        2,
      );

      const bundle = mapper.toPersistence(domain);

      expect(bundle.publication.id).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(bundle.publication.authorId).toBe('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
      expect(bundle.publication.content).toBe('Test content');
      expect(bundle.publication.status).toBe('PUBLISHED');
      expect(bundle.publication.visibility).toBe('PUBLIC');
      expect(bundle.publication.version).toBe(2);
    });

    it('should map mentions to persistence entities', () => {
      const pubId = PublicationId.create('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      const authorId = UserId.create('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
      const userId1 = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55';
      const userId2 = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66';
      const now = Timestamp.now();

      const domain = Publication.reconstitute(
        pubId,
        authorId,
        PublicationContent.create('Test with mentions'),
        Visibility.PUBLIC,
        PublicationStatus.PUBLISHED,
        [Mention.create(userId1, 5), Mention.create(userId2, 20)],
        [],
        new Map<string, number>(),
        now,
        now,
        1,
      );

      const bundle = mapper.toPersistence(domain);

      expect(bundle.mentions).toHaveLength(2);
      expect(bundle.mentions[0].publicationId).toBe(pubId.value);
      expect(bundle.mentions[0].userId).toBe(userId1);
      expect(bundle.mentions[0].position).toBe(5);
      expect(bundle.mentions[1].userId).toBe(userId2);
      expect(bundle.mentions[1].position).toBe(20);
    });
  });

  describe('round-trip', () => {
    it('should preserve data through toPersistence then toDomain with mentions and reactions', () => {
      const pubId = PublicationId.create('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      const authorId = UserId.create('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22');
      const userId1 = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55';
      const userId2 = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66';
      const created = Timestamp.fromDate(new Date('2024-03-01T09:00:00Z'));
      const updated = Timestamp.fromDate(new Date('2024-03-01T10:30:00Z'));

      const original = Publication.reconstitute(
        pubId,
        authorId,
        PublicationContent.create('Round-trip test content'),
        Visibility.CONNECTIONS_ONLY,
        PublicationStatus.PUBLISHED,
        [Mention.create(userId1, 0), Mention.create(userId2, 15)],
        [],
        new Map<string, number>([['LIKE', 3], ['LOVE', 1]]),
        created,
        updated,
        5,
      );

      const bundle = mapper.toPersistence(original);

      // Simulate reactions being loaded from persistence (not produced by toPersistence)
      const simulatedReactions: ReactionEntity[] = [
        buildReactionEntity(pubId.value, 'r1eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'LIKE'),
        buildReactionEntity(pubId.value, 'r2eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'LIKE'),
        buildReactionEntity(pubId.value, 'r3eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'LIKE'),
        buildReactionEntity(pubId.value, 'r4eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'LOVE'),
      ];

      const reconstructed = mapper.toDomain({
        publication: bundle.publication,
        mentions: bundle.mentions,
        reactions: simulatedReactions,
      });

      expect(reconstructed.id.value).toBe(original.id.value);
      expect(reconstructed.authorId.value).toBe(original.authorId.value);
      expect(reconstructed.content.text).toBe('Round-trip test content');
      expect(reconstructed.visibility.value).toBe('CONNECTIONS_ONLY');
      expect(reconstructed.status.value).toBe('PUBLISHED');
      expect(reconstructed.version).toBe(5);
      expect(reconstructed.mentions).toHaveLength(2);
      expect(reconstructed.mentions[0].userId).toBe(userId1);
      expect(reconstructed.mentions[1].userId).toBe(userId2);
      expect(reconstructed.reactionCounts.get('LIKE')).toBe(3);
      expect(reconstructed.reactionCounts.get('LOVE')).toBe(1);
    });
  });
});
