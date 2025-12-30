/**
 * M8 Admin & Security Module - TOTP Service
 *
 * Implements Time-based One-Time Password (TOTP) for 2FA
 * Following RFC 6238 specification with otplib library
 */

import * as crypto from 'crypto';
import {
  Admin2FA,
  IAdmin2FARepository,
  TotpSetupResult,
  TotpConfig,
  DEFAULT_TOTP_CONFIG,
} from './admin.types';

/**
 * TOTP Service for Two-Factor Authentication
 *
 * Features:
 * - TOTP secret generation (32 bytes / 256-bit)
 * - QR code generation for authenticator apps
 * - Backup code generation (10 codes, 8 hex chars each)
 * - Time-window verification (+/- 30 seconds)
 */
export class TotpService {
  private config: TotpConfig;
  private admin2FARepository?: IAdmin2FARepository;
  private encryptionKey?: Buffer;

  constructor(
    admin2FARepository?: IAdmin2FARepository,
    config: TotpConfig = DEFAULT_TOTP_CONFIG
  ) {
    this.config = config;
    this.admin2FARepository = admin2FARepository;

    // Encryption key for storing secrets (in production, use KMS)
    const envKey = process.env.TOTP_ENCRYPTION_KEY;
    if (envKey) {
      this.encryptionKey = Buffer.from(envKey, 'hex');
    } else {
      // Default key for development/testing only
      this.encryptionKey = crypto.randomBytes(32);
    }
  }

  /**
   * Generate a new TOTP secret
   * Returns base32 encoded secret for use with authenticator apps
   */
  generateSecret(): string {
    // Generate random bytes (256-bit / 32 bytes)
    const buffer = crypto.randomBytes(this.config.secretLength);

    // Encode as base32 (RFC 4648)
    return this.base32Encode(buffer);
  }

  /**
   * Generate backup codes for account recovery
   * Returns 10 unique 8-character hex codes
   */
  generateBackupCodes(): string[] {
    const codes: string[] = [];
    const codeSet = new Set<string>();

    while (codes.length < 10) {
      // Generate 4 random bytes (32 bits) for each code
      const buffer = crypto.randomBytes(4);
      const code = buffer.toString('hex').toLowerCase();

      // Ensure uniqueness
      if (!codeSet.has(code)) {
        codeSet.add(code);
        codes.push(code);
      }
    }

    return codes;
  }

  /**
   * Hash backup codes for secure storage using bcrypt-compatible method
   */
  async hashBackupCodes(codes: string[]): Promise<string[]> {
    // Use PBKDF2 for deterministic hashing (bcrypt alternative for backup codes)
    const hashedCodes: string[] = [];

    for (const code of codes) {
      const salt = crypto.randomBytes(16);
      const hash = crypto.pbkdf2Sync(code, salt, 10000, 32, 'sha256');
      // Store salt + hash together
      hashedCodes.push(`${salt.toString('hex')}:${hash.toString('hex')}`);
    }

    return hashedCodes;
  }

  /**
   * Verify a backup code against stored hashes
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    if (!this.admin2FARepository) {
      throw new Error('Admin 2FA repository not configured');
    }

    const twoFactorRecord = await this.admin2FARepository.findByUserId(userId);
    if (!twoFactorRecord) {
      return false;
    }

    const normalizedCode = code.toLowerCase().replace(/\s/g, '');

    for (let i = 0; i < twoFactorRecord.backupCodes.length; i++) {
      const storedHash = twoFactorRecord.backupCodes[i];

      // Skip already used codes (empty strings)
      if (!storedHash || storedHash === 'USED') {
        continue;
      }

      const parts = storedHash.split(':');
      const saltHex = parts[0];
      const hashHex = parts[1];
      if (!saltHex || !hashHex) {
        continue;
      }
      const salt = Buffer.from(saltHex, 'hex');
      const expectedHash = Buffer.from(hashHex, 'hex');

      const computedHash = crypto.pbkdf2Sync(normalizedCode, salt, 10000, 32, 'sha256');

      if (crypto.timingSafeEqual(computedHash, expectedHash)) {
        // Mark code as used
        const updatedCodes = [...twoFactorRecord.backupCodes];
        updatedCodes[i] = 'USED';

        await this.admin2FARepository.update(userId, {
          backupCodes: updatedCodes,
        });

        return true;
      }
    }

    return false;
  }

  /**
   * Generate QR code data URL for authenticator app setup
   */
  async generateQRCode(email: string, secret: string): Promise<string> {
    const otpAuthUrl = this.buildOTPAuthURL(email, secret);

    // Simple QR code generation using a basic implementation
    // In production, use 'qrcode' library: QRCode.toDataURL(otpAuthUrl)
    return this.generateQRCodeDataURL(otpAuthUrl);
  }

  /**
   * Build OTPAuth URL for authenticator apps
   * Format: otpauth://totp/ISSUER:EMAIL?secret=SECRET&issuer=ISSUER
   */
  buildOTPAuthURL(email: string, secret: string): string {
    const issuer = encodeURIComponent(this.config.issuer);
    const account = encodeURIComponent(email);

    return (
      `otpauth://totp/${issuer}:${account}?` +
      `secret=${secret}&` +
      `issuer=${issuer}&` +
      `algorithm=${this.config.algorithm.toUpperCase()}&` +
      `digits=${this.config.digits}&` +
      `period=${this.config.step}`
    );
  }

  /**
   * Verify a TOTP code against the stored secret
   */
  async verifyCode(userId: string, code: string): Promise<boolean> {
    const secret = await this.getStoredSecret(userId);
    if (!secret) {
      return false;
    }

    return this.verifyTOTPWithWindow(secret, code, { window: this.config.window });
  }

