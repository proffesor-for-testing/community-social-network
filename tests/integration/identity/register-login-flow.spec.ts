/**
 * Integration Test: Identity - Register / Login / Me / Refresh / Logout
 *
 * Exercises the full authentication lifecycle through the real command
 * handlers wired to in-memory repositories. Handlers are instantiated
 * directly with their dependencies to avoid NestJS DI class-token
 * resolution issues in the vitest environment.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ConflictException, UnauthorizedException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

// ── Handlers ────────────────────────────────────────────────────────────────

import { RegisterMemberHandler } from '../../../apps/api/src/modules/identity/commands/register-member.handler';
import { RegisterMemberCommand } from '../../../apps/api/src/modules/identity/commands/register-member.command';
import { LoginMemberHandler } from '../../../apps/api/src/modules/identity/commands/login-member.handler';
import { LoginMemberCommand } from '../../../apps/api/src/modules/identity/commands/login-member.command';
import { LogoutMemberHandler } from '../../../apps/api/src/modules/identity/commands/logout-member.handler';
import { LogoutMemberCommand } from '../../../apps/api/src/modules/identity/commands/logout-member.command';
import { RefreshTokenHandler } from '../../../apps/api/src/modules/identity/commands/refresh-token.handler';
import { RefreshTokenCommand } from '../../../apps/api/src/modules/identity/commands/refresh-token.command';
import { GetCurrentMemberHandler } from '../../../apps/api/src/modules/identity/queries/get-current-member.handler';
import { GetCurrentMemberQuery } from '../../../apps/api/src/modules/identity/queries/get-current-member.query';

// ── Test infrastructure ─────────────────────────────────────────────────────

import {
  createTestRepositories,
  TestRepositories,
  MockJwtTokenService,
  MockTokenBlacklistService,
} from '../../setup/test-app';

describe('Identity: Register / Login / Me / Refresh / Logout flow', () => {
  let repos: TestRepositories;
  let mockJwt: MockJwtTokenService;
  let mockBlacklist: MockTokenBlacklistService;

  let registerHandler: RegisterMemberHandler;
  let loginHandler: LoginMemberHandler;
  let logoutHandler: LogoutMemberHandler;
  let refreshHandler: RefreshTokenHandler;
  let getMeHandler: GetCurrentMemberHandler;

  beforeEach(() => {
    repos = createTestRepositories();
    mockJwt = new MockJwtTokenService();
    mockBlacklist = new MockTokenBlacklistService();

    // Directly construct handlers with their dependencies to avoid NestJS
    // DI class token issues in vitest (class identity can differ across
    // vitest's module graph).
    registerHandler = new RegisterMemberHandler(
      repos.memberRepo,
      repos.sessionRepo,
      mockJwt as any,
    );
    loginHandler = new LoginMemberHandler(
      repos.memberRepo,
      repos.sessionRepo,
      mockJwt as any,
    );
    logoutHandler = new LogoutMemberHandler(
      repos.sessionRepo,
      mockBlacklist as any,
    );
    refreshHandler = new RefreshTokenHandler(
      repos.memberRepo,
      repos.sessionRepo,
      mockJwt as any,
    );
    getMeHandler = new GetCurrentMemberHandler(repos.memberRepo);
  });

  // ── Step 1: Register ────────────────────────────────────────────────────

  it('should register a new member and return tokens', async () => {
    const command = new RegisterMemberCommand(
      'alice@test.com',
      'Alice Tester',
      'Str0ng!Pass#2024',
    );

    const result = await registerHandler.execute(command);

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.member).toBeDefined();
    expect(result.member.email).toBe('alice@test.com');
    expect(result.member.displayName).toBe('Alice Tester');
    expect(result.member.status).toBe('ACTIVE');

    // Verify member persisted
    expect(repos.memberRepo.size).toBe(1);
    // Verify session created
    expect(repos.sessionRepo.size).toBe(1);
  });

  // ── Step 2: Duplicate registration ──────────────────────────────────────

  it('should reject duplicate email registration', async () => {
    const command = new RegisterMemberCommand(
      'dup@test.com',
      'User One',
      'Str0ng!Pass#2024',
    );

    await registerHandler.execute(command);

    const duplicate = new RegisterMemberCommand(
      'dup@test.com',
      'User Two',
      'An0ther!P@ss#2024',
    );

    await expect(registerHandler.execute(duplicate)).rejects.toThrow(ConflictException);
  });

  // ── Step 3: Login ───────────────────────────────────────────────────────

  it('should login with registered credentials and return tokens', async () => {
    // Register first
    const regCommand = new RegisterMemberCommand(
      'bob@test.com',
      'Bob Tester',
      'Str0ng!Pass#2024',
    );
    await registerHandler.execute(regCommand);

    // Login
    const loginCommand = new LoginMemberCommand('bob@test.com', 'Str0ng!Pass#2024');
    const loginResult = await loginHandler.execute(loginCommand);

    expect(loginResult.accessToken).toBeDefined();
    expect(loginResult.refreshToken).toBeDefined();
    expect(loginResult.member.email).toBe('bob@test.com');
    expect(loginResult.member.status).toBe('ACTIVE');
  });

  // ── Step 4: Login with wrong password ───────────────────────────────────

  it('should reject login with wrong password', async () => {
    const regCommand = new RegisterMemberCommand(
      'carol@test.com',
      'Carol Tester',
      'Str0ng!Pass#2024',
    );
    await registerHandler.execute(regCommand);

    const loginCommand = new LoginMemberCommand('carol@test.com', 'WrongP@ss1234');
    await expect(loginHandler.execute(loginCommand)).rejects.toThrow(UnauthorizedException);
  });

  // ── Step 5: Login with non-existent email ───────────────────────────────

  it('should reject login with non-existent email', async () => {
    const loginCommand = new LoginMemberCommand('nobody@test.com', 'Str0ng!Pass#2024');
    await expect(loginHandler.execute(loginCommand)).rejects.toThrow(UnauthorizedException);
  });

  // ── Step 6: Get Current Member (me) ─────────────────────────────────────

  it('should return current member details', async () => {
    const regResult = await registerHandler.execute(
      new RegisterMemberCommand('dave@test.com', 'Dave Tester', 'Str0ng!Pass#2024'),
    );

    const query = new GetCurrentMemberQuery(regResult.member.id);
    const meResult = await getMeHandler.execute(query);

    expect(meResult.id).toBe(regResult.member.id);
    expect(meResult.email).toBe('dave@test.com');
    expect(meResult.displayName).toBe('Dave Tester');
  });

  // ── Step 7: Get non-existent member ─────────────────────────────────────

  it('should throw NotFoundException for non-existent member', async () => {
    const query = new GetCurrentMemberQuery('00000000-0000-0000-0000-000000000000');
    await expect(getMeHandler.execute(query)).rejects.toThrow(NotFoundException);
  });

  // ── Step 8: Refresh Token ───────────────────────────────────────────────

  it('should refresh tokens successfully', async () => {
    const regResult = await registerHandler.execute(
      new RegisterMemberCommand('eve@test.com', 'Eve Tester', 'Str0ng!Pass#2024'),
    );

    const refreshCommand = new RefreshTokenCommand(regResult.refreshToken);
    const refreshResult = await refreshHandler.execute(refreshCommand);

    expect(refreshResult.accessToken).toBeDefined();
    expect(refreshResult.refreshToken).toBeDefined();
    expect(refreshResult.member.email).toBe('eve@test.com');

    // Old session revoked + new session created = 2
    expect(repos.sessionRepo.size).toBe(2);
  });

  // ── Step 9: Logout ──────────────────────────────────────────────────────

  it('should logout and invalidate tokens', async () => {
    const regResult = await registerHandler.execute(
      new RegisterMemberCommand('frank@test.com', 'Frank Tester', 'Str0ng!Pass#2024'),
    );

    // Decode the access token to get the jti
    const decoded = await mockJwt.verifyAccessToken(regResult.accessToken);

    const logoutCommand = new LogoutMemberCommand(
      regResult.member.id,
      decoded.jti,
    );

    await logoutHandler.execute(logoutCommand);

    // Verify that the blacklist service was called
    const isBlacklisted = await mockBlacklist.isBlacklisted(decoded.jti);
    expect(isBlacklisted).toBe(true);
  });

  // ── Step 10: Full end-to-end flow ───────────────────────────────────────

  it('should complete full register -> login -> me -> logout flow', async () => {
    // 1. Register
    const regResult = await registerHandler.execute(
      new RegisterMemberCommand('grace@test.com', 'Grace Tester', 'Str0ng!Pass#2024'),
    );
    expect(regResult.member.status).toBe('ACTIVE');

    // 2. Login (fresh session)
    const loginResult = await loginHandler.execute(
      new LoginMemberCommand('grace@test.com', 'Str0ng!Pass#2024'),
    );
    expect(loginResult.member.email).toBe('grace@test.com');

    // 3. Get current member
    const meResult = await getMeHandler.execute(
      new GetCurrentMemberQuery(loginResult.member.id),
    );
    expect(meResult.displayName).toBe('Grace Tester');

    // 4. Logout
    const decoded = await mockJwt.verifyAccessToken(loginResult.accessToken);
    await logoutHandler.execute(
      new LogoutMemberCommand(loginResult.member.id, decoded.jti),
    );

    // Token should be blacklisted
    expect(await mockBlacklist.isBlacklisted(decoded.jti)).toBe(true);
  });

  // ── Step 11: Weak password validation ───────────────────────────────────

  it('should reject registration with weak password', async () => {
    const command = new RegisterMemberCommand(
      'weak@test.com',
      'Weak User',
      'short',
    );

    await expect(registerHandler.execute(command)).rejects.toThrow(BadRequestException);
  });
});
