import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

/**
 * Unit of Work wrapping a TypeORM transaction.
 * Ensures multiple repository operations commit/rollback atomically.
 */
@Injectable()
export class TypeOrmUnitOfWork {
  private queryRunner: QueryRunner | null = null;

  constructor(private readonly dataSource: DataSource) {}

  async begin(): Promise<QueryRunner> {
    this.queryRunner = this.dataSource.createQueryRunner();
    await this.queryRunner.connect();
    await this.queryRunner.startTransaction();
    return this.queryRunner;
  }

  async commit(): Promise<void> {
    if (!this.queryRunner) {
      throw new Error('Transaction not started. Call begin() first.');
    }
    await this.queryRunner.commitTransaction();
    await this.queryRunner.release();
    this.queryRunner = null;
  }

  async rollback(): Promise<void> {
    if (!this.queryRunner) {
      throw new Error('Transaction not started. Call begin() first.');
    }
    await this.queryRunner.rollbackTransaction();
    await this.queryRunner.release();
    this.queryRunner = null;
  }

  getQueryRunner(): QueryRunner {
    if (!this.queryRunner) {
      throw new Error('Transaction not started. Call begin() first.');
    }
    return this.queryRunner;
  }
}
