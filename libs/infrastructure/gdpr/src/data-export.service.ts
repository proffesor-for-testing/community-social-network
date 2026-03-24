import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';

export interface ExportRequest {
  id: string;
  memberId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Exports all user data across all 7 bounded contexts as JSON.
 * Implements GDPR Article 20 - Right to Data Portability.
 */
@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  /** In-memory store for export requests (use Redis/DB in production) */
  private readonly exportRequests = new Map<string, ExportRequest>();

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Creates a new data export request.
   */
  async createExportRequest(memberId: string): Promise<ExportRequest> {
    const request: ExportRequest = {
      id: randomUUID(),
      memberId,
      status: 'pending',
      createdAt: new Date(),
    };

    this.exportRequests.set(request.id, request);

    // Process asynchronously (in production, this would go through a Bull queue)
    this.processExport(request.id).catch((err) => {
      this.logger.error(`Export failed for request ${request.id}`, err);
    });

    return request;
  }

  /**
   * Gets the status and data of an export request.
   */
  async getExportRequest(requestId: string, memberId: string): Promise<ExportRequest | null> {
    const request = this.exportRequests.get(requestId);
    if (!request || request.memberId !== memberId) {
      return null;
    }
    return request;
  }

  /**
   * Processes the export by collecting data from all bounded contexts.
   */
  private async processExport(requestId: string): Promise<void> {
    const request = this.exportRequests.get(requestId);
    if (!request) return;

    request.status = 'processing';

    try {
      const memberId = request.memberId;
      const data: Record<string, unknown> = {};

      // Identity context
      data.identity = await this.exportIdentityData(memberId);

      // Profile context
      data.profile = await this.exportProfileData(memberId);

      // Content context
      data.content = await this.exportContentData(memberId);

      // Social Graph context
      data.socialGraph = await this.exportSocialGraphData(memberId);

      // Community context
      data.community = await this.exportCommunityData(memberId);

      // Notifications context
      data.notifications = await this.exportNotificationData(memberId);

      // Consent records
      data.consents = await this.exportConsentData(memberId);

      request.data = data;
      request.status = 'completed';
      request.completedAt = new Date();

      this.logger.log(`Export completed for member ${memberId}, request ${requestId}`);
    } catch (error) {
      request.status = 'failed';
      request.error = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Export failed for request ${requestId}`, error);
    }
  }

  private async exportIdentityData(memberId: string): Promise<unknown> {
    return this.safeQuery(
      `SELECT id, email, display_name, status, created_at, last_login_at FROM members WHERE id = $1`,
      [memberId],
    );
  }

  private async exportProfileData(memberId: string): Promise<unknown> {
    return this.safeQuery(
      `SELECT * FROM profiles WHERE member_id = $1`,
      [memberId],
    );
  }

  private async exportContentData(memberId: string): Promise<unknown> {
    const publications = await this.safeQuery(
      `SELECT * FROM publications WHERE author_id = $1`,
      [memberId],
    );
    const discussions = await this.safeQuery(
      `SELECT * FROM discussions WHERE author_id = $1`,
      [memberId],
    );
    return { publications, discussions };
  }

  private async exportSocialGraphData(memberId: string): Promise<unknown> {
    const connections = await this.safeQuery(
      `SELECT * FROM connections WHERE requester_id = $1 OR addressee_id = $1`,
      [memberId],
    );
    const blocks = await this.safeQuery(
      `SELECT * FROM blocks WHERE blocker_id = $1`,
      [memberId],
    );
    return { connections, blocks };
  }

  private async exportCommunityData(memberId: string): Promise<unknown> {
    const memberships = await this.safeQuery(
      `SELECT * FROM memberships WHERE member_id = $1`,
      [memberId],
    );
    const ownedGroups = await this.safeQuery(
      `SELECT * FROM groups WHERE owner_id = $1`,
      [memberId],
    );
    return { memberships, ownedGroups };
  }

  private async exportNotificationData(memberId: string): Promise<unknown> {
    const alerts = await this.safeQuery(
      `SELECT * FROM alerts WHERE recipient_id = $1`,
      [memberId],
    );
    const preferences = await this.safeQuery(
      `SELECT * FROM notification_preferences WHERE member_id = $1`,
      [memberId],
    );
    return { alerts, preferences };
  }

  private async exportConsentData(memberId: string): Promise<unknown> {
    return this.safeQuery(
      `SELECT * FROM consent_records WHERE member_id = $1`,
      [memberId],
    );
  }

  /**
   * Runs a query safely, returning empty array if the table doesn't exist.
   */
  private async safeQuery(query: string, params: unknown[]): Promise<unknown[]> {
    try {
      return await this.dataSource.query(query, params);
    } catch (error) {
      this.logger.warn(
        `Query failed (table may not exist): ${(error as Error).message}`,
      );
      return [];
    }
  }
}
