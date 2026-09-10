import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth.guard';

function makeContext(isPublic: boolean, authorization?: string) {
  const request: { headers: Record<string, string | undefined>; user?: unknown } = {
    headers: { authorization },
  };
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  };
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(isPublic) };
  return { request, context, reflector };
}

describe('JwtAuthGuard', () => {
  let jwt: { verifyAccessToken: ReturnType<typeof vi.fn> };
  const payload = { userId: 'u1', email: 'u@x', roles: ['member'], jti: 'j', iat: 0, exp: 0 };

  beforeEach(() => {
    // Arrange (shared)
    jwt = { verifyAccessToken: vi.fn().mockResolvedValue(payload) };
  });

  describe('protected routes', () => {
    it('should reject when the bearer token is missing', async () => {
      // Arrange
      const { context, reflector } = makeContext(false);
      const guard = new JwtAuthGuard(jwt as never, reflector as never);

      // Act + Assert
      await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should attach the verified payload as request.user', async () => {
      // Arrange
      const { request, context, reflector } = makeContext(false, 'Bearer tok');
      const guard = new JwtAuthGuard(jwt as never, reflector as never);

      // Act
      await guard.canActivate(context as never);

      // Assert
      expect(request.user).toBe(payload);
    });

    it('should reject when verification fails', async () => {
      // Arrange
      jwt.verifyAccessToken.mockRejectedValue(new Error('bad'));
      const { context, reflector } = makeContext(false, 'Bearer tok');
      const guard = new JwtAuthGuard(jwt as never, reflector as never);

      // Act + Assert
      await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('@Public routes', () => {
    it('should allow access with no token and leave request.user undefined', async () => {
      // Arrange
      const { request, context, reflector } = makeContext(true);
      const guard = new JwtAuthGuard(jwt as never, reflector as never);

      // Act
      const allowed = await guard.canActivate(context as never);

      // Assert
      expect(allowed).toBe(true);
      expect(request.user).toBeUndefined();
    });

    it('should attach request.user when a valid token is supplied', async () => {
      // Arrange
      const { request, context, reflector } = makeContext(true, 'Bearer tok');
      const guard = new JwtAuthGuard(jwt as never, reflector as never);

      // Act
      await guard.canActivate(context as never);

      // Assert
      expect(request.user).toBe(payload);
    });

    it('should still allow access when the supplied token is invalid', async () => {
      // Arrange
      jwt.verifyAccessToken.mockRejectedValue(new UnauthorizedException('expired'));
      const { request, context, reflector } = makeContext(true, 'Bearer stale');
      const guard = new JwtAuthGuard(jwt as never, reflector as never);

      // Act
      const allowed = await guard.canActivate(context as never);

      // Assert
      expect(allowed).toBe(true);
      expect(request.user).toBeUndefined();
    });
  });
});
