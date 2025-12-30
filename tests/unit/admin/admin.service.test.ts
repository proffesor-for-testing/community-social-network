/**
 * M8 Admin & Security Module - Unit Tests
 * TDD London School (Mockist) Approach
 *
 * Test Coverage:
 * - Admin login with 2FA requirement
 * - 2FA TOTP setup and verification
 * - User moderation actions (warn, suspend, ban)
 * - Role-based permission enforcement
 * - Audit logging for all admin actions
 */

import { AdminService } from '../../../src/admin/admin.service';
import { TotpService } from '../../../src/admin/totp.service';
import { AuditService } from '../../../src/admin/audit.service';
import { ModerationService } from '../../../src/admin/moderation.service';
import {
  AdminRole,
  AdminUser,
  ModerationAction,
  AuditLogEntry,
  TotpSetupResult,
} from '../../../src/admin/admin.types';

// Mock dependencies - London School approach
const mockTotpService: jest.Mocked<TotpService> = {
  generateSecret: jest.fn(),
  generateQRCode: jest.fn(),
  generateBackupCodes: jest.fn(),
  verifyCode: jest.fn(),
  verifyBackupCode: jest.fn(),
  hashBackupCodes: jest.fn(),
  is2FAEnabled: jest.fn(),
  enable2FA: jest.fn(),
  disable2FA: jest.fn(),
  storeSecret: jest.fn(),
  buildOTPAuthURL: jest.fn(),
} as any;

const mockAuditService: jest.Mocked<AuditService> = {
  log: jest.fn(),
  logAsync: jest.fn(),
  getLogsForUser: jest.fn(),
  getLogsByAction: jest.fn(),
  getLogsInTimeRange: jest.fn(),
} as any;

const mockModerationService: jest.Mocked<ModerationService> = {
  warnUser: jest.fn(),
  suspendUser: jest.fn(),
  banUser: jest.fn(),
  unbanUser: jest.fn(),
  getModerationHistory: jest.fn(),
  canPerformAction: jest.fn(),
} as any;

const mockUserRepository = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
};

