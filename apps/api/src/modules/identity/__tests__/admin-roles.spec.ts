import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAdminEmail, rolesFor } from '../utils/admin-roles';

describe('admin-roles helper', () => {
  let previous: string | undefined;

  beforeEach(() => {
    previous = process.env['ADMIN_EMAILS'];
  });

  afterEach(() => {
    if (previous === undefined) delete process.env['ADMIN_EMAILS'];
    else process.env['ADMIN_EMAILS'] = previous;
  });

  it('returns ["member"] when ADMIN_EMAILS is unset', () => {
    delete process.env['ADMIN_EMAILS'];
    expect(rolesFor('anyone@example.com')).toEqual(['member']);
  });

  it('returns ["admin","member"] when the email is on the allowlist', () => {
    process.env['ADMIN_EMAILS'] = 'admin@example.com';
    expect(rolesFor('admin@example.com')).toEqual(['admin', 'member']);
  });

  it('is case-insensitive', () => {
    process.env['ADMIN_EMAILS'] = 'Admin@Example.com';
    expect(isAdminEmail('admin@example.com')).toBe(true);
    expect(isAdminEmail('ADMIN@EXAMPLE.COM')).toBe(true);
  });

  it('supports multiple comma-separated emails with surrounding whitespace', () => {
    process.env['ADMIN_EMAILS'] = ' first@a.test , second@b.test ,third@c.test';
    expect(isAdminEmail('first@a.test')).toBe(true);
    expect(isAdminEmail('second@b.test')).toBe(true);
    expect(isAdminEmail('third@c.test')).toBe(true);
    expect(isAdminEmail('fourth@d.test')).toBe(false);
  });

  it('treats an empty ADMIN_EMAILS as no admins', () => {
    process.env['ADMIN_EMAILS'] = '';
    expect(rolesFor('anyone@example.com')).toEqual(['member']);
  });

  it('does not partially match — substrings of an admin email are not admins', () => {
    process.env['ADMIN_EMAILS'] = 'admin@example.com';
    expect(isAdminEmail('not-admin@example.com')).toBe(false);
    expect(isAdminEmail('admin@example.com.evil')).toBe(false);
  });
});
