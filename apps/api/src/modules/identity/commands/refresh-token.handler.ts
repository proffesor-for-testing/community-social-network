import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { IMemberRepository, ISessionRepository, MemberId, SessionId, Session } from '@csn/domain-identity';
import { Timestamp } from '@csn/domain-shared';
import { MEMBER_REPOSITORY_TOKEN, SESSION_REPOSITORY_TOKEN } from '@csn/infra-identity';
import { JwtTokenService, TokenPayload } from '@csn/infra-auth';
import { RefreshTokenCommand } from './refresh-token.command';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { MemberResponseDto } from '../dto/member-response.dto';

@Injectable()
export class RefreshTokenHandler {
  constructor(
    @Inject(MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepository: IMemberRepository,
    @Inject(SESSION_REPOSITORY_TOKEN)
    private readonly sessionRepository: ISessionRepository,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<AuthResponseDto> {
    // Verify the refresh token (checks signature, expiry, and blacklist)
    const decoded = await this.jwtTokenService.verifyRefreshToken(command.refreshToken);

    // Load the session to verify it is still valid
    const sessionId = SessionId.create(decoded.sessionId);
    const session = await this.sessionRepository.findById(sessionId);

    if (!session || !session.isValid()) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    // Load the member to verify they are still active
    const memberId = MemberId.create(decoded.userId);
    const member = await this.memberRepository.findById(memberId);

    if (!member) {
      throw new UnauthorizedException('Member not found');
    }

    if (member.status.value !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    // Revoke the old session and create a new one (rotation)
    session.revoke();
    await this.sessionRepository.save(session);

    const newSessionId = this.sessionRepository.nextId();
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const newSession = Session.create(newSessionId, memberId, session.userAgent, session.ipAddress, expiresAt);
    await this.sessionRepository.save(newSession);

    // Generate new token pair
    const tokenPayload: TokenPayload = {
      userId: member.id.value,
      email: member.email.value,
      roles: ['member'],
    };
    const tokenPair = await this.jwtTokenService.generateTokenPair(tokenPayload, newSessionId.value);

    // Build response
    const response = new AuthResponseDto();
    response.accessToken = tokenPair.accessToken;
    response.refreshToken = tokenPair.refreshToken;
    response.member = MemberResponseDto.fromDomain(member);

    return response;
  }
}