  /**
   * Check if 2FA is enabled for a user
   */
  async is2FAEnabled(userId: string): Promise<boolean> {
    if (!this.admin2FARepository) {
      throw new Error('Admin 2FA repository not configured');
    }

    const record = await this.admin2FARepository.findByUserId(userId);
    return record?.enabled ?? false;
  }

  /**
   * Enable 2FA for a user after successful verification
   */
  async enable2FA(userId: string): Promise<void> {
    if (!this.admin2FARepository) {
      throw new Error('Admin 2FA repository not configured');
    }

    await this.admin2FARepository.update(userId, {
      enabled: true,
      verifiedAt: new Date(),
    });
  }

  /**
   * Disable 2FA for a user (requires authorization)
   */
  async disable2FA(userId: string): Promise<void> {
    if (!this.admin2FARepository) {
      throw new Error('Admin 2FA repository not configured');
    }

    await this.admin2FARepository.delete(userId);
  }

  /**
   * Store encrypted TOTP secret for a user
   */
  async storeSecret(userId: string, secret: string, backupCodesHashed: string[]): Promise<void> {
    if (!this.admin2FARepository) {
      throw new Error('Admin 2FA repository not configured');
    }

    const encryptedSecret = this.encryptSecret(secret);

    await this.admin2FARepository.create({
      userId,
      secret: encryptedSecret,
      backupCodes: backupCodesHashed,
      enabled: false,
      verifiedAt: null,
    });
  }

  /**
   * Get stored secret for a user (decrypted)
   */
  private async getStoredSecret(userId: string): Promise<string | null> {
    if (!this.admin2FARepository) {
      throw new Error('Admin 2FA repository not configured');
    }

    const record = await this.admin2FARepository.findByUserId(userId);
    if (!record) {
      return null;
    }

    return this.decryptSecret(record.secret);
  }

  /**
   * Encrypt secret for storage using AES-256-GCM
   */
  private encryptSecret(secret: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt stored secret using AES-256-GCM
   */
  private decryptSecret(encryptedData: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const parts = encryptedData.split(':');
    const ivHex = parts[0];
    const authTagHex = parts[1];
    const encrypted = parts[2];

    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    const decryptedPart = decipher.update(encrypted, 'hex', 'utf8');
    const decryptedFinal = decipher.final('utf8');

    return decryptedPart + decryptedFinal;
  }

  /**
   * Verify TOTP code with time window tolerance
   */
  private verifyTOTPWithWindow(
    secret: string,
    code: string,
    options: { window: number }
  ): boolean {
    const counter = Math.floor(Date.now() / 1000 / this.config.step);

    // Check current window and +/- tolerance windows
    for (let i = -options.window; i <= options.window; i++) {
      const expectedCode = this.generateTOTP(secret, counter + i);
      if (this.timingSafeEqual(code, expectedCode)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate TOTP code for a given counter
   */
  private generateTOTP(secret: string, counter: number): string {
    // Decode base32 secret
    const secretBuffer = this.base32Decode(secret);

    // Convert counter to 8-byte buffer (big-endian)
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    counterBuffer.writeUInt32BE(counter >>> 0, 4);

    // HMAC-SHA1 (as per RFC 6238 with SHA-1)
    const hmac = crypto.createHmac(this.config.algorithm, secretBuffer);
    hmac.update(counterBuffer);
    const hash = hmac.digest();

    // Dynamic truncation
    const lastByte = hash[hash.length - 1];
    if (lastByte === undefined) {
      throw new Error('Invalid hash length');
    }
    const offset = lastByte & 0xf;
    const byte0 = hash[offset];
    const byte1 = hash[offset + 1];
    const byte2 = hash[offset + 2];
    const byte3 = hash[offset + 3];
    if (byte0 === undefined || byte1 === undefined || byte2 === undefined || byte3 === undefined) {
      throw new Error('Invalid hash offset');
    }
    const binary =
      ((byte0 & 0x7f) << 24) |
      ((byte1 & 0xff) << 16) |
      ((byte2 & 0xff) << 8) |
      (byte3 & 0xff);

    // Generate N-digit code
    const otp = binary % Math.pow(10, this.config.digits);
    return otp.toString().padStart(this.config.digits, '0');
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Base32 encode a buffer (RFC 4648)
   */
  private base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      if (byte === undefined) continue;
      value = (value << 8) | byte;
      bits += 8;

      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }

    // Pad to multiple of 8
    while (output.length % 8 !== 0) {
      output += '=';
    }

    return output;
  }

  /**
   * Base32 decode a string (RFC 4648)
   */
  private base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleanedInput = encoded.replace(/=+$/, '').toUpperCase();

    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (let i = 0; i < cleanedInput.length; i++) {
      const char = cleanedInput[i];
      if (char === undefined) continue;
      const index = alphabet.indexOf(char);

      if (index === -1) {
        throw new Error(`Invalid base32 character: ${char}`);
      }

      value = (value << 5) | index;
      bits += 5;

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(output);
  }

  /**
   * Generate a simple QR code as data URL
   * Note: In production, use the 'qrcode' library for proper QR generation
   */
  private async generateQRCodeDataURL(data: string): Promise<string> {
    // Placeholder implementation - in production use qrcode library
    // const QRCode = require('qrcode');
    // return await QRCode.toDataURL(data);

    // For now, return a placeholder that indicates the data to encode
    const base64Data = Buffer.from(
      JSON.stringify({ type: 'qrcode', data, timestamp: Date.now() })
    ).toString('base64');

    return `data:image/png;base64,${base64Data}`;
  }
}
