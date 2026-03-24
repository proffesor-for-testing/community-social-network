import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Email, UserId } from '@csn/domain-shared';
import { IMemberRepository } from '@csn/domain-identity';
import {
  AuditEntry,
  AuditEntryId,
  IpAddress,
  IAuditEntryRepository,
  AdminRole,
} from '@csn/domain-admin';
import { MEMBER_REPOSITORY_TOKEN } from '@csn/infra-identity';
import { AUDIT_ENTRY_REPOSITORY } from '@csn/infra-admin';
import { AdminLoginCommand } from './admin-login.command';

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
    private readonly jwtService: JwtService,
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

    // Compare password against stored bcrypt hash.
    // In a full implementation, admin role would be verified from a
    // separate admin table or role field on the member.
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

    // Issue a short-lived admin JWT
    const payload = {
      sub: member.id.value,
      email: member.email.value,
      role: AdminRole.ADMIN,
      type: 'admin',
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

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
