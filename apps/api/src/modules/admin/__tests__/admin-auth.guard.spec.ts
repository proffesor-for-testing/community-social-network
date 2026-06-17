import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AdminAuthGuard } from '../guards/admin-auth.guard';

function ctxWith(authHeader?: string): ExecutionContext {
  const req: Record<string, unknown> = {
    headers: authHeader ? { authorization: authHeader } : {},
  };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => () => undefined,
    }),
  } as unknown as ExecutionContext;
}

function readAdminUser(ctx: ExecutionContext) {
  return (ctx.switchToHttp().getRequest() as Record<string, unknown>)['adminUser'];
}

describe('AdminAuthGuard', () => {
  let verify: ReturnType<typeof vi.fn>;
  let guard: AdminAuthGuard;

  beforeEach(() => {
    verify = vi.fn();
    guard = new AdminAuthGuard({ verifyAccessToken: verify } as never);
  });

  it('rejects requests with no Authorization header', async () => {
    await expect(guard.canActivate(ctxWith())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects requests with a malformed Authorization header', async () => {
    await expect(
      guard.canActivate(ctxWith('NotBearer xyz')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when verifyAccessToken throws', async () => {
    verify.mockRejectedValueOnce(new Error('expired'));
    await expect(
      guard.canActivate(ctxWith('Bearer some.token.value')),
    ).rejects.toThrow('Invalid or expired admin token');
  });

  it('rejects a valid token whose roles do not include "admin"', async () => {
    verify.mockResolvedValueOnce({
      userId: 'u',
      email: 'u@x.test',
      roles: ['member'],
      jti: 'j',
      iat: 1,
      exp: 2,
    });
    await expect(
      guard.canActivate(ctxWith('Bearer member.token')),
    ).rejects.toThrow('Not an admin token');
  });

  it('accepts a valid admin token and exposes adminUser on the request', async () => {
    verify.mockResolvedValueOnce({
      userId: 'admin-1',
      email: 'admin@x.test',
      roles: ['admin', 'member'],
      jti: 'j',
      iat: 1,
      exp: 2,
    });

    const ctx = ctxWith('Bearer admin.token');
    const ok = await guard.canActivate(ctx);

    expect(ok).toBe(true);
    expect(readAdminUser(ctx)).toEqual({
      id: 'admin-1',
      email: 'admin@x.test',
      role: 'admin',
      twoFactorVerified: false,
    });
  });
});
