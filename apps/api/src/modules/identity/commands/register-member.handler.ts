import { Injectable, Inject, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Member, MemberId, Credential, PlainPassword, IMemberRepository, SessionId, Session } from '@csn/domain-identity';
import { Email, Timestamp, ValidationError, ConflictError } from '@csn/domain-shared';
import { MEMBER_REPOSITORY_TOKEN, SESSION_REPOSITORY_TOKEN } from '@csn/infra-identity';
import { JwtTokenService, TokenPayload } from '@csn/infra-auth';
import type { ISessionRepository } from '@csn/domain-identity';
import { RegisterMemberCommand } from './register-member.command';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { MemberResponseDto } from '../dto/member-response.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class RegisterMemberHandler {
  constructor(
    @Inject(MEMBER_REPOSITORY_TOKEN)
    private readonly memberRepository: IMemberRepository,
    @Inject(SESSION_REPOSITORY_TOKEN)
    private readonly sessionRepository: ISessionRepository,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async execute(command: RegisterMemberCommand): Promise<AuthResponseDto> {
    // Validate password through domain value object (enforces complexity rules)
    try {
      PlainPassword.create(command.password);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    // Check for duplicate email
    const email = Email.create(command.email);
    const existing = await this.memberRepository.findByEmail(email);
    if (existing) {
      throw new ConflictException('A member with this email already exists');
    }

    // Hash password and create domain aggregate
    const hash = await bcrypt.hash(command.password, BCRYPT_ROUNDS);
    const credential = Credential.create(hash);
    const memberId = this.memberRepository.nextId();

    const member = Member.register(memberId, email, credential, command.displayName);

    // Activate member immediately (skip email verification for MVP)
    member.activate();

    // Create session
    const sessionId = this.sessionRepository.nextId();
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)); // 7 days
    const session = Session.create(sessionId, memberId, 'api', '0.0.0.0', expiresAt);

    // Record successful login on the member
    member.recordSuccessfulLogin(sessionId.value);

    // Persist
    await this.memberRepository.save(member);
    await this.sessionRepository.save(session);

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: memberId.value,
      email: email.value,
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
