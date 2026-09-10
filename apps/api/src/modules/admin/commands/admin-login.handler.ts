import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Email, UserId } from '@csn/domain-shared';
import { IMemberRepository } from '@csn/domain-identity';
import {
  AuditEntry,
  AuditEntryId,
  IpAddress,
  IAuditEntryRepository,
} from '@csn/domain-admin';
import { MEMBER_REPOSITORY_TOKEN } from '@csn/infra-identity';
import { AUDIT_ENTRY_REPOSITORY } from '@csn/infra-admin';
import { JwtTokenService } from '@csn/infra-auth';
import { AdminLoginCommand } from './admin-login.command';
import { rolesFor } from '../../identity/utils/admin-roles';

export interface AdminLoginResult {
  accessToken: string;
  requiresTwoFactor: boolean;
  adminId: string;
}

@Injectable()
export class AdminLoginHandler {
  constructor(
    @Inject(MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepository: IMemberRepository,
    @Inject(AUDIT_ENTRY_REPOSITORY)
    private readonly auditEntryRepository: IAuditEntryRepository,
    @Inject(JwtTokenService)
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async execute(command: AdminLoginCommand): Promise<AdminLoginResult> {
    const email = Email.create(command.email);
    const member = await this.memberRepository.findByEmail(email);

    if (!member) {
      await this.logAuditEntry(
        'ADMIN_LOGIN_FAILED',
        'unknown',
        'Member',
        { reason: 'Member not found', email: command.email },
        command.ipAddress,
      );
      throw new UnauthorizedException('Invalid admin credentials');
    }

    // Compare password against stored bcrypt hash. Admin authority itself is
    // carried by the member's `isAdmin` flag, checked after authentication.
    const isValid = await bcrypt.compare(
      command.password,
      member.credential.value,
    );
    if (!isValid) {
      await this.logAuditEntry(
        'ADMIN_LOGIN_FAILED',
        member.id.value,
        'Member',
        { reason: 'Invalid password' },
        command.ipAddress,
      );
      throw new UnauthorizedException('Invalid admin credentials');
    }

    if (member.status.value !== 'ACTIVE') {
      await this.logAuditEntry(
        'ADMIN_LOGIN_FAILED',
        member.id.value,
        'Member',
        { reason: 'Account not active', status: member.status.value },
        command.ipAddress,
      );
      throw new ForbiddenException('Admin account is not active');
    }

    await this.logAuditEntry(
      'ADMIN_LOGIN_SUCCESS',
      member.id.value,
      'Member',
      { email: command.email },
      command.ipAddress,
    );

    // Reject anyone who is not an admin — the admin-login endpoint must not
    // grant elevated privileges to non-admins, even with valid credentials.
    if (!member.isAdmin) {
      throw new UnauthorizedException('Not an admin account');
    }
    // Mint a canonical access token via the shared JwtTokenService so the
    // global JwtAuthGuard accepts it (issuer / audience / jti / blacklist).
    const accessToken = await this.jwtTokenService.generateAccessToken({
      userId: member.id.value,
      email: member.email.value,
      roles: rolesFor(member),
    });

    return {
      accessToken,
      requiresTwoFactor: false, // Placeholder: integrate with 2FA store
      adminId: member.id.value,
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
    const performedBy = targetId === 'unknown'
      ? UserId.create('00000000-0000-0000-0000-000000000000')
      : UserId.create(targetId);

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
