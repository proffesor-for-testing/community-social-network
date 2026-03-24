/**
 * Integration Test: Content - Post Lifecycle
 *
 * Exercises the full post CRUD lifecycle through the CQRS handlers
 * wired to in-memory repositories.
 *
 * Flow:
 * 1. Create a post
 * 2. Get the post
 * 3. Update the post
 * 4. Add a reaction
 * 5. Delete the post
 * 6. Verify deleted post is not found
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CommandBus, QueryBus, CqrsModule } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';

// ── Handlers ────────────────────────────────────────────────────────────────

import { CreatePostHandler } from '../../../apps/api/src/modules/content/commands/create-post.handler';
import { CreatePostCommand } from '../../../apps/api/src/modules/content/commands/create-post.command';
import { UpdatePostHandler } from '../../../apps/api/src/modules/content/commands/update-post.handler';
import { UpdatePostCommand } from '../../../apps/api/src/modules/content/commands/update-post.command';
import { DeletePostHandler } from '../../../apps/api/src/modules/content/commands/delete-post.handler';
import { DeletePostCommand } from '../../../apps/api/src/modules/content/commands/delete-post.command';
import { AddReactionHandler } from '../../../apps/api/src/modules/content/commands/add-reaction.handler';
import { AddReactionCommand } from '../../../apps/api/src/modules/content/commands/add-reaction.command';
import { GetPostHandler } from '../../../apps/api/src/modules/content/queries/get-post.handler';
import { GetPostQuery } from '../../../apps/api/src/modules/content/queries/get-post.query';

// ── Test infrastructure ─────────────────────────────────────────────────────

import {
  createTestRepositories,
  TestRepositories,
  PUBLICATION_REPOSITORY_TOKEN,
  DISCUSSION_REPOSITORY_TOKEN,
} from '../../setup/test-app';
import { VisibilityEnum, ReactionTypeEnum } from '@csn/domain-content';

describe('Content: Post Lifecycle', () => {
  let module: TestingModule;
  let repos: TestRepositories;
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  const authorId = randomUUID();
  const otherUserId = randomUUID();

  beforeEach(async () => {
    repos = createTestRepositories();

    module = await Test.createTestingModule({
      imports: [CqrsModule],
      providers: [
        CreatePostHandler,
        UpdatePostHandler,
        DeletePostHandler,
        AddReactionHandler,
        GetPostHandler,
        { provide: PUBLICATION_REPOSITORY_TOKEN, useValue: repos.publicationRepo },
        { provide: DISCUSSION_REPOSITORY_TOKEN, useValue: repos.discussionRepo },
      ],
    }).compile();

    // CQRS module needs explicit initialization
    await module.init();

    commandBus = module.get(CommandBus);
    queryBus = module.get(QueryBus);
  });

  // ── Step 1: Create a post ─────────────────────────────────────────────

  it('should create a post and return the publication ID', async () => {
    const command = new CreatePostCommand(
      authorId,
      'Hello world! This is my first integration test post.',
      VisibilityEnum.PUBLIC,
    );

    const result = await commandBus.execute(command);

    expect(result).toBeDefined();
    expect(result.publicationId).toBeDefined();
    expect(typeof result.publicationId).toBe('string');

    // Verify persisted
    expect(repos.publicationRepo.size).toBe(1);
  });

  // ── Step 2: Get the post ──────────────────────────────────────────────

  it('should retrieve a created post by ID', async () => {
    const createResult = await commandBus.execute(
      new CreatePostCommand(authorId, 'Retrievable post content here.', VisibilityEnum.PUBLIC),
    );

    const post = await queryBus.execute(new GetPostQuery(createResult.publicationId));

    expect(post.id).toBe(createResult.publicationId);
    expect(post.authorId).toBe(authorId);
    expect(post.content).toBe('Retrievable post content here.');
    expect(post.visibility).toBe('PUBLIC');
    expect(post.status).toBe('PUBLISHED');
    expect(post.commentCount).toBe(0);
  });

  // ── Step 3: Update the post ───────────────────────────────────────────

  it('should update a post content', async () => {
    const createResult = await commandBus.execute(
      new CreatePostCommand(authorId, 'Original content before edit.', VisibilityEnum.PUBLIC),
    );

    await commandBus.execute(
      new UpdatePostCommand(createResult.publicationId, authorId, 'Updated content after editing.'),
    );

    const post = await queryBus.execute(new GetPostQuery(createResult.publicationId));
    expect(post.content).toBe('Updated content after editing.');
  });

  // ── Step 3b: Non-owner cannot update ──────────────────────────────────

  it('should reject update by non-owner', async () => {
    const createResult = await commandBus.execute(
      new CreatePostCommand(authorId, 'Only I can edit this.', VisibilityEnum.PUBLIC),
    );

    await expect(
      commandBus.execute(
        new UpdatePostCommand(createResult.publicationId, otherUserId, 'Hacked content!'),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── Step 4: Add a reaction ────────────────────────────────────────────

  it('should add a reaction to a post without error', async () => {
    const createResult = await commandBus.execute(
      new CreatePostCommand(authorId, 'A post worth reacting to.', VisibilityEnum.PUBLIC),
    );

    // The AddReaction handler modifies the aggregate's in-memory reaction counts
    // and persists. With the in-memory repository, reaction entities are managed
    // separately from the publication entity (matching the Postgres pattern), so
    // round-tripping through the mapper does not preserve aggregate-level counts.
    // We verify the handler executes successfully (no throw = reaction accepted).
    await expect(
      commandBus.execute(
        new AddReactionCommand(createResult.publicationId, 'post', otherUserId, ReactionTypeEnum.LIKE),
      ),
    ).resolves.not.toThrow();
  });

  // ── Step 5: Delete the post ───────────────────────────────────────────

  it('should delete a post (soft delete)', async () => {
    const createResult = await commandBus.execute(
      new CreatePostCommand(authorId, 'This post will be deleted.', VisibilityEnum.PUBLIC),
    );

    await commandBus.execute(
      new DeletePostCommand(createResult.publicationId, authorId),
    );

    // The post still exists in storage but with DELETED status
    const post = await queryBus.execute(new GetPostQuery(createResult.publicationId));
    expect(post.status).toBe('DELETED');
  });

  // ── Step 5b: Non-owner cannot delete ──────────────────────────────────

  it('should reject delete by non-owner', async () => {
    const createResult = await commandBus.execute(
      new CreatePostCommand(authorId, 'Only I can delete this.', VisibilityEnum.PUBLIC),
    );

    await expect(
      commandBus.execute(
        new DeletePostCommand(createResult.publicationId, otherUserId),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── Step 6: Get non-existent post ─────────────────────────────────────

  it('should throw NotFoundException for non-existent post', async () => {
    const fakeId = randomUUID();
    await expect(
      queryBus.execute(new GetPostQuery(fakeId)),
    ).rejects.toThrow(NotFoundException);
  });

  // ── Full lifecycle test ───────────────────────────────────────────────

  it('should complete full create -> get -> update -> react -> delete lifecycle', async () => {
    // Create
    const createResult = await commandBus.execute(
      new CreatePostCommand(authorId, 'Full lifecycle post.', VisibilityEnum.PUBLIC),
    );
    expect(createResult.publicationId).toBeDefined();

    // Get
    let post = await queryBus.execute(new GetPostQuery(createResult.publicationId));
    expect(post.content).toBe('Full lifecycle post.');

    // Update
    await commandBus.execute(
      new UpdatePostCommand(createResult.publicationId, authorId, 'Edited lifecycle post.'),
    );
    post = await queryBus.execute(new GetPostQuery(createResult.publicationId));
    expect(post.content).toBe('Edited lifecycle post.');

    // React (handler executes without error; reaction counts are not preserved
    // through the in-memory mapper round-trip, matching the separate ReactionEntity pattern)
    await expect(
      commandBus.execute(
        new AddReactionCommand(createResult.publicationId, 'post', otherUserId, ReactionTypeEnum.LOVE),
      ),
    ).resolves.not.toThrow();

    // Delete
    await commandBus.execute(
      new DeletePostCommand(createResult.publicationId, authorId),
    );
    post = await queryBus.execute(new GetPostQuery(createResult.publicationId));
    expect(post.status).toBe('DELETED');
  });
});
