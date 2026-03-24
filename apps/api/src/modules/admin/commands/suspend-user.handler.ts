import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { UserId } from '@csn/domain-shared';
import { IMemberRepository, MemberId } from '@csn/domain-identity';
import {
  AuditEntry,
  AuditEntryId,
  IpAddress,
  IAuditEntryRepository,
} from '@csn/domain-admin';
import { MEMBER_REPOSITORY_TOKEN } from '@csn/infra-identity';
import { AUDIT_ENTRY_REPOSITORY } from '@csn/infra-admin';
import { SuspendUserCommand } from './suspend-user.command';
import { AdminUserResponseDto } from '../dto/admin-response.dto';

@Injectable()
export class SuspendUserHandler {
  constructor(
    @Inject(MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepository: IMemberRepository,
    @Inject(AUDIT_ENTRY_REPOSITORY)
    private readonly auditEntryRepository: IAuditEntryRepository,
  ) {}

  async execute(command: SuspendUserCommand): Promise<AdminUserResponseDto> {
    const memberId = MemberId.create(command.targetUserId);
    const member = await this.memberRepository.findById(memberId);

    if (!member) {
      throw new NotFoundException(
        `Member with id ${command.targetUserId} not found`,
      );
    }

    try {
      member.suspend(command.reason, command.adminId);
    } catch (error) {
      throw new ConflictException(
        `Cannot suspend member: ${(error as Error).message}`,
      );
    }

    await this.memberRepository.save(member);

    // Create audit log entry
    const auditId = AuditEntryId.generate();
    const ip = IpAddress.create(command.ipAddress);
    const performedBy = UserId.create(command.adminId);

    const auditEntry = AuditEntry.create(
      auditId,
      'SUSPEND_USER',
      performedBy,
      command.targetUserId,
      'Member',
      { reason: command.reason },
      ip,
    );

    await this.auditEntryRepository.save(auditEntry);

    return AdminUserResponseDto.fromDomain(member);
  }
}
