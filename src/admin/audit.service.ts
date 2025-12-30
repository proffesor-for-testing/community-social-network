/**
 * M8 Admin & Security Module - Audit Service
 *
 * Comprehensive audit logging for all admin actions
 * Implements immutable audit trail with querying capabilities
 */

import {
  AuditLogEntry,
  AuditStatus,
  IAuditLogRepository,
  PaginationOptions,
  AUDIT_CATEGORIES,
} from './admin.types';

/**
 * Audit Service for comprehensive admin action logging
 *
 * Features:
 * - Immutable audit trail
 * - Async logging to avoid blocking
 * - Query by user, action, time range
 * - Supports wildcard action patterns
 */
export class AuditService {
  private auditRepository: IAuditLogRepository;
  private logQueue: AuditLogEntry[] = [];
  private isProcessing = false;
  private batchSize = 100;
  private flushIntervalMs = 1000;
  private flushTimer?: NodeJS.Timeout;

  constructor(auditRepository: IAuditLogRepository) {
    this.auditRepository = auditRepository;

    // Start periodic flush timer
    this.startFlushTimer();
  }

  /**
   * Log an audit entry synchronously (blocking)
   * Use for critical events that must be logged before proceeding
   */
  async log(entry: AuditLogEntry): Promise<AuditLogEntry> {
    const fullEntry = this.enrichEntry(entry);
    return await this.auditRepository.create(fullEntry);
  }

  /**
   * Log an audit entry asynchronously (non-blocking)
   * Queues the entry for batch processing
   */
  async logAsync(entry: AuditLogEntry): Promise<void> {
    const fullEntry = this.enrichEntry(entry);
    this.logQueue.push(fullEntry);

    // Flush immediately if queue is large
    if (this.logQueue.length >= this.batchSize) {
      await this.flushQueue();
    }
  }

  /**
   * Get audit logs for a specific admin user
   */
  async getLogsForUser(
    userId: string,
    options?: PaginationOptions
  ): Promise<AuditLogEntry[]> {
    return await this.auditRepository.findByUserId(userId, options);
  }

  /**
   * Get audit logs by action type (supports wildcards like 'auth.login.*')
   */
  async getLogsByAction(
    actionPattern: string,
    options?: PaginationOptions
  ): Promise<AuditLogEntry[]> {
    return await this.auditRepository.findByAction(actionPattern, options);
  }

  /**
   * Get audit logs within a time range
   */
  async getLogsInTimeRange(
    startDate: Date,
    endDate: Date,
    options?: PaginationOptions
  ): Promise<AuditLogEntry[]> {
    return await this.auditRepository.findByTimeRange(startDate, endDate, options);
  }

  /**
   * Log authentication event
   */
  async logAuthEvent(
    action: string,
    adminId: string,
    ipAddress: string,
    status: AuditStatus,
    details?: Record<string, any>
  ): Promise<void> {
    await this.logAsync({
      action,
      adminId,
      ipAddress,
      status,
      details,
    });
  }

  /**
   * Log moderation action
   */
  async logModerationAction(
    action: string,
    adminId: string,
    targetUserId: string,
    ipAddress: string,
    details: Record<string, any>
  ): Promise<void> {
    await this.logAsync({
      action,
      adminId,
      targetType: 'user',
      targetId: targetUserId,
      ipAddress,
      status: AuditStatus.SUCCESS,
      details,
    });
  }

  /**
   * Log permission denial
   */
  async logPermissionDenied(
    adminId: string,
    attemptedAction: string,
    targetType: string,
    targetId: string,
    ipAddress: string
  ): Promise<void> {
    await this.logAsync({
      action: 'authz.permission.denied',
      adminId,
      targetType,
      targetId,
      ipAddress,
      status: AuditStatus.BLOCKED,
      details: {
        attemptedAction,
      },
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    action: string,
    adminId: string | null,
    ipAddress: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details: Record<string, any>
  ): Promise<void> {
    await this.logAsync({
      action,
      adminId: adminId || 'system',
      ipAddress,
      status: AuditStatus.BLOCKED,
      details: {
        ...details,
        severity,
      },
    });
  }

  /**
   * Enrich entry with timestamp and defaults
   */
  private enrichEntry(entry: AuditLogEntry): AuditLogEntry {
    return {
      ...entry,
      createdAt: entry.createdAt || new Date(),
      status: entry.status || AuditStatus.SUCCESS,
    };
  }

  /**
   * Start the periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.logQueue.length > 0) {
        this.flushQueue().catch((err) => {
          console.error('Error flushing audit log queue:', err);
        });
      }
    }, this.flushIntervalMs);
  }

  /**
   * Flush queued entries to the database
   */
  private async flushQueue(): Promise<void> {
    if (this.isProcessing || this.logQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Take all queued entries
      const entries = this.logQueue.splice(0, this.logQueue.length);

      // Insert all entries (could be optimized with batch insert)
      await Promise.all(
        entries.map((entry) => this.auditRepository.create(entry))
      );
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Stop the service and flush remaining entries
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Final flush
    await this.flushQueue();
  }

  /**
   * Get all valid audit action types
   */
  getValidActions(): string[] {
    return Object.values(AUDIT_CATEGORIES).flat();
  }

  /**
   * Validate that an action string is a known audit action
   */
  isValidAction(action: string): boolean {
    return this.getValidActions().includes(action);
  }

  /**
   * Get audit category for an action
   */
  getCategoryForAction(action: string): string | null {
    for (const [category, actions] of Object.entries(AUDIT_CATEGORIES)) {
      if ((actions as readonly string[]).includes(action)) {
        return category;
      }
    }
    return null;
  }
}

/**
 * In-memory audit repository for testing
 */
export class InMemoryAuditRepository implements IAuditLogRepository {
  private logs: AuditLogEntry[] = [];
  private idCounter = 1;

  async create(entry: Omit<AuditLogEntry, 'id'>): Promise<AuditLogEntry> {
    const logEntry: AuditLogEntry = {
      ...entry,
      id: this.idCounter++,
      createdAt: entry.createdAt || new Date(),
    };
    this.logs.push(logEntry);
    return logEntry;
  }

  async findByUserId(
    userId: string,
    options?: PaginationOptions
  ): Promise<AuditLogEntry[]> {
    let results = this.logs.filter((log) => log.adminId === userId);

    if (options?.offset) {
      results = results.slice(options.offset);
    }
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async findByAction(
    actionPattern: string,
    options?: PaginationOptions
  ): Promise<AuditLogEntry[]> {
    const regex = new RegExp(
      '^' + actionPattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$'
    );

    let results = this.logs.filter((log) => regex.test(log.action));

    if (options?.offset) {
      results = results.slice(options.offset);
    }
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async findByTimeRange(
    startDate: Date,
    endDate: Date,
    options?: PaginationOptions
  ): Promise<AuditLogEntry[]> {
    let results = this.logs.filter((log) => {
      const logTime = log.createdAt?.getTime() || 0;
      return logTime >= startDate.getTime() && logTime <= endDate.getTime();
    });

    if (options?.offset) {
      results = results.slice(options.offset);
    }
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  // Test helper methods
  getAllLogs(): AuditLogEntry[] {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
    this.idCounter = 1;
  }
}
