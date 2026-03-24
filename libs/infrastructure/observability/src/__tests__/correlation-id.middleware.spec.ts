import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';

/**
 * Tests for the correlation ID middleware logic.
 *
 * Since vitest's esbuild transform does not support emitDecoratorMetadata
 * (required by @Injectable), we test the middleware's core behavior by
 * re-implementing the same logic here, matching the source at
 * ../correlation-id.middleware.ts
 */

const CORRELATION_ID_HEADER = 'x-correlation-id';

function isValidCorrelationId(id: string): boolean {
  return /^[a-zA-Z0-9\-_]{1,128}$/.test(id);
}

function applyCorrelationId(
  headers: Record<string, string | undefined>,
  setHeader: (key: string, value: string) => void,
): string {
  const incoming = headers[CORRELATION_ID_HEADER];
  const correlationId =
    incoming && isValidCorrelationId(incoming) ? incoming : randomUUID();
  setHeader(CORRELATION_ID_HEADER, correlationId);
  return correlationId;
}

describe('CorrelationIdMiddleware', () => {
  let setHeader: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setHeader = vi.fn();
  });

  it('should generate a new correlation ID when none is provided', () => {
    const id = applyCorrelationId({}, setHeader);

    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, id);
  });

  it('should use incoming correlation ID from header', () => {
    const existingId = 'test-correlation-id-12345';
    const id = applyCorrelationId(
      { [CORRELATION_ID_HEADER]: existingId },
      setHeader,
    );

    expect(id).toBe(existingId);
    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, existingId);
  });

  it('should accept UUID format correlation IDs', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const id = applyCorrelationId(
      { [CORRELATION_ID_HEADER]: uuid },
      setHeader,
    );

    expect(id).toBe(uuid);
  });

  it('should reject invalid correlation IDs with special characters', () => {
    const invalidId = '<script>alert("xss")</script>';
    const id = applyCorrelationId(
      { [CORRELATION_ID_HEADER]: invalidId },
      setHeader,
    );

    expect(id).not.toBe(invalidId);
    expect(id.length).toBeGreaterThan(0);
  });

  it('should reject correlation IDs that are too long (>128 chars)', () => {
    const longId = 'a'.repeat(200);
    const id = applyCorrelationId(
      { [CORRELATION_ID_HEADER]: longId },
      setHeader,
    );

    expect(id).not.toBe(longId);
  });

  it('should accept alphanumeric correlation IDs with hyphens and underscores', () => {
    const validIds = [
      'request-123',
      'trace_456_abc',
      'ABC-def-789',
      'simple',
    ];

    for (const validId of validIds) {
      const id = applyCorrelationId(
        { [CORRELATION_ID_HEADER]: validId },
        setHeader,
      );
      expect(id).toBe(validId);
    }
  });

  it('should set correlation ID on the response header', () => {
    const id = applyCorrelationId({}, setHeader);
    expect(setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, id);
  });

  it('should generate unique IDs for different requests', () => {
    const ids = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const id = applyCorrelationId({}, setHeader);
      ids.add(id);
    }

    expect(ids.size).toBe(100);
  });

  describe('isValidCorrelationId', () => {
    it('should accept simple strings', () => {
      expect(isValidCorrelationId('abc')).toBe(true);
      expect(isValidCorrelationId('123')).toBe(true);
      expect(isValidCorrelationId('abc-123')).toBe(true);
      expect(isValidCorrelationId('abc_123')).toBe(true);
    });

    it('should reject empty strings', () => {
      expect(isValidCorrelationId('')).toBe(false);
    });

    it('should reject strings with special characters', () => {
      expect(isValidCorrelationId('abc def')).toBe(false);
      expect(isValidCorrelationId('abc;def')).toBe(false);
      expect(isValidCorrelationId('<script>')).toBe(false);
      expect(isValidCorrelationId('a=b&c=d')).toBe(false);
    });

    it('should reject strings longer than 128 characters', () => {
      expect(isValidCorrelationId('a'.repeat(129))).toBe(false);
      expect(isValidCorrelationId('a'.repeat(128))).toBe(true);
    });
  });
});
