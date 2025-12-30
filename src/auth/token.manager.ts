/**
 * Token Manager
 * Handles JWT access token and refresh token generation/validation
 */

import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  AccessTokenPayload,
  AuthError,
  AuthErrorCode,
  defaultAuthConfig,
  AuthConfig,
} from './auth.types';

export interface TokenManager {
  generateAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>): string;
  generateRefreshToken(): string;
  verifyAccessToken(token: string): AccessTokenPayload;
  hashToken(token: string): string;
}

export class JwtTokenManager implements TokenManager {
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly accessTokenExpiry: number;
  private readonly algorithm: jwt.Algorithm = 'RS256';

  constructor(config?: Partial<AuthConfig>) {
    this.privateKey = process.env.JWT_PRIVATE_KEY || '';
    this.publicKey = process.env.JWT_PUBLIC_KEY || '';
    this.accessTokenExpiry = config?.accessTokenExpiry ?? defaultAuthConfig.accessTokenExpiry;

    if (!this.privateKey || !this.publicKey) {
      // Fall back to HS256 with secret for development/testing
      this.algorithm = 'HS256' as jwt.Algorithm;
    }
  }

  /**
   * Generate a JWT access token
   * Time complexity: O(1)
   *
   * @param payload - Token payload with user info
   * @returns Signed JWT string
   */
  generateAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>): string {
    const secret = this.algorithm === 'RS256' ? this.privateKey : process.env.JWT_SECRET || 'fallback-secret';

    return jwt.sign(payload, secret, {
      algorithm: this.algorithm,
      expiresIn: this.accessTokenExpiry,
    });
  }

  /**
   * Generate a random refresh token (UUID v4)
   * Time complexity: O(1)
   *
   * @returns UUID string
   */
  generateRefreshToken(): string {
    return uuidv4();
  }

  /**
   * Verify and decode a JWT access token
   * Time complexity: O(1)
   *
   * @param token - JWT string to verify
   * @returns Decoded token payload
   * @throws AuthError if token is invalid or expired
   */
  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const secret = this.algorithm === 'RS256' ? this.publicKey : process.env.JWT_SECRET || 'fallback-secret';

      const decoded = jwt.verify(token, secret, {
        algorithms: [this.algorithm],
      }) as AccessTokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthError(AuthErrorCode.TOKEN_EXPIRED, 'Access token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthError(AuthErrorCode.INVALID_ACCESS_TOKEN, 'Invalid access token');
      }
      throw new AuthError(AuthErrorCode.INTERNAL_ERROR, 'Token verification failed');
    }
  }

  /**
   * Hash a token using SHA-256
   * Used for storing refresh tokens securely
   * Time complexity: O(n) where n is token length
   *
   * @param token - Token to hash
   * @returns Hexadecimal hash string
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

/**
 * Factory function to create a token manager
 */
export function createTokenManager(config?: Partial<AuthConfig>): TokenManager {
  return new JwtTokenManager(config);
}
