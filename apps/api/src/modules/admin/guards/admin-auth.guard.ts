import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtTokenService } from '@csn/infra-auth';

/**
 * Guard for admin-only routes. Verifies the request's Bearer token via the
 * canonical JwtTokenService (same path used by the global JwtAuthGuard) and
 * requires `roles` to include `'admin'`.
 *
 * Populates `request.adminUser = { id, email, role, twoFactorVerified }` so
 * controllers can read the verified identity without re-decoding.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly jwtTokenService: JwtTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Admin authentication required');
    }

    let payload;
    try {
      payload = await this.jwtTokenService.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired admin token');
    }

    if (!Array.isArray(payload.roles) || !payload.roles.includes('admin')) {
      throw new UnauthorizedException('Not an admin token');
    }

    (request as unknown as Record<string, unknown>)['adminUser'] = {
      id: payload.userId,
      email: payload.email,
      role: 'admin',
      twoFactorVerified: false,
    };

    return true;
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return null;
    }
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return null;
    }
    return token;
  }
}
