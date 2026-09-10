import { Injectable, Inject, NotFoundException } from '@nestjs/common';
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
import { PromoteUserCommand } from './promote-user.command';
import { AdminUserResponseDto } from '../dto/admin-response.dto';

@Injectable()
export class PromoteUserHandler {
  constructor(
    @Inject(MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepository: IMemberRepository,
    @Inject(AUDIT_ENTRY_REPOSITORY)
    private readonly auditEntryRepository: IAuditEntryRepository,
  ) {}

  async execute(command: PromoteUserCommand): Promise<AdminUserResponseDto> {
    const memberId = MemberId.create(command.targetUserId);
    const member = await this.memberRepository.findById(memberId);

    if (!member) {
      throw new NotFoundException(
        `Member with id ${command.targetUserId} not found`,
      );
    }

    // promoteToAdmin() is idempotent, so re-promoting an admin is a no-op.
    member.promoteToAdmin(command.adminId);
    await this.memberRepository.save(member);

    const auditEntry = AuditEntry.create(
      AuditEntryId.generate(),
      'PROMOTE_USER',
      UserId.create(command.adminId),
      command.targetUserId,
      'Member',
      {},
      IpAddress.create(command.ipAddress),
    );
    await this.auditEntryRepository.save(auditEntry);

    return AdminUserResponseDto.fromDomain(member);
  }
}
