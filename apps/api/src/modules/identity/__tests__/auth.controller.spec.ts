import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthController } from '../controllers/auth.controller';
import { RegisterMemberHandler } from '../commands/register-member.handler';
import { LoginMemberHandler } from '../commands/login-member.handler';
import { LogoutMemberHandler } from '../commands/logout-member.handler';
import { RefreshTokenHandler } from '../commands/refresh-token.handler';
import { GetCurrentMemberHandler } from '../queries/get-current-member.handler';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { MemberResponseDto } from '../dto/member-response.dto';
import type { AccessTokenPayload } from '@csn/infra-auth';

function createMockAuthResponse(): AuthResponseDto {
  const memberDto = new MemberResponseDto();
  memberDto.id = 'member-uuid-1';
  memberDto.email = 'user@example.com';
  memberDto.displayName = 'Test User';
  memberDto.status = 'ACTIVE';
  memberDto.createdAt = '2024-01-15T10:30:00.000Z';

  const authDto = new AuthResponseDto();
  authDto.accessToken = 'access-token-value';
  authDto.refreshToken = 'refresh-token-value';
  authDto.member = memberDto;

  return authDto;
}

function createMockUser(): AccessTokenPayload {
  return {
    userId: 'member-uuid-1',
    email: 'user@example.com',
    roles: ['member'],
    jti: 'jti-abc-123',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
  };
}

describe('AuthController', () => {
  let controller: AuthController;
  let registerHandler: { execute: ReturnType<typeof vi.fn> };
  let loginHandler: { execute: ReturnType<typeof vi.fn> };
  let logoutHandler: { execute: ReturnType<typeof vi.fn> };
  let refreshHandler: { execute: ReturnType<typeof vi.fn> };
  let getCurrentMemberHandler: { execute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    registerHandler = { execute: vi.fn() };
    loginHandler = { execute: vi.fn() };
    logoutHandler = { execute: vi.fn() };
    refreshHandler = { execute: vi.fn() };
    getCurrentMemberHandler = { execute: vi.fn() };

    controller = new AuthController(
      registerHandler as unknown as RegisterMemberHandler,
      loginHandler as unknown as LoginMemberHandler,
      logoutHandler as unknown as LogoutMemberHandler,
      refreshHandler as unknown as RefreshTokenHandler,
      getCurrentMemberHandler as unknown as GetCurrentMemberHandler,
    );
  });

  describe('POST /api/auth/register', () => {
    it('should register a new member and return auth response', async () => {
      const dto: RegisterDto = Object.assign(new RegisterDto(), {
        email: 'new@example.com',
        displayName: 'New User',
        password: 'Str0ng!Pass#2024',
      });
      const expected = createMockAuthResponse();
      registerHandler.execute.mockResolvedValue(expected);

      const result = await controller.register(dto);

      expect(result).toBe(expected);
      expect(registerHandler.execute).toHaveBeenCalledTimes(1);
      expect(registerHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          displayName: 'New User',
          password: 'Str0ng!Pass#2024',
        }),
      );
    });

    it('should propagate errors from the handler', async () => {
      const dto: RegisterDto = Object.assign(new RegisterDto(), {
        email: 'dup@example.com',
        displayName: 'Dup User',
        password: 'Str0ng!Pass#2024',
      });
      registerHandler.execute.mockRejectedValue(new Error('Email exists'));

      await expect(controller.register(dto)).rejects.toThrow('Email exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should authenticate and return tokens', async () => {
      const dto: LoginDto = Object.assign(new LoginDto(), {
        email: 'user@example.com',
        password: 'Str0ng!Pass#2024',
      });
      const expected = createMockAuthResponse();
      loginHandler.execute.mockResolvedValue(expected);

      const result = await controller.login(dto);

      expect(result).toBe(expected);
      expect(loginHandler.execute).toHaveBeenCalledTimes(1);
      expect(loginHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user@example.com',
          password: 'Str0ng!Pass#2024',
        }),
      );
    });

    it('should propagate authentication errors', async () => {
      const dto: LoginDto = Object.assign(new LoginDto(), {
        email: 'user@example.com',
        password: 'wrong',
      });
      loginHandler.execute.mockRejectedValue(new Error('Invalid credentials'));

      await expect(controller.login(dto)).rejects.toThrow('Invalid credentials');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh tokens and return new auth response', async () => {
      const dto: RefreshTokenDto = Object.assign(new RefreshTokenDto(), {
        refreshToken: 'old-refresh-token',
      });
      const expected = createMockAuthResponse();
      refreshHandler.execute.mockResolvedValue(expected);

      const result = await controller.refresh(dto);

      expect(result).toBe(expected);
      expect(refreshHandler.execute).toHaveBeenCalledTimes(1);
      expect(refreshHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshToken: 'old-refresh-token',
        }),
      );
    });

    it('should propagate token validation errors', async () => {
      const dto: RefreshTokenDto = Object.assign(new RefreshTokenDto(), {
        refreshToken: 'invalid-token',
      });
      refreshHandler.execute.mockRejectedValue(new Error('Token expired'));

      await expect(controller.refresh(dto)).rejects.toThrow('Token expired');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout and return void (204)', async () => {
      const user = createMockUser();
      logoutHandler.execute.mockResolvedValue(undefined);

      const result = await controller.logout(user);

      expect(result).toBeUndefined();
      expect(logoutHandler.execute).toHaveBeenCalledTimes(1);
      expect(logoutHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'member-uuid-1',
          accessTokenJti: 'jti-abc-123',
        }),
      );
    });

    it('should propagate logout errors', async () => {
      const user = createMockUser();
      logoutHandler.execute.mockRejectedValue(new Error('Blacklist failed'));

      await expect(controller.logout(user)).rejects.toThrow('Blacklist failed');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return the current member profile', async () => {
      const user = createMockUser();
      const memberDto = new MemberResponseDto();
      memberDto.id = 'member-uuid-1';
      memberDto.email = 'user@example.com';
      memberDto.displayName = 'Test User';
      memberDto.status = 'ACTIVE';
      memberDto.createdAt = '2024-01-15T10:30:00.000Z';

      getCurrentMemberHandler.execute.mockResolvedValue(memberDto);

      const result = await controller.me(user);

      expect(result).toBe(memberDto);
      expect(getCurrentMemberHandler.execute).toHaveBeenCalledTimes(1);
      expect(getCurrentMemberHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: 'member-uuid-1',
        }),
      );
    });

    it('should propagate not-found errors', async () => {
      const user = createMockUser();
      getCurrentMemberHandler.execute.mockRejectedValue(new Error('Member not found'));

      await expect(controller.me(user)).rejects.toThrow('Member not found');
    });
  });
});
