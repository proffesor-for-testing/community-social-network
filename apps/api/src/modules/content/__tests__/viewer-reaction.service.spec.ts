import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ViewerReactionService } from '../services/viewer-reaction.service';

describe('ViewerReactionService.findByViewer', () => {
  let repo: { find: ReturnType<typeof vi.fn> };
  let service: ViewerReactionService;

  beforeEach(() => {
    // Arrange (shared)
    repo = { find: vi.fn().mockResolvedValue([]) };
    service = new ViewerReactionService(repo as never);
  });

  it('should return an empty map without querying when there is no viewer', async () => {
    // Act
    const result = await service.findByViewer(['p1', 'p2'], undefined);

    // Assert
    expect(result.size).toBe(0);
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('should return an empty map without querying when there are no publications', async () => {
    // Act
    const result = await service.findByViewer([], 'viewer-1');

    // Assert
    expect(result.size).toBe(0);
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('should issue exactly one query for a page of publications (no N+1)', async () => {
    // Act
    await service.findByViewer(['p1', 'p2', 'p3'], 'viewer-1');

    // Assert
    expect(repo.find).toHaveBeenCalledTimes(1);
  });

  it('should scope the query to the viewer id', async () => {
    // Act
    await service.findByViewer(['p1'], 'viewer-1');

    // Assert
    const [options] = repo.find.mock.calls[0]!;
    expect(options.where.userId).toBe('viewer-1');
  });

  it('should map each returned row to publicationId → type', async () => {
    // Arrange
    repo.find.mockResolvedValue([
      { publicationId: 'p1', type: 'LIKE' },
      { publicationId: 'p3', type: 'HAHA' },
    ]);

    // Act
    const result = await service.findByViewer(['p1', 'p2', 'p3'], 'viewer-1');

    // Assert
    expect(Object.fromEntries(result)).toEqual({ p1: 'LIKE', p3: 'HAHA' });
  });

  it('should omit publications the viewer did not react to', async () => {
    // Arrange
    repo.find.mockResolvedValue([{ publicationId: 'p1', type: 'LIKE' }]);

    // Act
    const result = await service.findByViewer(['p1', 'p2'], 'viewer-1');

    // Assert
    expect(result.has('p2')).toBe(false);
  });
});
