import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { UnauthorizedException } from '@nestjs/common';
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
import { REFRESH_COOKIE_NAME } from '../utils/refresh-cookie';

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

function createMockResponse() {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as unknown as Response & { cookie: ReturnType<typeof vi.fn>; clearCookie: ReturnType<typeof vi.fn> };
}

function createMockRequest(cookieHeader?: string): Request {
  return { headers: { cookie: cookieHeader } } as unknown as Request;
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
    it('should register a new member and set the refresh_token httpOnly cookie', async () => {
      const dto: RegisterDto = Object.assign(new RegisterDto(), {
        email: 'new@example.com',
        displayName: 'New User',
        password: 'Str0ng!Pass#2024',
      });
      const expected = createMockAuthResponse();
      registerHandler.execute.mockResolvedValue(expected);
      const res = createMockResponse();

      const result = await controller.register(dto, res);

      expect(result).toBe(expected);
      expect(res.cookie).toHaveBeenCalledTimes(1);
      const [name, value, opts] = res.cookie.mock.calls[0]!;
      expect(name).toBe(REFRESH_COOKIE_NAME);
      expect(value).toBe('refresh-token-value');
      expect(opts).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
    });

    it('should propagate errors from the handler without setting a cookie', async () => {
      const dto: RegisterDto = Object.assign(new RegisterDto(), {
        email: 'dup@example.com',
        displayName: 'Dup User',
        password: 'Str0ng!Pass#2024',
      });
      registerHandler.execute.mockRejectedValue(new Error('Email exists'));
      const res = createMockResponse();

      await expect(controller.register(dto, res)).rejects.toThrow('Email exists');
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should authenticate, return tokens, and set the refresh_token cookie', async () => {
      const dto: LoginDto = Object.assign(new LoginDto(), {
        email: 'user@example.com',
        password: 'Str0ng!Pass#2024',
      });
      const expected = createMockAuthResponse();
      loginHandler.execute.mockResolvedValue(expected);
      const res = createMockResponse();

      const result = await controller.login(dto, res);

      expect(result).toBe(expected);
      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_COOKIE_NAME,
        'refresh-token-value',
        expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
      );
    });

    it('should propagate authentication errors without setting a cookie', async () => {
      const dto: LoginDto = Object.assign(new LoginDto(), {
        email: 'user@example.com',
        password: 'wrong',
      });
      loginHandler.execute.mockRejectedValue(new Error('Invalid credentials'));
      const res = createMockResponse();

      await expect(controller.login(dto, res)).rejects.toThrow('Invalid credentials');
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should read refresh token from the httpOnly cookie when present', async () => {
      const expected = createMockAuthResponse();
      refreshHandler.execute.mockResolvedValue(expected);
      const req = createMockRequest('other=foo; refresh_token=cookie-token; trailing=bar');
      const dto = new RefreshTokenDto();
      const res = createMockResponse();

      const result = await controller.refresh(req, dto, res);

      expect(result).toBe(expected);
      expect(refreshHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ refreshToken: 'cookie-token' }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_COOKIE_NAME,
        'refresh-token-value',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('should fall back to the request body refreshToken for non-browser clients', async () => {
      const expected = createMockAuthResponse();
      refreshHandler.execute.mockResolvedValue(expected);
      const req = createMockRequest();
      const dto: RefreshTokenDto = Object.assign(new RefreshTokenDto(), {
        refreshToken: 'body-token',
      });
      const res = createMockResponse();

      await controller.refresh(req, dto, res);

      expect(refreshHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ refreshToken: 'body-token' }),
      );
    });

    it('should reject with 401 when neither cookie nor body token is present', async () => {
      const req = createMockRequest();
      const dto = new RefreshTokenDto();
      const res = createMockResponse();

      await expect(controller.refresh(req, dto, res)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshHandler.execute).not.toHaveBeenCalled();
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('should propagate token validation errors from the handler', async () => {
      const req = createMockRequest('refresh_token=stale');
      const dto = new RefreshTokenDto();
      refreshHandler.execute.mockRejectedValue(new Error('Token expired'));
      const res = createMockResponse();

      await expect(controller.refresh(req, dto, res)).rejects.toThrow('Token expired');
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout and clear the refresh_token cookie', async () => {
      const user = createMockUser();
      logoutHandler.execute.mockResolvedValue(undefined);
      const res = createMockResponse();

      const result = await controller.logout(user, res);

      expect(result).toBeUndefined();
      expect(logoutHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'member-uuid-1',
          accessTokenJti: 'jti-abc-123',
        }),
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        REFRESH_COOKIE_NAME,
        expect.objectContaining({ httpOnly: true, path: '/' }),
      );
    });

    it('should propagate logout errors and not clear the cookie', async () => {
      const user = createMockUser();
      logoutHandler.execute.mockRejectedValue(new Error('Blacklist failed'));
      const res = createMockResponse();

      await expect(controller.logout(user, res)).rejects.toThrow('Blacklist failed');
      expect(res.clearCookie).not.toHaveBeenCalled();
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
      expect(getCurrentMemberHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ memberId: 'member-uuid-1' }),
      );
    });

    it('should propagate not-found errors', async () => {
      const user = createMockUser();
      getCurrentMemberHandler.execute.mockRejectedValue(new Error('Member not found'));

      await expect(controller.me(user)).rejects.toThrow('Member not found');
    });
  });
});
