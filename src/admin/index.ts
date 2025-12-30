/**
 * M8 Admin & Security Module - Main Export
 *
 * Exports all admin module components for use in the application
 */

// Types and interfaces
export * from './admin.types';

// Services
export { TotpService } from './totp.service';
export { AuditService, InMemoryAuditRepository } from './audit.service';
export {
  ModerationService,
  InMemoryModerationRepository,
  InMemoryUserRepository,
} from './moderation.service';
export { AdminService } from './admin.service';

// Controller
export { AdminController, createAdminController } from './admin.controller';

// Routes
export { createAdminRoutes } from './admin.routes';

/**
 * Factory function to create fully configured admin module
 */
import { TotpService } from './totp.service';
import { AuditService, InMemoryAuditRepository } from './audit.service';
import {
  ModerationService,
  InMemoryModerationRepository,
  InMemoryUserRepository,
} from './moderation.service';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { createAdminRoutes } from './admin.routes';
import { Router } from 'express';

export interface AdminModuleConfig {
  totpEncryptionKey?: string;
  useInMemoryRepositories?: boolean;
}

export interface AdminModuleInstance {
  totpService: TotpService;
  auditService: AuditService;
  moderationService: ModerationService;
  adminService: AdminService;
  adminController: AdminController;
  router: Router;
}

/**
 * Create and configure the admin module with all dependencies
 */
export function createAdminModule(config?: AdminModuleConfig): AdminModuleInstance {
  // Create repositories (in-memory for development, or inject real ones)
  const userRepository = new InMemoryUserRepository();
  const admin2FARepository = createInMemoryAdmin2FARepository();
  const auditRepository = new InMemoryAuditRepository();
  const moderationRepository = new InMemoryModerationRepository();

  // Create services
  const totpService = new TotpService(admin2FARepository);
  const auditService = new AuditService(auditRepository);
  const moderationService = new ModerationService(userRepository, moderationRepository);
  const adminService = new AdminService(
    totpService,
    auditService,
    moderationService,
    userRepository,
    admin2FARepository
  );

  // Create controller
  const adminController = new AdminController(adminService, auditService);

  // Create routes
  const router = createAdminRoutes(adminController, adminService, auditService);

  return {
    totpService,
    auditService,
    moderationService,
    adminService,
    adminController,
    router,
  };
}

/**
 * In-memory Admin 2FA Repository for testing
 */
function createInMemoryAdmin2FARepository() {
  const records = new Map<string, any>();

  return {
    async findByUserId(userId: string) {
      return records.get(userId) || null;
    },
    async create(data: any) {
      const record = {
        id: `2fa-${Date.now()}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      records.set(data.userId, record);
      return record;
    },
    async update(userId: string, data: any) {
      const existing = records.get(userId);
      if (!existing) {
        throw new Error('2FA record not found');
      }
      const updated = { ...existing, ...data, updatedAt: new Date() };
      records.set(userId, updated);
      return updated;
    },
    async delete(userId: string) {
      records.delete(userId);
    },
  };
}