const mockAdmin2FARepository = {
  findByUserId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('AdminService', () => {
  let adminService: AdminService;

  const mockSuperAdmin: AdminUser = {
    id: 'super-admin-uuid',
    email: 'superadmin@example.com',
    passwordHash: '$2b$10$hashedpassword',
    status: 'active',
    role: AdminRole.SUPER_ADMIN,
    require2FA: true,
    requireIpWhitelist: true,
    lastLoginAt: null,
    lastLoginIp: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdmin: AdminUser = {
    id: 'admin-uuid',
    email: 'admin@example.com',
    passwordHash: '$2b$10$hashedpassword',
    status: 'active',
    role: AdminRole.ADMIN,
    require2FA: true,
    requireIpWhitelist: false,
    lastLoginAt: null,
    lastLoginIp: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockModerator: AdminUser = {
    id: 'moderator-uuid',
    email: 'moderator@example.com',
    passwordHash: '$2b$10$hashedpassword',
    status: 'active',
    role: AdminRole.MODERATOR,
    require2FA: true,
    requireIpWhitelist: false,
    lastLoginAt: null,
    lastLoginIp: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    adminService = new AdminService(
      mockTotpService,
      mockAuditService,
      mockModerationService,
      mockUserRepository as any,
      mockAdmin2FARepository as any
    );
  });

  describe('Admin Login with 2FA', () => {
    it('should require 2FA for admin login', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(mockAdmin);
      mockTotpService.is2FAEnabled.mockResolvedValue(true);

      // Act
      const result = await adminService.initiateLogin(
        'admin@example.com',
        'password123',
        '192.168.1.1'
      );

      // Assert
      expect(result.requires2FA).toBe(true);
      expect(result.tempToken).toBeDefined();
      expect(result.sessionToken).toBeUndefined();
      expect(mockTotpService.is2FAEnabled).toHaveBeenCalledWith('admin-uuid');
    });

    it('should reject login when 2FA is not set up but required', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(mockAdmin);
      mockTotpService.is2FAEnabled.mockResolvedValue(false);

      // Act & Assert
      await expect(
        adminService.initiateLogin('admin@example.com', 'password123', '192.168.1.1')
      ).rejects.toThrow('2FA setup required before login');
    });

    it('should complete login after valid 2FA verification', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(mockAdmin);
      mockUserRepository.findById.mockResolvedValue(mockAdmin);
      mockTotpService.is2FAEnabled.mockResolvedValue(true);
      mockTotpService.verifyCode.mockResolvedValue(true);
      mockAuditService.logAsync.mockResolvedValue(undefined);

      // First initiate login to get temp token
      const initResult = await adminService.initiateLogin(
        'admin@example.com',
        'password123',
        '192.168.1.1'
      );

      // Act - complete with the actual temp token
      const result = await adminService.completeLogin(
        initResult.tempToken!,
        '123456',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.sessionToken).toBeDefined();
      expect(mockTotpService.verifyCode).toHaveBeenCalledWith('admin-uuid', '123456');
    });

    it('should reject login with invalid 2FA code', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(mockAdmin);
      mockUserRepository.findById.mockResolvedValue(mockAdmin);
      mockTotpService.is2FAEnabled.mockResolvedValue(true);
      mockTotpService.verifyCode.mockResolvedValue(false);
      mockAuditService.logAsync.mockResolvedValue(undefined);

      // First initiate login to get temp token
      const initResult = await adminService.initiateLogin(
        'admin@example.com',
        'password123',
        '192.168.1.1'
      );

      // Act & Assert
      await expect(
        adminService.completeLogin(initResult.tempToken!, '000000', '192.168.1.1', 'Mozilla/5.0')
      ).rejects.toThrow('Invalid 2FA code');
    });
  });

  describe('2FA Setup', () => {
    it('should generate TOTP secret during 2FA setup', async () => {
      // Arrange - need to mock the user repository to return the admin user
      const totpSetup: TotpSetupResult = {
        secret: 'JBSWY3DPEHPK3PXP',
        qrCodeUrl: 'data:image/png;base64,iVBORw0KGgo...',
        backupCodes: [
          'a1b2c3d4',
          'e5f6g7h8',
          'i9j0k1l2',
          'm3n4o5p6',
          'q7r8s9t0',
          'u1v2w3x4',
          'y5z6a7b8',
          'c9d0e1f2',
          'g3h4i5j6',
          'k7l8m9n0',
        ],
      };

      mockUserRepository.findById.mockResolvedValue(mockAdmin);
      mockTotpService.generateSecret.mockReturnValue('JBSWY3DPEHPK3PXP');
      mockTotpService.generateQRCode.mockResolvedValue(totpSetup.qrCodeUrl);
      mockTotpService.generateBackupCodes.mockReturnValue(totpSetup.backupCodes);
      mockTotpService.hashBackupCodes.mockResolvedValue(['hashed1', 'hashed2']);
      mockTotpService.storeSecret.mockResolvedValue(undefined);
      mockAdmin2FARepository.create.mockResolvedValue({ id: '2fa-uuid' });

      // Act
      const result = await adminService.setup2FA(mockAdmin.id);

      // Assert
      expect(result.secret).toBe('JBSWY3DPEHPK3PXP');
      expect(result.qrCodeUrl).toContain('data:image/png');
      expect(result.backupCodes).toHaveLength(10);
      expect(mockTotpService.generateSecret).toHaveBeenCalled();
      expect(mockTotpService.generateQRCode).toHaveBeenCalled();
      expect(mockTotpService.generateBackupCodes).toHaveBeenCalled();
    });

    it('should verify TOTP code during 2FA setup completion', async () => {
      // Arrange
      mockTotpService.verifyCode.mockResolvedValue(true);
      mockTotpService.enable2FA.mockResolvedValue(undefined);
      mockAuditService.logAsync.mockResolvedValue(undefined);

      // Act
      const result = await adminService.verify2FASetup(mockAdmin.id, '123456');

      // Assert
      expect(result.success).toBe(true);
      expect(mockTotpService.verifyCode).toHaveBeenCalledWith(mockAdmin.id, '123456');
      expect(mockTotpService.enable2FA).toHaveBeenCalledWith(mockAdmin.id);
      expect(mockAuditService.logAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'auth.2fa.enabled',
          adminId: mockAdmin.id,
        })
      );
    });

    it('should reject invalid TOTP code during setup', async () => {
      // Arrange
      mockTotpService.verifyCode.mockResolvedValue(false);

      // Act & Assert
      await expect(adminService.verify2FASetup(mockAdmin.id, '000000')).rejects.toThrow(
        'Invalid TOTP code'
      );
    });
  });

  describe('User Moderation Actions', () => {
    const targetUserId = 'target-user-uuid';

    describe('Warn User', () => {
      it('should allow admin to warn user', async () => {
        // Arrange
        mockUserRepository.findById.mockResolvedValue(mockAdmin);
        mockModerationService.canPerformAction.mockReturnValue(true);
        mockModerationService.warnUser.mockResolvedValue({
          success: true,
          actionId: 'warn-action-uuid',
        });
        mockAuditService.logAsync.mockResolvedValue(undefined);

        // Act
        const result = await adminService.warnUser(
          mockAdmin.id,
          targetUserId,
          'Violation of community guidelines',
          '192.168.1.1'
        );

        // Assert
        expect(result.success).toBe(true);
        expect(mockModerationService.warnUser).toHaveBeenCalledWith(
          targetUserId,
          'Violation of community guidelines',
          mockAdmin.id
        );
        expect(mockAuditService.logAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'moderation.user.warn',
            adminId: mockAdmin.id,
            targetId: targetUserId,
          })
        );
      });

      it('should allow moderator to warn user', async () => {
        // Arrange
        mockUserRepository.findById.mockResolvedValue(mockModerator);
        mockModerationService.canPerformAction.mockReturnValue(true);
        mockModerationService.warnUser.mockResolvedValue({
          success: true,
          actionId: 'warn-action-uuid',
        });
        mockAuditService.logAsync.mockResolvedValue(undefined);

        // Act
        const result = await adminService.warnUser(
          mockModerator.id,
          targetUserId,
          'Spam warning',
          '192.168.1.1'
        );

        // Assert
        expect(result.success).toBe(true);
      });
    });

    describe('Suspend User (7 days)', () => {
      it('should allow admin to suspend user for 7 days', async () => {
        // Arrange
        mockUserRepository.findById.mockResolvedValue(mockAdmin);
        mockModerationService.canPerformAction.mockReturnValue(true);
        mockModerationService.suspendUser.mockResolvedValue({
          success: true,
          actionId: 'suspend-action-uuid',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        mockAuditService.logAsync.mockResolvedValue(undefined);

        // Act
        const result = await adminService.suspendUser(
          mockAdmin.id,
          targetUserId,
          7,
          'Repeated violations',
          '192.168.1.1'
        );

        // Assert
        expect(result.success).toBe(true);
        expect(result.expiresAt).toBeDefined();
        expect(mockModerationService.suspendUser).toHaveBeenCalledWith(
          targetUserId,
          7,
          'Repeated violations',
          mockAdmin.id
        );
        expect(mockAuditService.logAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'moderation.user.suspend',
            adminId: mockAdmin.id,
            targetId: targetUserId,
            details: expect.objectContaining({ durationDays: 7 }),
          })
        );
      });

      it('should allow moderator to suspend user', async () => {
        // Arrange
        mockUserRepository.findById.mockResolvedValue(mockModerator);
        mockModerationService.canPerformAction.mockReturnValue(true);
        mockModerationService.suspendUser.mockResolvedValue({
          success: true,
          actionId: 'suspend-action-uuid',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        mockAuditService.logAsync.mockResolvedValue(undefined);

        // Act
        const result = await adminService.suspendUser(
          mockModerator.id,
          targetUserId,
          7,
          'Harassment',
          '192.168.1.1'
        );

        // Assert
        expect(result.success).toBe(true);
      });
    });

    describe('Ban User Permanently', () => {
      it('should allow super admin to ban user permanently', async () => {
        // Arrange
        mockUserRepository.findById.mockResolvedValue(mockSuperAdmin);
        mockModerationService.canPerformAction.mockReturnValue(true);
        mockModerationService.banUser.mockResolvedValue({
          success: true,
          actionId: 'ban-action-uuid',
        });
        mockAuditService.logAsync.mockResolvedValue(undefined);

        // Act
        const result = await adminService.banUser(
          mockSuperAdmin.id,
          targetUserId,
          'Severe TOS violation',
          '192.168.1.1'
        );

        // Assert
        expect(result.success).toBe(true);
        expect(mockModerationService.banUser).toHaveBeenCalledWith(
          targetUserId,
          'Severe TOS violation',
          mockSuperAdmin.id
        );
        expect(mockAuditService.logAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'moderation.user.ban',
            adminId: mockSuperAdmin.id,
            targetId: targetUserId,
          })
        );
      });

      it('should allow admin to ban user permanently', async () => {
        // Arrange
        mockUserRepository.findById.mockResolvedValue(mockAdmin);
        mockModerationService.canPerformAction.mockReturnValue(true);
        mockModerationService.banUser.mockResolvedValue({
          success: true,
          actionId: 'ban-action-uuid',
        });
        mockAuditService.logAsync.mockResolvedValue(undefined);

        // Act
        const result = await adminService.banUser(
          mockAdmin.id,
          targetUserId,
          'Illegal content',
          '192.168.1.1'
        );

        // Assert
        expect(result.success).toBe(true);
      });

      it('should NOT allow moderator to ban user permanently', async () => {
        // Arrange
        mockUserRepository.findById.mockResolvedValue(mockModerator);
        mockModerationService.canPerformAction.mockReturnValue(false);

        // Act & Assert
        await expect(
          adminService.banUser(mockModerator.id, targetUserId, 'Some reason', '192.168.1.1')
        ).rejects.toThrow('Insufficient permissions to ban user');

        expect(mockAuditService.logAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'authz.permission.denied',
            adminId: mockModerator.id,
            details: expect.objectContaining({
              attemptedAction: 'moderation.user.ban',
            }),
          })
        );
      });
    });
  });

  describe('Audit Logging', () => {
    it('should log all admin actions to audit trail', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockAdmin);
      mockModerationService.canPerformAction.mockReturnValue(true);
      mockModerationService.warnUser.mockResolvedValue({
        success: true,
        actionId: 'warn-action-uuid',
      });
      mockAuditService.logAsync.mockResolvedValue(undefined);

      // Act
      await adminService.warnUser(
        mockAdmin.id,
        'target-user-uuid',
        'Test warning',
        '192.168.1.1'
      );

      // Assert
      expect(mockAuditService.logAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'moderation.user.warn',
          adminId: mockAdmin.id,
          targetType: 'user',
          targetId: 'target-user-uuid',
          ipAddress: '192.168.1.1',
          status: 'success',
          details: expect.objectContaining({
            reason: 'Test warning',
          }),
        })
      );
    });

    it('should log failed permission checks', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(mockModerator);
      mockModerationService.canPerformAction.mockReturnValue(false);

      // Act & Assert
      await expect(
        adminService.banUser(mockModerator.id, 'target-uuid', 'reason', '192.168.1.1')
      ).rejects.toThrow();

      expect(mockAuditService.logAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'authz.permission.denied',
          status: 'blocked',
        })
      );
    });

    it('should log login attempts', async () => {
      // Arrange
      mockUserRepository.findByEmail.mockResolvedValue(mockAdmin);
      mockTotpService.is2FAEnabled.mockResolvedValue(true);

      // Act
      await adminService.initiateLogin('admin@example.com', 'password123', '192.168.1.1');

      // Assert
      expect(mockAuditService.logAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'auth.login.initiated',
          ipAddress: '192.168.1.1',
        })
      );
    });

    it('should include complete context in audit logs', async () => {
      // Arrange
      const expectedAuditEntry: Partial<AuditLogEntry> = {
        action: 'moderation.user.suspend',
        adminId: mockAdmin.id,
        targetType: 'user',
        targetId: 'target-user-uuid',
        ipAddress: '10.0.0.1',
        status: 'success',
        details: {
          reason: 'Harassment',
          durationDays: 7,
        },
      };

      mockUserRepository.findById.mockResolvedValue(mockAdmin);
      mockModerationService.canPerformAction.mockReturnValue(true);
      mockModerationService.suspendUser.mockResolvedValue({
        success: true,
        actionId: 'action-uuid',
        expiresAt: new Date(),
      });
      mockAuditService.logAsync.mockResolvedValue(undefined);

      // Act
      await adminService.suspendUser(
        mockAdmin.id,
        'target-user-uuid',
        7,
        'Harassment',
        '10.0.0.1'
      );

      // Assert
      expect(mockAuditService.logAsync).toHaveBeenCalledWith(
        expect.objectContaining(expectedAuditEntry)
      );
    });
  });

  describe('Permission Matrix Enforcement', () => {
    describe('Super Admin Permissions', () => {
      it('super admin can perform all moderation actions', async () => {
        mockUserRepository.findById.mockResolvedValue(mockSuperAdmin);
        mockModerationService.canPerformAction.mockReturnValue(true);

        const permissions = adminService.getPermissionsForRole(AdminRole.SUPER_ADMIN);

        expect(permissions.canWarnUser).toBe(true);
        expect(permissions.canSuspendUser).toBe(true);
        expect(permissions.canBanUser).toBe(true);
        expect(permissions.canDeleteUser).toBe(true);
        expect(permissions.canCreateModerator).toBe(true);
        expect(permissions.canCreateAdmin).toBe(true);
        expect(permissions.canAccessSystemSettings).toBe(true);
      });
    });

    describe('Admin Permissions', () => {
      it('admin can warn, suspend, ban, delete users and create moderators', async () => {
        const permissions = adminService.getPermissionsForRole(AdminRole.ADMIN);

        expect(permissions.canWarnUser).toBe(true);
        expect(permissions.canSuspendUser).toBe(true);
        expect(permissions.canBanUser).toBe(true);
        expect(permissions.canDeleteUser).toBe(true);
        expect(permissions.canCreateModerator).toBe(true);
        expect(permissions.canCreateAdmin).toBe(false);
        expect(permissions.canAccessSystemSettings).toBe(false);
      });
    });

    describe('Moderator Permissions', () => {
      it('moderator can only warn and suspend users', async () => {
        const permissions = adminService.getPermissionsForRole(AdminRole.MODERATOR);

        expect(permissions.canWarnUser).toBe(true);
        expect(permissions.canSuspendUser).toBe(true);
        expect(permissions.canBanUser).toBe(false);
        expect(permissions.canDeleteUser).toBe(false);
        expect(permissions.canCreateModerator).toBe(false);
        expect(permissions.canCreateAdmin).toBe(false);
        expect(permissions.canAccessSystemSettings).toBe(false);
      });
    });
  });
});

