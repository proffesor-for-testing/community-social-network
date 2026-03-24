import { Injectable, Inject, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Member, IMemberRepository, ISessionRepository, Session, SessionId } from '@csn/domain-identity';
import { Email, Timestamp } from '@csn/domain-shared';
import { MEMBER_REPOSITORY_TOKEN, SESSION_REPOSITORY_TOKEN } from '@csn/infra-identity';
import { JwtTokenService, TokenPayload } from '@csn/infra-auth';
import { LoginMemberCommand } from './login-member.command';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { MemberResponseDto } from '../dto/member-response.dto';

@Injectable()
export class LoginMemberHandler {
  constructor(
    @Inject(MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepository: IMemberRepository,
    @Inject(SESSION_REPOSITORY_TOKEN)
    private readonly sessionRepository: ISessionRepository,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async execute(command: LoginMemberCommand): Promise<AuthResponseDto> {
    const email = Email.create(command.email);
    const member = await this.memberRepository.findByEmail(email);

    if (!member) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check account status
    if (member.status.value === 'LOCKED') {
      throw new ForbiddenException('Account is locked due to too many failed login attempts');
    }

    if (member.status.value === 'SUSPENDED') {
      throw new ForbiddenException('Account is suspended');
    }

    if (member.status.value === 'DEACTIVATED') {
      throw new ForbiddenException('Account has been deactivated');
    }

    // Verify password against stored hash
    const isValid = await bcrypt.compare(command.password, member.credential.value);

    if (!isValid) {
      member.recordFailedLogin();
      await this.memberRepository.save(member);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Create session
    const sessionId = this.sessionRepository.nextId();
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // 7 days
    const session = Session.create(sessionId, member.id, 'api', '0.0.0.0', expiresAt);

    // Record successful login
    member.recordSuccessfulLogin(sessionId.value);

    // Persist
    await this.memberRepository.save(member);
    await this.sessionRepository.save(session);

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: member.id.value,
      email: member.email.value,
      roles: ['member'],
    };
    const tokenPair = await this.jwtTokenService.generateTokenPair(tokenPayload, sessionId.value);

    // Build response
    const response = new AuthResponseDto();
    response.accessToken = tokenPair.accessToken;
    response.refreshToken = tokenPair.refreshToken;
    response.member = MemberResponseDto.fromDomain(member);

    return response;
  }
}
