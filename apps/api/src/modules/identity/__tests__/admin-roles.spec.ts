import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  rolesFor,
  isBootstrapAdminEmail,
  bootstrapAdminEmails,
} from '../utils/admin-roles';

describe('rolesFor', () => {
  it('returns only the member role for a non-admin member', () => {
    // Arrange
    const member = { isAdmin: false };

    // Act
    const roles = rolesFor(member);

    // Assert
    expect(roles).toEqual(['member']);
  });

  it('returns both admin and member roles for an admin member', () => {
    // Arrange
    const member = { isAdmin: true };

    // Act
    const roles = rolesFor(member);

    // Assert
    expect(roles).toEqual(['admin', 'member']);
  });

  it('ignores ADMIN_EMAILS when deriving roles', () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = 'listed@example.com';
    const member = { isAdmin: false };

    // Act
    const roles = rolesFor(member);

    // Assert
    expect(roles).toEqual(['member']);
  });
});

describe('bootstrap admin allowlist', () => {
  let previous: string | undefined;

  beforeEach(() => {
    previous = process.env['ADMIN_EMAILS'];
  });

  afterEach(() => {
    if (previous === undefined) delete process.env['ADMIN_EMAILS'];
    else process.env['ADMIN_EMAILS'] = previous;
  });

  it('reports no bootstrap admins when ADMIN_EMAILS is unset', () => {
    // Arrange
    delete process.env['ADMIN_EMAILS'];

    // Act
    const emails = bootstrapAdminEmails();

    // Assert
    expect(emails).toEqual([]);
  });

  it('reports no bootstrap admins when ADMIN_EMAILS is empty', () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = '';

    // Act
    const emails = bootstrapAdminEmails();

    // Assert
    expect(emails).toEqual([]);
  });

  it('normalises entries by trimming whitespace and lowercasing', () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = ' First@A.test , second@B.test ,third@c.test';

    // Act
    const emails = bootstrapAdminEmails();

    // Assert
    expect(emails).toEqual(['first@a.test', 'second@b.test', 'third@c.test']);
  });

  it('matches a listed email regardless of case', () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = 'Admin@Example.com';

    // Act
    const listed = isBootstrapAdminEmail('ADMIN@EXAMPLE.COM');

    // Assert
    expect(listed).toBe(true);
  });

  it('does not match an email that merely contains a listed address', () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = 'admin@example.com';

    // Act
    const listed = isBootstrapAdminEmail('not-admin@example.com');

    // Assert
    expect(listed).toBe(false);
  });

  it('does not match an email that extends a listed address', () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = 'admin@example.com';

    // Act
    const listed = isBootstrapAdminEmail('admin@example.com.evil');

    // Assert
    expect(listed).toBe(false);
  });
});
