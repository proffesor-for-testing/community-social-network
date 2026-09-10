import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { JwtTokenService } from './jwt.service';

// ── Public decorator ─────────────────────────────────────────────────────────

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as public so that JwtAuthGuard skips authentication.
 *
 * @example
 * ```ts
 * @Public()
 * @Get('health')
 * healthCheck() { return { status: 'ok' }; }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// ── Guard ────────────────────────────────────────────────────────────────────

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if the route is decorated with @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (isPublic) {
      // Public routes never reject, but if a valid bearer token is present we
      // still attach the user so handlers can personalise the response
      // (e.g. the viewer's own reaction on a public post).
      if (token) {
        try {
          const payload = await this.jwtTokenService.verifyAccessToken(token);
          (request as Request & { user: unknown }).user = payload;
        } catch {
          // Invalid/expired token on a public route: treat as anonymous.
        }
      }
      return true;
    }

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    try {
      const payload = await this.jwtTokenService.verifyAccessToken(token);
      // Attach decoded user to request for downstream use
      (request as Request & { user: unknown }).user = payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid authentication token');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authorization = request.headers.authorization;
    if (!authorization) {
      return undefined;
    }

    const [type, token] = authorization.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
