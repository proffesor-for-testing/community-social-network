/**
 * Password Hasher
 * Handles secure password hashing using bcrypt
 */

import * as bcrypt from 'bcrypt';
import { defaultAuthConfig, AuthConfig } from './auth.types';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export class BcryptPasswordHasher implements PasswordHasher {
  private readonly rounds: number;

  constructor(config: Partial<AuthConfig> = {}) {
    this.rounds = config.bcryptRounds ?? defaultAuthConfig.bcryptRounds;
  }

  /**
   * Hash a password using bcrypt
   * Time complexity: O(2^rounds) - intentionally slow
   *
   * @param password - Plain text password to hash
   * @returns Hashed password string
   */
  async hash(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(this.rounds);
    return bcrypt.hash(password, salt);
  }

  /**
   * Verify a password against a hash
   * Uses constant-time comparison to prevent timing attacks
   *
   * @param password - Plain text password to verify
   * @param hash - Stored password hash
   * @returns True if password matches, false otherwise
   */
  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

/**
 * Factory function to create a password hasher
 */
export function createPasswordHasher(config?: Partial<AuthConfig>): PasswordHasher {
  return new BcryptPasswordHasher(config);
}
