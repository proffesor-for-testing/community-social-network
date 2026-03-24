import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TypeOrmUnitOfWork } from '../persistence/typeorm-unit-of-work';

function createMockQueryRunner() {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    startTransaction: vi.fn().mockResolvedValue(undefined),
    commitTransaction: vi.fn().mockResolvedValue(undefined),
    rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockDataSource(mockQueryRunner: ReturnType<typeof createMockQueryRunner>) {
  return {
    createQueryRunner: vi.fn().mockReturnValue(mockQueryRunner),
  } as any;
}

describe('TypeOrmUnitOfWork', () => {
  let mockQueryRunner: ReturnType<typeof createMockQueryRunner>;
  let mockDataSource: ReturnType<typeof createMockDataSource>;
  let unitOfWork: TypeOrmUnitOfWork;

  beforeEach(() => {
    mockQueryRunner = createMockQueryRunner();
    mockDataSource = createMockDataSource(mockQueryRunner);
    unitOfWork = new TypeOrmUnitOfWork(mockDataSource);
  });

  describe('begin()', () => {
    it('should create a query runner, connect, and start a transaction', async () => {
      const result = await unitOfWork.begin();

      expect(mockDataSource.createQueryRunner).toHaveBeenCalledOnce();
      expect(mockQueryRunner.connect).toHaveBeenCalledOnce();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalledOnce();
      expect(result).toBe(mockQueryRunner);
    });

    it('should call connect before startTransaction', async () => {
      const callOrder: string[] = [];
      mockQueryRunner.connect.mockImplementation(() => {
        callOrder.push('connect');
        return Promise.resolve();
      });
      mockQueryRunner.startTransaction.mockImplementation(() => {
        callOrder.push('startTransaction');
        return Promise.resolve();
      });

      await unitOfWork.begin();

      expect(callOrder).toEqual(['connect', 'startTransaction']);
    });
  });

  describe('commit()', () => {
    it('should commit the transaction and release the query runner', async () => {
      await unitOfWork.begin();

      await unitOfWork.commit();

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalledOnce();
      expect(mockQueryRunner.release).toHaveBeenCalledOnce();
    });

    it('should throw if called without begin()', async () => {
      await expect(unitOfWork.commit()).rejects.toThrow(
        'Transaction not started. Call begin() first.',
      );
    });

    it('should set queryRunner to null after commit (prevents double-commit)', async () => {
      await unitOfWork.begin();
      await unitOfWork.commit();

      await expect(unitOfWork.commit()).rejects.toThrow(
        'Transaction not started. Call begin() first.',
      );
    });

    it('should call commitTransaction before release', async () => {
      const callOrder: string[] = [];
      mockQueryRunner.commitTransaction.mockImplementation(() => {
        callOrder.push('commitTransaction');
        return Promise.resolve();
      });
      mockQueryRunner.release.mockImplementation(() => {
        callOrder.push('release');
        return Promise.resolve();
      });

      await unitOfWork.begin();
      await unitOfWork.commit();

      expect(callOrder).toEqual(['commitTransaction', 'release']);
    });
  });

  describe('rollback()', () => {
    it('should rollback the transaction and release the query runner', async () => {
      await unitOfWork.begin();

      await unitOfWork.rollback();

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledOnce();
      expect(mockQueryRunner.release).toHaveBeenCalledOnce();
    });

    it('should throw if called without begin()', async () => {
      await expect(unitOfWork.rollback()).rejects.toThrow(
        'Transaction not started. Call begin() first.',
      );
    });

    it('should set queryRunner to null after rollback (prevents double-rollback)', async () => {
      await unitOfWork.begin();
      await unitOfWork.rollback();

      await expect(unitOfWork.rollback()).rejects.toThrow(
        'Transaction not started. Call begin() first.',
      );
    });

    it('should call rollbackTransaction before release', async () => {
      const callOrder: string[] = [];
      mockQueryRunner.rollbackTransaction.mockImplementation(() => {
        callOrder.push('rollbackTransaction');
        return Promise.resolve();
      });
      mockQueryRunner.release.mockImplementation(() => {
        callOrder.push('release');
        return Promise.resolve();
      });

      await unitOfWork.begin();
      await unitOfWork.rollback();

      expect(callOrder).toEqual(['rollbackTransaction', 'release']);
    });
  });

  describe('getQueryRunner()', () => {
    it('should return the active query runner after begin()', async () => {
      await unitOfWork.begin();

      const result = unitOfWork.getQueryRunner();

      expect(result).toBe(mockQueryRunner);
    });

    it('should throw if called without begin()', () => {
      expect(() => unitOfWork.getQueryRunner()).toThrow(
        'Transaction not started. Call begin() first.',
      );
    });

    it('should throw after commit() since queryRunner is cleared', async () => {
      await unitOfWork.begin();
      await unitOfWork.commit();

      expect(() => unitOfWork.getQueryRunner()).toThrow(
        'Transaction not started. Call begin() first.',
      );
    });

    it('should throw after rollback() since queryRunner is cleared', async () => {
      await unitOfWork.begin();
      await unitOfWork.rollback();

      expect(() => unitOfWork.getQueryRunner()).toThrow(
        'Transaction not started. Call begin() first.',
      );
    });
  });

  describe('lifecycle sequences', () => {
    it('should support begin -> commit -> begin -> commit', async () => {
      await unitOfWork.begin();
      await unitOfWork.commit();

      const secondRunner = createMockQueryRunner();
      mockDataSource.createQueryRunner.mockReturnValue(secondRunner);

      const result = await unitOfWork.begin();
      expect(result).toBe(secondRunner);

      await unitOfWork.commit();
      expect(secondRunner.commitTransaction).toHaveBeenCalledOnce();
    });

    it('should support begin -> rollback -> begin -> commit', async () => {
      await unitOfWork.begin();
      await unitOfWork.rollback();

      const secondRunner = createMockQueryRunner();
      mockDataSource.createQueryRunner.mockReturnValue(secondRunner);

      await unitOfWork.begin();
      await unitOfWork.commit();

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledOnce();
      expect(secondRunner.commitTransaction).toHaveBeenCalledOnce();
    });
  });
});
