import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as bcrypt from 'bcrypt';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { Member, MemberId, Credential, Session, SessionId } from '@csn/domain-identity';
import { Email, Timestamp } from '@csn/domain-shared';
import { InMemoryMemberRepository, InMemorySessionRepository } from '@csn/infra-identity';
import { RegisterMemberHandler } from '../commands/register-member.handler';
import { RegisterMemberCommand } from '../commands/register-member.command';

// Mock bcrypt to avoid slow hashing in tests
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  hash: vi.fn(),
  compare: vi.fn(),
}));

function createMockJwtTokenService() {
  return {
    generateTokenPair: vi.fn().mockResolvedValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 900,
    }),
    generateAccessToken: vi.fn(),
    generateRefreshToken: vi.fn(),
    verifyAccessToken: vi.fn(),
    verifyRefreshToken: vi.fn(),
  };
}

describe('RegisterMemberHandler', () => {
  let memberRepository: InMemoryMemberRepository;
  let sessionRepository: InMemorySessionRepository;
  let jwtTokenService: ReturnType<typeof createMockJwtTokenService>;
  let handler: RegisterMemberHandler;

  beforeEach(() => {
    memberRepository = new InMemoryMemberRepository();
    sessionRepository = new InMemorySessionRepository();
    jwtTokenService = createMockJwtTokenService();

    handler = new RegisterMemberHandler(
      memberRepository,
      sessionRepository,
      jwtTokenService as any,
    );

    // Default: bcrypt.hash returns a fake hash
    vi.mocked(bcrypt.hash).mockResolvedValue('$2b$12$hashedpasswordvalue' as never);
  });

  it('should register a new member and return tokens', async () => {
    const command = new RegisterMemberCommand(
      'alice@example.com',
      'Alice Wonderland',
      'Str0ng!Pass#2024',
    );

    const result = await handler.execute(command);

    // Should return tokens
    expect(result.accessToken).toBe('mock-access-token');
    expect(result.refreshToken).toBe('mock-refresh-token');

    // Should return member DTO
    expect(result.member.email).toBe('alice@example.com');
    expect(result.member.displayName).toBe('Alice Wonderland');
    expect(result.member.status).toBe('ACTIVE');
    expect(result.member.id).toBeDefined();
    expect(result.member.createdAt).toBeDefined();

    // Should persist member
    expect(memberRepository.size).toBe(1);

    // Should persist session
    expect(sessionRepository.size).toBe(1);

    // Should call bcrypt.hash
    expect(bcrypt.hash).toHaveBeenCalledWith('Str0ng!Pass#2024', 12);

    // Should call jwt service with correct payload
    expect(jwtTokenService.generateTokenPair).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: expect.any(String),
        email: 'alice@example.com',
        roles: ['member'],
      }),
      expect.any(String), // sessionId
    );
  });

  it('should throw ConflictException when email already exists', async () => {
    // Pre-register a member with the same email
    const existingId = memberRepository.nextId();
    const existingMember = Member.register(
      existingId,
      Email.create('alice@example.com'),
      Credential.create('$2b$10$existinghash'),
      'Existing Alice',
    );
    await memberRepository.save(existingMember);

    const command = new RegisterMemberCommand(
      'alice@example.com',
      'Another Alice',
      'Str0ng!Pass#2024',
    );

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
    await expect(handler.execute(command)).rejects.toThrow(
      'A member with this email already exists',
    );
  });

  it('should throw BadRequestException for weak password', async () => {
    const command = new RegisterMemberCommand(
      'weak@example.com',
      'Weak User',
      'short', // Does not meet password complexity requirements
    );

    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
  });

  it('should activate member immediately after registration', async () => {
    const command = new RegisterMemberCommand(
      'active@example.com',
      'Active User',
      'Str0ng!Pass#2024',
    );

    const result = await handler.execute(command);

    expect(result.member.status).toBe('ACTIVE');
  });

  it('should create a session with correct member id', async () => {
    const command = new RegisterMemberCommand(
      'session@example.com',
      'Session User',
      'Str0ng!Pass#2024',
    );

    const result = await handler.execute(command);

    // Verify session was created
    expect(sessionRepository.size).toBe(1);

    // Verify jwt service was called with the member id
    const tokenCall = jwtTokenService.generateTokenPair.mock.calls[0];
    expect(tokenCall[0].userId).toBe(result.member.id);
  });

  it('should handle case-insensitive email matching', async () => {
    // Register with lowercase
    const command1 = new RegisterMemberCommand(
      'user@example.com',
      'User One',
      'Str0ng!Pass#2024',
    );
    await handler.execute(command1);

    // Try to register with uppercase (Email VO normalizes to lowercase)
    const command2 = new RegisterMemberCommand(
      'USER@EXAMPLE.COM',
      'User Two',
      'Str0ng!Pass#2024',
    );

    await expect(handler.execute(command2)).rejects.toThrow(ConflictException);
  });

  it('should hash password with bcrypt at 12 rounds', async () => {
    const command = new RegisterMemberCommand(
      'hash@example.com',
      'Hash User',
      'Str0ng!Pass#2024',
    );

    await handler.execute(command);

    expect(bcrypt.hash).toHaveBeenCalledWith('Str0ng!Pass#2024', 12);
  });

  it('should record a successful login on the member', async () => {
    const command = new RegisterMemberCommand(
      'login@example.com',
      'Login User',
      'Str0ng!Pass#2024',
    );

    const result = await handler.execute(command);

    // Retrieve the persisted member and check lastLoginAt
    const memberId = MemberId.create(result.member.id);
    const member = await memberRepository.findById(memberId);
    expect(member).not.toBeNull();
    expect(member!.lastLoginAt).not.toBeNull();
    expect(member!.failedLoginAttempts).toBe(0);
  });
});
