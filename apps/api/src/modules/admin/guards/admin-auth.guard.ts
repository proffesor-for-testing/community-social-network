import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AdminRole } from '@csn/domain-admin';

/**
 * Guard that verifies the request carries a valid admin JWT.
 * This is separate from the regular user JwtAuthGuard: it checks
 * for `type === 'admin'` and a valid AdminRole in the token payload.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Admin authentication required');
    }

    try {
      const payload = this.jwtService.verify(token);

      if (payload.type !== 'admin') {
        throw new UnauthorizedException('Not an admin token');
      }

      const validRoles: string[] = Object.values(AdminRole);
      if (!validRoles.includes(payload.role)) {
        throw new UnauthorizedException('Invalid admin role');
      }

      // Attach the admin payload to the request for downstream use
      (request as Record<string, unknown>)['adminUser'] = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        twoFactorVerified: payload.twoFactorVerified ?? false,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired admin token');
    }
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
