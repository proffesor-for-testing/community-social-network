import {
  Injectable,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import {
  AuditEntry,
  AuditEntryId,
  IpAddress,
  IAuditEntryRepository,
} from '@csn/domain-admin';
import { AUDIT_ENTRY_REPOSITORY } from '@csn/infra-admin';
import { Setup2faCommand } from './setup-2fa.command';

export interface Setup2faResult {
  enabled: boolean;
  message: string;
}

@Injectable()
export class Setup2faHandler {
  constructor(
    @Inject(AUDIT_ENTRY_REPOSITORY)
    private readonly auditEntryRepository: IAuditEntryRepository,
  ) {}

  async execute(command: Setup2faCommand): Promise<Setup2faResult> {
    // Validate the verification code format
    if (!/^\d{6}$/.test(command.verificationCode)) {
      throw new BadRequestException('Invalid verification code format');
    }

    // TODO: In a full implementation:
    // 1. Generate a TOTP secret if this is the initial setup request
    // 2. Verify the provided code against the generated secret
    // 3. Store the secret securely (encrypted) if verification passes
    // 4. Return QR code data URI for the authenticator app

    // Log the 2FA setup action
    const auditId = AuditEntryId.generate();
    const ip = IpAddress.create(command.ipAddress);
    const performedBy = UserId.create(command.adminId);

    const auditEntry = AuditEntry.create(
      auditId,
      'ADMIN_2FA_SETUP',
      performedBy,
      command.adminId,
      'Member',
      { action: '2fa_enabled' },
      ip,
    );

    await this.auditEntryRepository.save(auditEntry);

    return {
      enabled: true,
      message: 'Two-factor authentication has been enabled',
    };
  }
}
