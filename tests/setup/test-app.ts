/**
 * Test Application Factory
 *
 * Builds a NestJS Test Module that mirrors the real AppModule but substitutes
 * all PostgreSQL / Redis / Bull dependencies with in-memory implementations.
 *
 * This allows full integration tests (controller -> handler -> repository -> domain)
 * without any external infrastructure.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';

// ── In-memory repositories ──────────────────────────────────────────────────

import { InMemoryMemberRepository, InMemorySessionRepository } from '@csn/infra-identity';
import { InMemoryProfileRepository } from '@csn/infra-profile';
import { InMemoryPublicationRepository, InMemoryDiscussionRepository } from '@csn/infra-content';
import { InMemoryConnectionRepository, InMemoryBlockRepository } from '@csn/infra-social-graph';
import { InMemoryGroupRepository, InMemoryMembershipRepository } from '@csn/infra-community';
import { InMemoryAlertRepository, InMemoryPreferenceRepository } from '@csn/infra-notification';
import { InMemoryAuditEntryRepository } from '@csn/infra-admin';

// ── Repository tokens ───────────────────────────────────────────────────────

import { MEMBER_REPOSITORY_TOKEN, SESSION_REPOSITORY_TOKEN } from '@csn/infra-identity';
import { ALERT_REPOSITORY_TOKEN, PREFERENCE_REPOSITORY_TOKEN } from '@csn/infra-notification';
import { GROUP_REPOSITORY, MEMBERSHIP_REPOSITORY } from '@csn/infra-community';
import { AUDIT_ENTRY_REPOSITORY } from '@csn/infra-admin';

// ── Auth tokens ─────────────────────────────────────────────────────────────

const PUBLICATION_REPOSITORY_TOKEN = 'IPublicationRepository';
const DISCUSSION_REPOSITORY_TOKEN = 'IDiscussionRepository';
const CONNECTION_REPOSITORY_TOKEN = 'IConnectionRepository';
const BLOCK_REPOSITORY_TOKEN = 'IBlockRepository';
const PROFILE_REPOSITORY_TOKEN = 'IProfileRepository';

// ── Repository instances (shared across a test run so assertions can inspect them) ──

export interface TestRepositories {
  memberRepo: InMemoryMemberRepository;
  sessionRepo: InMemorySessionRepository;
  profileRepo: InMemoryProfileRepository;
  publicationRepo: InMemoryPublicationRepository;
  discussionRepo: InMemoryDiscussionRepository;
  connectionRepo: InMemoryConnectionRepository;
  blockRepo: InMemoryBlockRepository;
  groupRepo: InMemoryGroupRepository;
  membershipRepo: InMemoryMembershipRepository;
  alertRepo: InMemoryAlertRepository;
  preferenceRepo: InMemoryPreferenceRepository;
  auditEntryRepo: InMemoryAuditEntryRepository;
}

export function createTestRepositories(): TestRepositories {
  return {
    memberRepo: new InMemoryMemberRepository(),
    sessionRepo: new InMemorySessionRepository(),
    profileRepo: new InMemoryProfileRepository(),
    publicationRepo: new InMemoryPublicationRepository(),
    discussionRepo: new InMemoryDiscussionRepository(),
    connectionRepo: new InMemoryConnectionRepository(),
    blockRepo: new InMemoryBlockRepository(),
    groupRepo: new InMemoryGroupRepository(),
    membershipRepo: new InMemoryMembershipRepository(),
    alertRepo: new InMemoryAlertRepository(),
    preferenceRepo: new InMemoryPreferenceRepository(),
    auditEntryRepo: new InMemoryAuditEntryRepository(),
  };
}

// ── Mock JwtTokenService ────────────────────────────────────────────────────

import { randomUUID } from 'crypto';

/**
 * Lightweight mock for JwtTokenService that issues predictable tokens
 * (just JSON-encoded payloads) so integration tests can authenticate
 * without real JWT signing.
 */
export class MockJwtTokenService {
  async generateAccessToken(payload: { userId: string; email: string; roles: string[] }) {
    const jti = randomUUID();
    // Return a base64-encoded JSON string so it can be "verified" later
    const tokenData = {
      sub: payload.userId,
      email: payload.email,
      roles: payload.roles,
      jti,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    };
    return Buffer.from(JSON.stringify(tokenData)).toString('base64');
  }

