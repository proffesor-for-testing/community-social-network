import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
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
import { DemoteUserCommand } from './demote-user.command';
import { AdminUserResponseDto } from '../dto/admin-response.dto';

@Injectable()
export class DemoteUserHandler {
  constructor(
    @Inject(MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepository: IMemberRepository,
    @Inject(AUDIT_ENTRY_REPOSITORY)
    private readonly auditEntryRepository: IAuditEntryRepository,
  ) {}

  async execute(command: DemoteUserCommand): Promise<AdminUserResponseDto> {
    if (command.adminId === command.targetUserId) {
      throw new ForbiddenException('An admin cannot demote themselves');
    }

    const memberId = MemberId.create(command.targetUserId);
    const member = await this.memberRepository.findById(memberId);

    if (!member) {
      throw new NotFoundException(
        `Member with id ${command.targetUserId} not found`,
      );
    }

    // demoteFromAdmin() is idempotent, so demoting a non-admin is a no-op.
    member.demoteFromAdmin(command.adminId);
    await this.memberRepository.save(member);

    const auditEntry = AuditEntry.create(
      AuditEntryId.generate(),
      'DEMOTE_USER',
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