describe('TotpService', () => {
  let totpService: TotpService;

  beforeEach(() => {
    totpService = new TotpService();
  });

  describe('Secret Generation', () => {
    it('should generate a valid base32 secret', () => {
      const secret = totpService.generateSecret();

      expect(secret).toBeDefined();
      expect(typeof secret).toBe('string');
      expect(secret.length).toBeGreaterThanOrEqual(16);
      // Base32 alphabet check
      expect(/^[A-Z2-7]+=*$/.test(secret)).toBe(true);
    });

    it('should generate unique secrets each time', () => {
      const secret1 = totpService.generateSecret();
      const secret2 = totpService.generateSecret();

      expect(secret1).not.toBe(secret2);
    });
  });

  describe('Backup Codes', () => {
    it('should generate exactly 10 backup codes', () => {
      const codes = totpService.generateBackupCodes();

      expect(codes).toHaveLength(10);
    });

    it('should generate 8-character hex backup codes', () => {
      const codes = totpService.generateBackupCodes();

      codes.forEach((code) => {
        expect(code.length).toBe(8);
        expect(/^[a-f0-9]{8}$/.test(code)).toBe(true);
      });
    });

    it('should generate unique backup codes', () => {
      const codes = totpService.generateBackupCodes();
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(10);
    });
  });

  describe('QR Code Generation', () => {
    it('should generate a data URL for QR code', async () => {
      const qrCode = await totpService.generateQRCode(
        'admin@example.com',
        'JBSWY3DPEHPK3PXP'
      );

      expect(qrCode).toContain('data:image/png;base64,');
    });

    it('should include correct OTPAuth URL parameters', async () => {
      // Note: We're testing the URL format that would be encoded in QR
      const otpAuthUrl = totpService.buildOTPAuthURL(
        'admin@example.com',
        'JBSWY3DPEHPK3PXP'
      );

      expect(otpAuthUrl).toContain('otpauth://totp/');
      // Email is URL encoded in the OTPAuth URL
      expect(otpAuthUrl).toContain('admin%40example.com');
      expect(otpAuthUrl).toContain('secret=JBSWY3DPEHPK3PXP');
      expect(otpAuthUrl).toContain('issuer=CommunityNetwork');
    });
  });

  describe('TOTP Verification', () => {
    it('should verify a valid TOTP code', async () => {
      // This test would use a known secret and calculated code
      // In real implementation, we'd mock the time or use a test secret
      const mockSecret = 'JBSWY3DPEHPK3PXP';

      // Mock the internal verification using the correct method name
      jest.spyOn(totpService as any, 'getStoredSecret').mockResolvedValue(mockSecret);
      jest.spyOn(totpService as any, 'verifyTOTPWithWindow').mockReturnValue(true);

      const result = await totpService.verifyCode('user-uuid', '123456');

      expect(result).toBe(true);
    });

    it('should reject an invalid TOTP code', async () => {
      const mockSecret = 'JBSWY3DPEHPK3PXP';

      jest.spyOn(totpService as any, 'getStoredSecret').mockResolvedValue(mockSecret);
      jest.spyOn(totpService as any, 'verifyTOTPWithWindow').mockReturnValue(false);

      const result = await totpService.verifyCode('user-uuid', '000000');

      expect(result).toBe(false);
    });

    it('should allow window of +/- 1 time step (90 seconds total)', async () => {
      // The TOTP should accept codes from previous and next 30-second windows
      const mockSecret = 'JBSWY3DPEHPK3PXP';

      jest.spyOn(totpService as any, 'getStoredSecret').mockResolvedValue(mockSecret);

      // Mock verification with window parameter
      const verifyWithWindow = jest.spyOn(totpService as any, 'verifyTOTPWithWindow');
      verifyWithWindow.mockReturnValue(true);

      await totpService.verifyCode('user-uuid', '123456');

      expect(verifyWithWindow).toHaveBeenCalledWith(
        mockSecret,
        '123456',
        expect.objectContaining({ window: 1 })
      );
    });
  });
});

