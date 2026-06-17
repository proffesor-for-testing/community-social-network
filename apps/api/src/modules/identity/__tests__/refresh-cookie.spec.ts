import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { readRefreshCookie, refreshCookieOptions, REFRESH_COOKIE_NAME } from '../utils/refresh-cookie';

function reqWithCookies(header?: string): Request {
  return { headers: { cookie: header } } as unknown as Request;
}

describe('readRefreshCookie', () => {
  it('returns undefined when no Cookie header is present', () => {
    expect(readRefreshCookie(reqWithCookies())).toBeUndefined();
  });

  it('returns the refresh_token value when alone', () => {
    expect(readRefreshCookie(reqWithCookies('refresh_token=abc.def.ghi'))).toBe('abc.def.ghi');
  });

  it('returns the refresh_token value when mixed with other cookies', () => {
    expect(
      readRefreshCookie(reqWithCookies('sid=xyz; refresh_token=token-val; theme=dark')),
    ).toBe('token-val');
  });

  it('decodes URL-encoded values', () => {
    expect(readRefreshCookie(reqWithCookies('refresh_token=a%3Db%26c'))).toBe('a=b&c');
  });

  it('preserves embedded "=" characters in JWT-shaped tokens', () => {
    const jwt = 'header.payload.sig==';
    expect(readRefreshCookie(reqWithCookies(`refresh_token=${jwt}`))).toBe(jwt);
  });

  it('does not match cookies whose name is only a suffix of refresh_token', () => {
    expect(readRefreshCookie(reqWithCookies('not_refresh_token=oops'))).toBeUndefined();
  });
});

describe('refreshCookieOptions', () => {
  it('returns httpOnly, lax, root-path defaults', () => {
    const opts = refreshCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
    expect(opts.maxAge).toBeGreaterThan(0);
  });

  it('does not mark the cookie secure outside production', () => {
    const prev = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';
    try {
      expect(refreshCookieOptions().secure).toBe(false);
    } finally {
      process.env['NODE_ENV'] = prev;
    }
  });

  it('marks the cookie secure in production', () => {
    const prev = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      expect(refreshCookieOptions().secure).toBe(true);
    } finally {
      process.env['NODE_ENV'] = prev;
    }
  });
});

describe('REFRESH_COOKIE_NAME', () => {
  it('is the stable refresh_token identifier', () => {
    expect(REFRESH_COOKIE_NAME).toBe('refresh_token');
  });
});
