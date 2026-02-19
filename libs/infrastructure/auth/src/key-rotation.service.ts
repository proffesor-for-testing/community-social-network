import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Redis } from 'ioredis';
import { randomBytes, randomUUID } from 'crypto';
import jwtConfig from './jwt.config';
import { REDIS_CLIENT } from './token-blacklist.service';

/** Redis key for the current active key ID. */
const CURRENT_KEY_ID_KEY = 'auth:keys:current';

/** Redis key for the previous key ID (grace period). */
const PREVIOUS_KEY_ID_KEY = 'auth:keys:previous';

/** Redis key prefix for key material storage. */
const KEY_MATERIAL_PREFIX = 'auth:keys:';

/**
 * Grace period (in seconds) during which the previous signing key
 * remains valid for verification. Set to 1 hour to cover the maximum
 * access token lifetime (15 min) with generous margin.
 */
const GRACE_PERIOD_SECONDS = 3600;

/**
 * TTL for key material in Redis. Keys are kept for 24 hours to handle
 * any verification needs during and after rotation.
 */
const KEY_MATERIAL_TTL_SECONDS = 86400;

@Injectable()
export class KeyRotationService implements OnModuleInit {
  private readonly logger = new Logger(KeyRotationService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(jwtConfig.KEY)
    private readonly config: ConfigType<typeof jwtConfig>,
  ) {}

  /**
   * On module initialization, ensure a signing key exists in Redis.
   * If no key is found (first startup), generate an initial key.
   */
  async onModuleInit(): Promise<void> {
    const currentKeyId = await this.redis.get(CURRENT_KEY_ID_KEY);
    if (!currentKeyId) {
      this.logger.log('No signing key found in Redis, generating initial key');
      await this.generateAndStoreKey();
    }
  }

  /**
   * Get the current active key ID used for signing new tokens.
   */
  async getCurrentKeyId(): Promise<string> {
    const keyId = await this.redis.get(CURRENT_KEY_ID_KEY);
    if (!keyId) {
      // Fallback: generate a key if none exists
      return this.generateAndStoreKey();
    }
    return keyId;
  }

  /**
   * Get the signing key material for a given key ID.
   * If no keyId is provided, returns the current signing key.
   *
   * Note: In production, this would retrieve keys from a secrets manager
   * (e.g., AWS Secrets Manager, HashiCorp Vault). This Redis-based
   * implementation provides the same interface for future replacement.
   */
  async getSigningKey(keyId?: string): Promise<string> {
    const resolvedKeyId = keyId || (await this.getCurrentKeyId());
    const key = await this.redis.get(`${KEY_MATERIAL_PREFIX}${resolvedKeyId}`);

    if (!key) {
      this.logger.warn(`Signing key not found for keyId=${resolvedKeyId}, falling back to config`);
      return this.config.accessSecret;
    }

    return key;
  }

  /**
   * Rotate the signing key. Generates a new key, stores it in Redis,
   * and moves the current key to "previous" for the grace period.
   *
   * During the grace period, both the current and previous keys are
   * accepted for token verification, ensuring zero-downtime rotation.
   */
  async rotateKey(): Promise<void> {
    const currentKeyId = await this.redis.get(CURRENT_KEY_ID_KEY);

    // Move current key to previous (grace period)
    if (currentKeyId) {
      await this.redis.set(PREVIOUS_KEY_ID_KEY, currentKeyId, 'EX', GRACE_PERIOD_SECONDS);
      this.logger.log(
        `Moved key=${currentKeyId} to previous with grace period=${GRACE_PERIOD_SECONDS}s`,
      );
    }

    // Generate and store the new key
    const newKeyId = await this.generateAndStoreKey();
    this.logger.log(`Key rotation complete. New key=${newKeyId}`);
  }

  /**
   * Get all keys that should be accepted for token verification.
   * Returns the current key plus any previous key still in its grace period.
   */
  async getVerificationKeys(): Promise<string[]> {
    const keys: string[] = [];

    // Current key
    const currentKeyId = await this.redis.get(CURRENT_KEY_ID_KEY);
    if (currentKeyId) {
      const currentKey = await this.redis.get(`${KEY_MATERIAL_PREFIX}${currentKeyId}`);
      if (currentKey) {
        keys.push(currentKey);
      }
    }

    // Previous key (grace period)
    const previousKeyId = await this.redis.get(PREVIOUS_KEY_ID_KEY);
    if (previousKeyId && previousKeyId !== currentKeyId) {
      const previousKey = await this.redis.get(`${KEY_MATERIAL_PREFIX}${previousKeyId}`);
      if (previousKey) {
        keys.push(previousKey);
      }
    }

    // Fallback to config secret if no keys found in Redis
    if (keys.length === 0) {
      keys.push(this.config.accessSecret);
    }

    return keys;
  }

  /**
   * Generate a new signing key and store it in Redis.
   * Returns the new key ID.
   */
  private async generateAndStoreKey(): Promise<string> {
    const keyId = `key-${randomUUID()}`;
    const keyMaterial = randomBytes(64).toString('hex');

    // Store the key material with TTL
    await this.redis.set(
      `${KEY_MATERIAL_PREFIX}${keyId}`,
      keyMaterial,
      'EX',
      KEY_MATERIAL_TTL_SECONDS,
    );

    // Set as current key (no TTL - current key persists until rotated)
    await this.redis.set(CURRENT_KEY_ID_KEY, keyId);

    this.logger.log(`Generated new signing key: ${keyId}`);
    return keyId;
  }
}
