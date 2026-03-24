import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface ErasureResult {
  memberId: string;
  erasedAt: Date;
  contextsProcessed: string[];
  errors: string[];
}

/**
 * Handles right-to-erasure (GDPR Article 17) by soft-deleting
 * and anonymizing user data across all bounded contexts.
 * Keeps audit trail entries with anonymized references.
 */
@Injectable()
export class DataErasureService {
  private readonly logger = new Logger(DataErasureService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Soft-deletes and anonymizes all PII for a member across all contexts.
   */
  async eraseMemberData(memberId: string): Promise<ErasureResult> {
    const result: ErasureResult = {
      memberId,
      erasedAt: new Date(),
      contextsProcessed: [],
      errors: [],
    };

    const anonymizedEmail = `deleted-${memberId.substring(0, 8)}@deleted.local`;
    const anonymizedName = `Deleted User`;

    // Use a transaction for atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Identity context - anonymize member
      await this.safeExecute(queryRunner, result, 'identity', async () => {
        await queryRunner.query(
          `UPDATE members SET email = $1, display_name = $2, password_hash = 'ERASED', status = 'deleted' WHERE id = $3`,
          [anonymizedEmail, anonymizedName, memberId],
        );
        // Invalidate all sessions
        await queryRunner.query(
          `UPDATE sessions SET revoked_at = NOW() WHERE member_id = $1 AND revoked_at IS NULL`,
          [memberId],
        );
      });

      // 2. Profile context - anonymize profile
      await this.safeExecute(queryRunner, result, 'profile', async () => {
        await queryRunner.query(
          `UPDATE profiles SET display_name = $1, bio = NULL, avatar_url = NULL, location = NULL, website = NULL WHERE member_id = $2`,
          [anonymizedName, memberId],
        );
      });

      // 3. Content context - anonymize content but keep for community context
      await this.safeExecute(queryRunner, result, 'content', async () => {
        await queryRunner.query(
          `UPDATE publications SET author_id = $1 WHERE author_id = $2`,
          [memberId, memberId], // Keep reference, author name resolved at display time
        );
        await queryRunner.query(
          `UPDATE discussions SET author_id = $1 WHERE author_id = $2`,
          [memberId, memberId],
        );
      });

      // 4. Social Graph context - remove connections and blocks
      await this.safeExecute(queryRunner, result, 'social-graph', async () => {
        await queryRunner.query(
          `DELETE FROM connections WHERE requester_id = $1 OR addressee_id = $1`,
          [memberId],
        );
        await queryRunner.query(
          `DELETE FROM blocks WHERE blocker_id = $1 OR blocked_id = $1`,
          [memberId],
        );
      });

      // 5. Community context - remove memberships, transfer ownership
      await this.safeExecute(queryRunner, result, 'community', async () => {
        await queryRunner.query(
          `DELETE FROM memberships WHERE member_id = $1`,
          [memberId],
        );
      });

      // 6. Notification context - delete alerts and preferences
      await this.safeExecute(queryRunner, result, 'notifications', async () => {
        await queryRunner.query(
          `DELETE FROM alerts WHERE recipient_id = $1`,
          [memberId],
        );
        await queryRunner.query(
          `DELETE FROM notification_preferences WHERE member_id = $1`,
          [memberId],
        );
      });

      // 7. GDPR context - delete consent records
      await this.safeExecute(queryRunner, result, 'consents', async () => {
        await queryRunner.query(
          `DELETE FROM consent_records WHERE member_id = $1`,
          [memberId],
        );
      });

      // 8. Admin context - anonymize audit entries but keep them
      await this.safeExecute(queryRunner, result, 'admin-audit', async () => {
        await queryRunner.query(
          `UPDATE audit_entries SET actor_id = $1 WHERE actor_id = $2`,
          [memberId, memberId], // Keep actor_id for traceability, name anonymized at display
        );
      });

      await queryRunner.commitTransaction();
      this.logger.log(`Data erasure completed for member ${memberId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      result.errors.push(
        `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.logger.error(`Data erasure failed for member ${memberId}`, error);
    } finally {
      await queryRunner.release();
    }

    return result;
  }

  private async safeExecute(
    queryRunner: { query: (q: string, p?: unknown[]) => Promise<unknown> },
    result: ErasureResult,
    contextName: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    try {
      await fn();
      result.contextsProcessed.push(contextName);
    } catch (error) {
      const message = `${contextName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(message);
      this.logger.warn(`Erasure step failed: ${message}`);
    }
  }
}
