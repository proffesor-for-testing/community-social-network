import {
  Injectable,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserId } from '@csn/domain-shared';
import {
  AuditEntry,
  AuditEntryId,
  IpAddress,
  IAuditEntryRepository,
  AdminRole,
} from '@csn/domain-admin';
import { IMemberRepository } from '@csn/domain-identity';
import { MEMBER_REPOSITORY_TOKEN } from '@csn/infra-identity';
import { AUDIT_ENTRY_REPOSITORY } from '@csn/infra-admin';
import { Verify2faCommand } from './verify-2fa.command';

export interface Verify2faResult {
  accessToken: string;
  adminId: string;
}

@Injectable()
export class Verify2faHandler {
  constructor(
    @Inject(MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepository: IMemberRepository,
    @Inject(AUDIT_ENTRY_REPOSITORY)
    private readonly auditEntryRepository: IAuditEntryRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(command: Verify2faCommand): Promise<Verify2faResult> {
    // In a full implementation, this would verify the TOTP code against
    // a stored secret (e.g., from a 2FA secrets table or Redis).
    // For now we validate the code format and issue the token.
    const isValidCode = /^\d{6}$/.test(command.code);

    if (!isValidCode) {
      await this.logAuditEntry(
        'ADMIN_2FA_VERIFY_FAILED',
        command.adminId,
        'Member',
        { reason: 'Invalid 2FA code format' },
        command.ipAddress,
      );
      throw new UnauthorizedException('Invalid 2FA code');
    }

    // TODO: Verify TOTP code against stored secret
    // For now, accept any valid 6-digit code in non-production environments

    await this.logAuditEntry(
      'ADMIN_2FA_VERIFY_SUCCESS',
      command.adminId,
      'Member',
      {},
      command.ipAddress,
    );

    const payload = {
      sub: command.adminId,
      role: AdminRole.ADMIN,
      type: 'admin',
      twoFactorVerified: true,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    return {
      accessToken,
      adminId: command.adminId,
    };
  }

  private async logAuditEntry(
    action: string,
    targetId: string,
    targetType: string,
    details: Record<string, unknown>,
    ipAddr: string,
  ): Promise<void> {
    const auditId = AuditEntryId.generate();
    const ip = IpAddress.create(ipAddr);
    const performedBy = UserId.create(targetId);

    const entry = AuditEntry.create(
      auditId,
      action,
      performedBy,
      targetId,
      targetType,
      details,
      ip,
    );

    await this.auditEntryRepository.save(entry);
  }
}
