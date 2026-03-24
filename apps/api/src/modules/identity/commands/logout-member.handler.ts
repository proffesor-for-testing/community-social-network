import { Injectable, Inject } from '@nestjs/common';
import { IMemberRepository, ISessionRepository, MemberId } from '@csn/domain-identity';
import { MEMBER_REPOSITORY_TOKEN, SESSION_REPOSITORY_TOKEN } from '@csn/infra-identity';
import { TokenBlacklistService } from '@csn/infra-auth';
import { AUTH } from '@csn/domain-shared';
import { LogoutMemberCommand } from './logout-member.command';

@Injectable()
export class LogoutMemberHandler {
  constructor(
    @Inject(SESSION_REPOSITORY_TOKEN)
    private readonly sessionRepository: ISessionRepository,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {}

  async execute(command: LogoutMemberCommand): Promise<void> {
    // Blacklist the current access token
    await this.tokenBlacklistService.blacklist(
      command.accessTokenJti,
      AUTH.ACCESS_TOKEN_TTL,
    );

    // Revoke all active sessions for this user
    const memberId = MemberId.create(command.userId);
    const activeSessions = await this.sessionRepository.findActiveByMemberId(memberId);

    for (const session of activeSessions) {
      session.revoke();
      await this.sessionRepository.save(session);
    }

    // Blacklist all tracked tokens for this user (across all devices)
    await this.tokenBlacklistService.blacklistAllForUser(command.userId);
  }
}
