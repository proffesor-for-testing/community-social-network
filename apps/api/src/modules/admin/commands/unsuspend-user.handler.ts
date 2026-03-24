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
import { UnsuspendUserCommand } from './unsuspend-user.command';
import { AdminUserResponseDto } from '../dto/admin-response.dto';

@Injectable()
export class UnsuspendUserHandler {
  constructor(
    @Inject(MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepository: IMemberRepository,
    @Inject(AUDIT_ENTRY_REPOSITORY)
    private readonly auditEntryRepository: IAuditEntryRepository,
  ) {}

  async execute(command: UnsuspendUserCommand): Promise<AdminUserResponseDto> {
    const memberId = MemberId.create(command.targetUserId);
    const member = await this.memberRepository.findById(memberId);

    if (!member) {
      throw new NotFoundException(
        `Member with id ${command.targetUserId} not found`,
      );
    }

    // unlock() transitions SUSPENDED -> ACTIVE (and LOCKED -> ACTIVE)
    try {
      member.unlock();
    } catch (error) {
      throw new ConflictException(
        `Cannot unsuspend member: ${(error as Error).message}`,
      );
    }

    await this.memberRepository.save(member);

    // Create audit log entry
    const auditId = AuditEntryId.generate();
    const ip = IpAddress.create(command.ipAddress);
    const performedBy = UserId.create(command.adminId);

    const auditEntry = AuditEntry.create(
      auditId,
      'UNSUSPEND_USER',
      performedBy,
      command.targetUserId,
      'Member',
      {},
      ip,
    );

    await this.auditEntryRepository.save(auditEntry);

    return AdminUserResponseDto.fromDomain(member);
  }
}