describe('AuditService', () => {
  let auditService: AuditService;
  const mockAuditRepository = {
    create: jest.fn(),
    findByUserId: jest.fn(),
    findByAction: jest.fn(),
    findByTimeRange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    auditService = new AuditService(mockAuditRepository as any);
  });

  afterEach(async () => {
    // Clean up the audit service timer
    await auditService.shutdown();
  });

  describe('Logging', () => {
    it('should create audit log entry with all required fields', async () => {
      const logEntry: Partial<AuditLogEntry> = {
        action: 'moderation.user.warn',
        adminId: 'admin-uuid',
        targetType: 'user',
        targetId: 'target-uuid',
        ipAddress: '192.168.1.1',
        status: 'success',
        details: { reason: 'Test warning' },
      };

      mockAuditRepository.create.mockResolvedValue({ id: 'log-uuid', ...logEntry });

      // Use synchronous log method instead of logAsync for predictable testing
      await auditService.log(logEntry as AuditLogEntry);

      expect(mockAuditRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'moderation.user.warn',
          adminId: 'admin-uuid',
          targetType: 'user',
          targetId: 'target-uuid',
          ipAddress: '192.168.1.1',
          status: 'success',
        })
      );
    });

    it('should include timestamp in audit log', async () => {
      const beforeTime = Date.now();

      mockAuditRepository.create.mockResolvedValue({ id: 'log-uuid' });

      // Use synchronous log method for predictable testing
      await auditService.log({
        action: 'auth.login.success',
        adminId: 'admin-uuid',
        ipAddress: '192.168.1.1',
        status: 'success',
      } as AuditLogEntry);

      const afterTime = Date.now();

      expect(mockAuditRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: expect.any(Date),
        })
      );

      const callArgs = mockAuditRepository.create.mock.calls[0][0];
      const logTime = new Date(callArgs.createdAt).getTime();
      expect(logTime).toBeGreaterThanOrEqual(beforeTime);
      expect(logTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Query', () => {
    it('should retrieve logs for a specific admin user', async () => {
      const mockLogs = [
        { id: 1, action: 'auth.login.success', adminId: 'admin-uuid' },
        { id: 2, action: 'moderation.user.warn', adminId: 'admin-uuid' },
      ];

      mockAuditRepository.findByUserId.mockResolvedValue(mockLogs);

      const logs = await auditService.getLogsForUser('admin-uuid');

      expect(logs).toHaveLength(2);
      expect(mockAuditRepository.findByUserId).toHaveBeenCalledWith('admin-uuid', undefined);
    });

    it('should support pagination in log queries', async () => {
      mockAuditRepository.findByUserId.mockResolvedValue([]);

      await auditService.getLogsForUser('admin-uuid', { limit: 10, offset: 20 });

      expect(mockAuditRepository.findByUserId).toHaveBeenCalledWith('admin-uuid', {
        limit: 10,
        offset: 20,
      });
    });

    it('should filter logs by action type', async () => {
      mockAuditRepository.findByAction.mockResolvedValue([]);

      await auditService.getLogsByAction('auth.login.*');

      expect(mockAuditRepository.findByAction).toHaveBeenCalledWith('auth.login.*', undefined);
    });

    it('should filter logs by time range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      mockAuditRepository.findByTimeRange.mockResolvedValue([]);

      await auditService.getLogsInTimeRange(startDate, endDate);

      expect(mockAuditRepository.findByTimeRange).toHaveBeenCalledWith(
        startDate,
        endDate,
        undefined
      );
    });
  });
});

