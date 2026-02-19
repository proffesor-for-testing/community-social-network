import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import jwtConfig from './jwt.config';
import { TokenBlacklistService } from './token-blacklist.service';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
}

export interface AccessTokenPayload extends TokenPayload {
  jti: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a TTL string (e.g. '15m', '7d', '1h') to seconds.
 */
function ttlToSeconds(ttl: string): number {
  const match = ttl.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid TTL format: ${ttl}. Expected format like '15m', '7d', '1h'.`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      throw new Error(`Unknown TTL unit: ${unit}`);
  }
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class JwtTokenService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  constructor(
    @Inject(jwtConfig.KEY)
    private readonly config: ConfigType<typeof jwtConfig>,
    private readonly nestJwtService: NestJwtService,
    private readonly blacklistService: TokenBlacklistService,
  ) {
    this.accessTtlSeconds = ttlToSeconds(this.config.accessTtl);
    this.refreshTtlSeconds = ttlToSeconds(this.config.refreshTtl);
  }

  /**
   * Generate a short-lived access token containing user claims.
   */
  async generateAccessToken(payload: TokenPayload): Promise<string> {
    const jti = randomUUID();

    const token = this.nestJwtService.sign(
      {
        sub: payload.userId,
        email: payload.email,
        roles: payload.roles,
        jti,
      },
      {
        secret: this.config.accessSecret,
        expiresIn: this.config.accessTtl,
        issuer: this.config.issuer,
        audience: this.config.audience,
      },
    );

    // Track token for per-user revocation
    await this.blacklistService.trackToken(
      payload.userId,
      jti,
      this.accessTtlSeconds,
    );

    return token;
  }

  /**
   * Generate a long-lived refresh token tied to a session.
   */
  async generateRefreshToken(userId: string, sessionId: string): Promise<string> {
    const jti = randomUUID();

    const token = this.nestJwtService.sign(
      {
        sub: userId,
        sessionId,
        jti,
      },
      {
        secret: this.config.refreshSecret,
        expiresIn: this.config.refreshTtl,
        issuer: this.config.issuer,
      },
    );

    // Track token for per-user revocation
    await this.blacklistService.trackToken(userId, jti, this.refreshTtlSeconds);

    return token;
  }

  /**
   * Verify an access token: signature, expiry, issuer, audience, and blacklist.
   */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    let decoded: Record<string, unknown>;

    try {
      decoded = this.nestJwtService.verify(token, {
        secret: this.config.accessSecret,
        issuer: this.config.issuer,
        audience: this.config.audience,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.name === 'TokenExpiredError'
          ? 'Access token has expired'
          : 'Invalid access token';
      throw new UnauthorizedException(message);
    }

    const jti = decoded.jti as string;
    if (!jti) {
      throw new UnauthorizedException('Access token missing jti claim');
    }

    const isBlacklisted = await this.blacklistService.isBlacklisted(jti);
    if (isBlacklisted) {
      throw new UnauthorizedException('Access token has been revoked');
    }

    return {
      userId: decoded.sub as string,
      email: decoded.email as string,
      roles: decoded.roles as string[],
      jti,
      iat: decoded.iat as number,
      exp: decoded.exp as number,
    };
  }

  /**
   * Verify a refresh token: signature, expiry, and blacklist.
   */
  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    let decoded: Record<string, unknown>;

    try {
      decoded = this.nestJwtService.verify(token, {
        secret: this.config.refreshSecret,
        issuer: this.config.issuer,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error && error.name === 'TokenExpiredError'
          ? 'Refresh token has expired'
          : 'Invalid refresh token';
      throw new UnauthorizedException(message);
    }

    const jti = decoded.jti as string;
    if (!jti) {
      throw new UnauthorizedException('Refresh token missing jti claim');
    }

    const isBlacklisted = await this.blacklistService.isBlacklisted(jti);
    if (isBlacklisted) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    return {
      userId: decoded.sub as string,
      sessionId: decoded.sessionId as string,
      jti,
      iat: decoded.iat as number,
      exp: decoded.exp as number,
    };
  }

  /**
   * Generate both access and refresh tokens as a pair.
   */
  async generateTokenPair(payload: TokenPayload, sessionId: string): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(payload),
      this.generateRefreshToken(payload.userId, sessionId),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTtlSeconds,
    };
  }
}