  async generateRefreshToken(userId: string, sessionId: string) {
    const jti = randomUUID();
    const tokenData = {
      sub: userId,
      sessionId,
      jti,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 604800,
    };
    return Buffer.from(JSON.stringify(tokenData)).toString('base64');
  }

  async generateTokenPair(
    payload: { userId: string; email: string; roles: string[] },
    sessionId: string,
  ) {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(payload),
      this.generateRefreshToken(payload.userId, sessionId),
    ]);
    return { accessToken, refreshToken, expiresIn: 900 };
  }

  async verifyAccessToken(token: string) {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      return {
        userId: decoded.sub,
        email: decoded.email,
        roles: decoded.roles,
        jti: decoded.jti,
        iat: decoded.iat,
        exp: decoded.exp,
      };
    } catch {
      throw new Error('Invalid access token');
    }
  }

  async verifyRefreshToken(token: string) {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
      return {
        userId: decoded.sub,
        sessionId: decoded.sessionId,
        jti: decoded.jti,
        iat: decoded.iat,
        exp: decoded.exp,
      };
    } catch {
      throw new Error('Invalid refresh token');
    }
  }
}

// ── Mock TokenBlacklistService ──────────────────────────────────────────────

export class MockTokenBlacklistService {
  private readonly blacklisted = new Set<string>();
  private readonly userTokens = new Map<string, Set<string>>();

  async blacklist(jti: string, _ttl: number): Promise<void> {
    this.blacklisted.add(jti);
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    return this.blacklisted.has(jti);
  }

  async blacklistAllForUser(userId: string): Promise<void> {
    const tokens = this.userTokens.get(userId);
    if (tokens) {
      for (const jti of tokens) {
        this.blacklisted.add(jti);
      }
    }
  }

  async trackToken(userId: string, jti: string, _ttl: number): Promise<void> {
    if (!this.userTokens.has(userId)) {
      this.userTokens.set(userId, new Set());
    }
    this.userTokens.get(userId)!.add(jti);
  }

  clear(): void {
    this.blacklisted.clear();
    this.userTokens.clear();
  }
}

// ── Mock IdempotencyStore ───────────────────────────────────────────────────

export class MockIdempotencyStore {
  private readonly processed = new Set<string>();

  async isProcessed(eventId: string): Promise<boolean> {
    return this.processed.has(eventId);
  }

  async markProcessed(eventId: string): Promise<void> {
    this.processed.add(eventId);
  }

  async ensureIdempotent(eventId: string, handler: () => Promise<void>): Promise<boolean> {
    if (this.processed.has(eventId)) {
      return false;
    }
    await handler();
    this.processed.add(eventId);
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    // no-op for mock
  }

  clear(): void {
    this.processed.clear();
  }
}

// ── Mock KeyRotationService ─────────────────────────────────────────────────

export class MockKeyRotationService {
  private readonly key = 'test-signing-key-do-not-use-in-production';

  async onModuleInit(): Promise<void> {
    // no-op
  }

  async getCurrentKeyId(): Promise<string> {
    return 'test-key-id';
  }

  async getSigningKey(): Promise<string> {
    return this.key;
  }

  async getVerificationKeys(): Promise<string[]> {
    return [this.key];
  }

  async rotateKey(): Promise<void> {
    // no-op
  }
}

// ── Exports for direct handler testing ──────────────────────────────────────

export {
  MEMBER_REPOSITORY_TOKEN,
  SESSION_REPOSITORY_TOKEN,
  PUBLICATION_REPOSITORY_TOKEN,
  DISCUSSION_REPOSITORY_TOKEN,
  CONNECTION_REPOSITORY_TOKEN,
  BLOCK_REPOSITORY_TOKEN,
  PROFILE_REPOSITORY_TOKEN,
  GROUP_REPOSITORY,
  MEMBERSHIP_REPOSITORY,
  ALERT_REPOSITORY_TOKEN,
  PREFERENCE_REPOSITORY_TOKEN,
  AUDIT_ENTRY_REPOSITORY,
};