describe('ModerationService', () => {
  let moderationService: ModerationService;
  const mockUserRepository = {
    findById: jest.fn(),
    update: jest.fn(),
  };
  const mockModerationRepository = {
    create: jest.fn(),
    findByUserId: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    moderationService = new ModerationService(
      mockUserRepository as any,
      mockModerationRepository as any
    );
  });

  describe('Permission Checks', () => {
    it('should allow super admin to perform all actions', () => {
      expect(moderationService.canPerformAction(AdminRole.SUPER_ADMIN, 'warn')).toBe(true);
      expect(moderationService.canPerformAction(AdminRole.SUPER_ADMIN, 'suspend')).toBe(true);
      expect(moderationService.canPerformAction(AdminRole.SUPER_ADMIN, 'ban')).toBe(true);
      expect(moderationService.canPerformAction(AdminRole.SUPER_ADMIN, 'delete')).toBe(true);
    });

    it('should allow admin to warn, suspend, ban, and delete', () => {
      expect(moderationService.canPerformAction(AdminRole.ADMIN, 'warn')).toBe(true);
      expect(moderationService.canPerformAction(AdminRole.ADMIN, 'suspend')).toBe(true);
      expect(moderationService.canPerformAction(AdminRole.ADMIN, 'ban')).toBe(true);
      expect(moderationService.canPerformAction(AdminRole.ADMIN, 'delete')).toBe(true);
    });

    it('should allow moderator to only warn and suspend', () => {
      expect(moderationService.canPerformAction(AdminRole.MODERATOR, 'warn')).toBe(true);
      expect(moderationService.canPerformAction(AdminRole.MODERATOR, 'suspend')).toBe(true);
      expect(moderationService.canPerformAction(AdminRole.MODERATOR, 'ban')).toBe(false);
      expect(moderationService.canPerformAction(AdminRole.MODERATOR, 'delete')).toBe(false);
    });
  });

  describe('Warn User', () => {
    it('should create warning record', async () => {
      const targetUser = { id: 'target-uuid', status: 'active', warningCount: 0 };
      mockUserRepository.findById.mockResolvedValue(targetUser);
      mockModerationRepository.create.mockResolvedValue({ id: 'action-uuid' });
      mockUserRepository.update.mockResolvedValue({ ...targetUser, warningCount: 1 });

      const result = await moderationService.warnUser(
        'target-uuid',
        'Violation of guidelines',
        'admin-uuid'
      );

      expect(result.success).toBe(true);
      expect(result.actionId).toBeDefined();
      expect(mockModerationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warn',
          targetUserId: 'target-uuid',
          reason: 'Violation of guidelines',
          performedBy: 'admin-uuid',
        })
      );
    });
  });

  describe('Suspend User', () => {
    it('should suspend user for specified duration', async () => {
      const targetUser = { id: 'target-uuid', status: 'active' };
      const suspendedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      mockUserRepository.findById.mockResolvedValue(targetUser);
      mockModerationRepository.create.mockResolvedValue({ id: 'action-uuid' });
      mockUserRepository.update.mockResolvedValue({
        ...targetUser,
        status: 'suspended',
        suspendedUntil,
      });

      const result = await moderationService.suspendUser(
        'target-uuid',
        7,
        'Repeated violations',
        'admin-uuid'
      );

      expect(result.success).toBe(true);
      expect(result.expiresAt).toBeDefined();
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        'target-uuid',
        expect.objectContaining({
          status: 'suspended',
        })
      );
    });
  });

  describe('Ban User', () => {
    it('should permanently ban user', async () => {
      const targetUser = { id: 'target-uuid', status: 'active' };

      mockUserRepository.findById.mockResolvedValue(targetUser);
      mockModerationRepository.create.mockResolvedValue({ id: 'action-uuid' });
      mockUserRepository.update.mockResolvedValue({
        ...targetUser,
        status: 'banned',
      });

      const result = await moderationService.banUser(
        'target-uuid',
        'Severe TOS violation',
        'admin-uuid'
      );

      expect(result.success).toBe(true);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        'target-uuid',
        expect.objectContaining({
          status: 'banned',
        })
      );
    });
  });

  describe('Moderation History', () => {
    it('should retrieve moderation history for a user', async () => {
      const mockHistory = [
        { id: 1, type: 'warn', createdAt: new Date() },
        { id: 2, type: 'suspend', createdAt: new Date() },
      ];

      mockModerationRepository.findByUserId.mockResolvedValue(mockHistory);

      const history = await moderationService.getModerationHistory('target-uuid');

      expect(history).toHaveLength(2);
      expect(mockModerationRepository.findByUserId).toHaveBeenCalledWith('target-uuid');
    });
  });
});
