import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreatePostHandler, CreatePostResult } from '../commands/create-post.handler';
import { CreatePostCommand } from '../commands/create-post.command';
import {
  VisibilityEnum,
  PublicationId,
  IPublicationRepository,
  Publication,
} from '@csn/domain-content';

describe('CreatePostHandler', () => {
  let handler: CreatePostHandler;
  let publicationRepository: IPublicationRepository;
  let savedPublication: Publication | null;

  const authorId = '11111111-1111-1111-1111-111111111111';
  const generatedId = PublicationId.generate();

  beforeEach(() => {
    savedPublication = null;

    publicationRepository = {
      nextId: vi.fn().mockReturnValue(generatedId),
      findById: vi.fn().mockResolvedValue(null),
      exists: vi.fn().mockResolvedValue(false),
      save: vi.fn().mockImplementation(async (pub: Publication) => {
        savedPublication = pub;
      }),
      delete: vi.fn().mockResolvedValue(undefined),
      findByAuthorId: vi.fn().mockResolvedValue([]),
    };

    handler = new CreatePostHandler(publicationRepository);
  });

  it('should create a publication and save it', async () => {
    const command = new CreatePostCommand(
      authorId,
      'Hello, world!',
      VisibilityEnum.PUBLIC,
    );

    const result = await handler.execute(command);

    expect(result).toBeInstanceOf(CreatePostResult);
    expect(result.publicationId).toBe(generatedId.value);
    expect(publicationRepository.nextId).toHaveBeenCalledOnce();
    expect(publicationRepository.save).toHaveBeenCalledOnce();

    expect(savedPublication).not.toBeNull();
    expect(savedPublication!.authorId.value).toBe(authorId);
    expect(savedPublication!.content.text).toBe('Hello, world!');
    expect(savedPublication!.visibility.value).toBe(VisibilityEnum.PUBLIC);
    expect(savedPublication!.status.isPublished()).toBe(true);
  });

  it('should create a publication with CONNECTIONS_ONLY visibility', async () => {
    const command = new CreatePostCommand(
      authorId,
      'Connections only post',
      VisibilityEnum.CONNECTIONS_ONLY,
    );

    const result = await handler.execute(command);

    expect(result.publicationId).toBe(generatedId.value);
    expect(savedPublication).not.toBeNull();
    expect(savedPublication!.visibility.value).toBe(VisibilityEnum.CONNECTIONS_ONLY);
  });

  it('should throw on empty content', async () => {
    const command = new CreatePostCommand(
      authorId,
      '',
      VisibilityEnum.PUBLIC,
    );

    await expect(handler.execute(command)).rejects.toThrow();
    expect(publicationRepository.save).not.toHaveBeenCalled();
  });

  it('should throw on invalid author ID', async () => {
    const command = new CreatePostCommand(
      'not-a-uuid',
      'Valid content',
      VisibilityEnum.PUBLIC,
    );

    await expect(handler.execute(command)).rejects.toThrow();
    expect(publicationRepository.save).not.toHaveBeenCalled();
  });

  it('should generate a domain event on creation', async () => {
    const command = new CreatePostCommand(
      authorId,
      'Post with events',
      VisibilityEnum.PUBLIC,
    );

    await handler.execute(command);

    expect(savedPublication).not.toBeNull();
    // pullDomainEvents() returns and clears the events
    const events = savedPublication!.pullDomainEvents();
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].eventType).toBe('PublicationCreated');
  });
});
