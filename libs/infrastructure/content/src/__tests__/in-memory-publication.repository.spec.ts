import { describe, it, expect, beforeEach } from 'vitest';
import { UserId, Timestamp } from '@csn/domain-shared';
import {
  Publication,
  PublicationId,
  PublicationContent,
  Visibility,
  PublicationStatus,
  Mention,
} from '@csn/domain-content';
import { InMemoryPublicationRepository } from '../repositories/in-memory-publication.repository';

describe('InMemoryPublicationRepository', () => {
  let repository: InMemoryPublicationRepository;

  beforeEach(() => {
    repository = new InMemoryPublicationRepository();
  });

  function createPublication(
    overrides: {
      id?: PublicationId;
      authorId?: UserId;
      content?: string;
      visibility?: Visibility;
    } = {},
  ): Publication {
    return Publication.create(
      overrides.id ?? PublicationId.generate(),
      overrides.authorId ?? UserId.generate(),
      PublicationContent.create(overrides.content ?? 'Test publication content'),
      overrides.visibility ?? Visibility.PUBLIC,
    );
  }

  describe('nextId', () => {
    it('should generate a unique PublicationId', () => {
      const id1 = repository.nextId();
      const id2 = repository.nextId();

      expect(id1).toBeInstanceOf(PublicationId);
      expect(id2).toBeInstanceOf(PublicationId);
      expect(id1.value).not.toBe(id2.value);
    });
  });

  describe('save and findById', () => {
    it('should save and retrieve a publication', async () => {
      const pub = createPublication();

      await repository.save(pub);
      const found = await repository.findById(pub.id);

      expect(found).not.toBeNull();
      expect(found!.id.value).toBe(pub.id.value);
      expect(found!.content.text).toBe('Test publication content');
      expect(found!.status.isPublished()).toBe(true);
    });

    it('should return null for non-existent id', async () => {
      const found = await repository.findById(PublicationId.generate());

      expect(found).toBeNull();
    });

    it('should save publication with mentions', async () => {
      const pub = createPublication();
      const userId1 = UserId.generate().value;
      const userId2 = UserId.generate().value;
      pub.addMentions([
        Mention.create(userId1, 0),
        Mention.create(userId2, 10),
      ]);

      await repository.save(pub);
      const found = await repository.findById(pub.id);

      expect(found).not.toBeNull();
      expect(found!.mentions).toHaveLength(2);
      expect(found!.mentions[0].userId).toBe(userId1);
      expect(found!.mentions[1].userId).toBe(userId2);
    });

    it('should overwrite on subsequent saves', async () => {
      const pub = createPublication();
      await repository.save(pub);

      pub.edit(PublicationContent.create('Updated content'));
      await repository.save(pub);
      const found = await repository.findById(pub.id);

      expect(found!.content.text).toBe('Updated content');
    });
  });

  describe('exists', () => {
    it('should return true for saved publication', async () => {
      const pub = createPublication();
      await repository.save(pub);

      const result = await repository.exists(pub.id);

      expect(result).toBe(true);
    });

    it('should return false for non-existent publication', async () => {
      const result = await repository.exists(PublicationId.generate());

      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove a publication from storage', async () => {
      const pub = createPublication();
      await repository.save(pub);

      await repository.delete(pub);

      expect(await repository.findById(pub.id)).toBeNull();
      expect(await repository.exists(pub.id)).toBe(false);
    });
  });

  describe('findByAuthorId', () => {
    it('should find all publications by a given author', async () => {
      const authorId = UserId.generate();
      const pub1 = createPublication({ authorId, content: 'First post' });
      const pub2 = createPublication({ authorId, content: 'Second post' });
      const otherPub = createPublication({ content: 'Other author post' });

      await repository.save(pub1);
      await repository.save(pub2);
      await repository.save(otherPub);

      const results = await repository.findByAuthorId(authorId);

      expect(results).toHaveLength(2);
      const ids = results.map((p) => p.id.value);
      expect(ids).toContain(pub1.id.value);
      expect(ids).toContain(pub2.id.value);
    });

    it('should return empty array when author has no publications', async () => {
      const results = await repository.findByAuthorId(UserId.generate());

      expect(results).toEqual([]);
    });
  });

  describe('test helpers', () => {
    it('should report correct size', async () => {
      const pub1 = createPublication();
      const pub2 = createPublication();
      await repository.save(pub1);
      await repository.save(pub2);

      expect(repository.size).toBe(2);
    });

    it('should clear all data', async () => {
      await repository.save(createPublication());
      await repository.save(createPublication());

      repository.clear();

      expect(repository.size).toBe(0);
    });
  });
});
