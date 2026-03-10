import { describe, it, expect, beforeEach } from 'vitest';
import { UserId } from '@csn/domain-shared';
import {
  Discussion,
  DiscussionId,
  PublicationId,
  DiscussionContent,
} from '@csn/domain-content';
import { InMemoryDiscussionRepository } from '../repositories/in-memory-discussion.repository';

describe('InMemoryDiscussionRepository', () => {
  let repository: InMemoryDiscussionRepository;

  beforeEach(() => {
    repository = new InMemoryDiscussionRepository();
  });

  function createDiscussion(
    overrides: {
      id?: DiscussionId;
      publicationId?: PublicationId;
      authorId?: UserId;
      content?: string;
      parentId?: DiscussionId | null;
    } = {},
  ): Discussion {
    return Discussion.create(
      overrides.id ?? DiscussionId.generate(),
      overrides.publicationId ?? PublicationId.generate(),
      overrides.authorId ?? UserId.generate(),
      DiscussionContent.create(overrides.content ?? 'Test comment'),
      overrides.parentId,
    );
  }

  describe('nextId', () => {
    it('should generate a unique DiscussionId', () => {
      const id1 = repository.nextId();
      const id2 = repository.nextId();

      expect(id1).toBeInstanceOf(DiscussionId);
      expect(id2).toBeInstanceOf(DiscussionId);
      expect(id1.value).not.toBe(id2.value);
    });
  });

  describe('save and findById', () => {
    it('should save and retrieve a discussion', async () => {
      const discussion = createDiscussion();

      await repository.save(discussion);
      const found = await repository.findById(discussion.id);

      expect(found).not.toBeNull();
      expect(found!.id.value).toBe(discussion.id.value);
      expect(found!.content.text).toBe('Test comment');
      expect(found!.status.isActive()).toBe(true);
    });

    it('should return null for non-existent id', async () => {
      const found = await repository.findById(DiscussionId.generate());

      expect(found).toBeNull();
    });

    it('should save a reply with parentId', async () => {
      const parentId = DiscussionId.generate();
      const reply = createDiscussion({ parentId, content: 'Reply comment' });

      await repository.save(reply);
      const found = await repository.findById(reply.id);

      expect(found).not.toBeNull();
      expect(found!.parentId).not.toBeNull();
      expect(found!.parentId!.value).toBe(parentId.value);
      expect(found!.isReply()).toBe(true);
    });

    it('should save a top-level discussion with null parentId', async () => {
      const discussion = createDiscussion({ parentId: null });

      await repository.save(discussion);
      const found = await repository.findById(discussion.id);

      expect(found).not.toBeNull();
      expect(found!.parentId).toBeNull();
      expect(found!.isReply()).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true for saved discussion', async () => {
      const discussion = createDiscussion();
      await repository.save(discussion);

      const result = await repository.exists(discussion.id);

      expect(result).toBe(true);
    });

    it('should return false for non-existent discussion', async () => {
      const result = await repository.exists(DiscussionId.generate());

      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove a discussion from storage', async () => {
      const discussion = createDiscussion();
      await repository.save(discussion);

      await repository.delete(discussion);

      expect(await repository.findById(discussion.id)).toBeNull();
      expect(await repository.exists(discussion.id)).toBe(false);
    });
  });

  describe('findByPublicationId', () => {
    it('should find all discussions for a given publication', async () => {
      const pubId = PublicationId.generate();
      const disc1 = createDiscussion({ publicationId: pubId, content: 'Comment 1' });
      const disc2 = createDiscussion({ publicationId: pubId, content: 'Comment 2' });
      const otherDisc = createDiscussion({ content: 'Other pub comment' });

      await repository.save(disc1);
      await repository.save(disc2);
      await repository.save(otherDisc);

      const results = await repository.findByPublicationId(pubId);

      expect(results).toHaveLength(2);
      const ids = results.map((d) => d.id.value);
      expect(ids).toContain(disc1.id.value);
      expect(ids).toContain(disc2.id.value);
    });

    it('should return empty array when publication has no discussions', async () => {
      const results = await repository.findByPublicationId(PublicationId.generate());

      expect(results).toEqual([]);
    });

    it('should find both top-level and reply discussions for a publication', async () => {
      const pubId = PublicationId.generate();
      const parentId = DiscussionId.generate();
      const topLevel = createDiscussion({
        id: parentId,
        publicationId: pubId,
        content: 'Top level',
      });
      const reply = createDiscussion({
        publicationId: pubId,
        parentId,
        content: 'Reply',
      });

      await repository.save(topLevel);
      await repository.save(reply);

      const results = await repository.findByPublicationId(pubId);

      expect(results).toHaveLength(2);
      const replyResult = results.find((d) => d.isReply());
      expect(replyResult).toBeDefined();
      expect(replyResult!.parentId!.value).toBe(parentId.value);
    });
  });

  describe('test helpers', () => {
    it('should report correct size', async () => {
      await repository.save(createDiscussion());
      await repository.save(createDiscussion());

      expect(repository.size).toBe(2);
    });

    it('should clear all data', async () => {
      await repository.save(createDiscussion());
      await repository.save(createDiscussion());

      repository.clear();

      expect(repository.size).toBe(0);
    });
  });
});
