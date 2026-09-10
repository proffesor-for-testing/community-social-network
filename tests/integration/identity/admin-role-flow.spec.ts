/**
 * Integration Test: Identity - admin role derived from Member.isAdmin
 *
 * Admin status is a data-layer fact on the Member aggregate. These tests
 * exercise the real handlers wired to in-memory repositories and assert
 * that minted tokens carry the roles implied by that flag, and that the
 * ADMIN_EMAILS bootstrap promotes a seeded member exactly once.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Email } from '@csn/domain-shared';

import { LoginMemberHandler } from '../../../apps/api/src/modules/identity/commands/login-member.handler';
import { LoginMemberCommand } from '../../../apps/api/src/modules/identity/commands/login-member.command';
import { RefreshTokenHandler } from '../../../apps/api/src/modules/identity/commands/refresh-token.handler';
import { RefreshTokenCommand } from '../../../apps/api/src/modules/identity/commands/refresh-token.command';
import { AdminBootstrapService } from '../../../apps/api/src/modules/identity/services/admin-bootstrap.service';

import { createTestRepositories, TestRepositories, MockJwtTokenService } from '../../setup/test-app';
import { createTestMember, TEST_PASSWORD } from '../../setup/test-helpers';

describe('Identity: admin role derived from Member.isAdmin', () => {
  let repos: TestRepositories;
  let mockJwt: MockJwtTokenService;
  let loginHandler: LoginMemberHandler;
  let refreshHandler: RefreshTokenHandler;
  let bootstrap: AdminBootstrapService;
  let previousAdminEmails: string | undefined;

  beforeEach(() => {
    previousAdminEmails = process.env['ADMIN_EMAILS'];
    repos = createTestRepositories();
    mockJwt = new MockJwtTokenService();
    loginHandler = new LoginMemberHandler(
      repos.memberRepo,
      repos.sessionRepo,
      mockJwt as never,
    );
    refreshHandler = new RefreshTokenHandler(
      repos.memberRepo,
      repos.sessionRepo,
      mockJwt as never,
    );
    bootstrap = new AdminBootstrapService(repos.memberRepo);
  });

  afterEach(() => {
    if (previousAdminEmails === undefined) delete process.env['ADMIN_EMAILS'];
    else process.env['ADMIN_EMAILS'] = previousAdminEmails;
  });

  it('should mint a member-only token for a non-admin member', async () => {
    // Arrange
    const member = await createTestMember({ email: 'regular@test.com' });
    await repos.memberRepo.save(member);

    // Act
    const result = await loginHandler.execute(
      new LoginMemberCommand('regular@test.com', TEST_PASSWORD),
    );

    // Assert
    const decoded = await mockJwt.verifyAccessToken(result.accessToken);
    expect(decoded.roles).toEqual(['member']);
  });

  it('should mint an admin token for a member flagged as admin', async () => {
    // Arrange
    const member = await createTestMember({ email: 'boss@test.com', isAdmin: true });
    await repos.memberRepo.save(member);

    // Act
    const result = await loginHandler.execute(
      new LoginMemberCommand('boss@test.com', TEST_PASSWORD),
    );

    // Assert
    const decoded = await mockJwt.verifyAccessToken(result.accessToken);
    expect(decoded.roles).toEqual(['admin', 'member']);
  });

  it('should keep the admin role across a token refresh', async () => {
    // Arrange
    const member = await createTestMember({ email: 'boss@test.com', isAdmin: true });
    await repos.memberRepo.save(member);
    const login = await loginHandler.execute(
      new LoginMemberCommand('boss@test.com', TEST_PASSWORD),
    );

    // Act
    const refreshed = await refreshHandler.execute(
      new RefreshTokenCommand(login.refreshToken),
    );

    // Assert
    const decoded = await mockJwt.verifyAccessToken(refreshed.accessToken);
    expect(decoded.roles).toEqual(['admin', 'member']);
  });

  it('should drop the admin role from a refreshed token after demotion', async () => {
    // Arrange
    const member = await createTestMember({ email: 'boss@test.com', isAdmin: true });
    await repos.memberRepo.save(member);
    const login = await loginHandler.execute(
      new LoginMemberCommand('boss@test.com', TEST_PASSWORD),
    );
    member.demoteFromAdmin('another-admin');
    await repos.memberRepo.save(member);

    // Act
    const refreshed = await refreshHandler.execute(
      new RefreshTokenCommand(login.refreshToken),
    );

    // Assert
    const decoded = await mockJwt.verifyAccessToken(refreshed.accessToken);
    expect(decoded.roles).toEqual(['member']);
  });

  it('should give a bootstrapped seed admin an admin token on login', async () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = 'admin@csn.local';
    const member = await createTestMember({ email: 'admin@csn.local' });
    await repos.memberRepo.save(member);
    await bootstrap.promoteConfiguredAdmins();

    // Act
    const result = await loginHandler.execute(
      new LoginMemberCommand('admin@csn.local', TEST_PASSWORD),
    );

    // Assert
    const decoded = await mockJwt.verifyAccessToken(result.accessToken);
    expect(decoded.roles).toEqual(['admin', 'member']);
  });

  it('should not re-promote a bootstrapped admin on a second run', async () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = 'admin@csn.local';
    await repos.memberRepo.save(await createTestMember({ email: 'admin@csn.local' }));
    await bootstrap.promoteConfiguredAdmins();

    // Act
    const promoted = await bootstrap.promoteConfiguredAdmins();

    // Assert
    expect(promoted).toBe(0);
  });

  it('should not grant admin roles from ADMIN_EMAILS without a bootstrap run', async () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = 'listed@test.com';
    await repos.memberRepo.save(await createTestMember({ email: 'listed@test.com' }));

    // Act
    const result = await loginHandler.execute(
      new LoginMemberCommand('listed@test.com', TEST_PASSWORD),
    );

    // Assert
    const decoded = await mockJwt.verifyAccessToken(result.accessToken);
    expect(decoded.roles).toEqual(['member']);
  });

  it('should leave the stored member an admin after the bootstrap', async () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = 'admin@csn.local';
    await repos.memberRepo.save(await createTestMember({ email: 'admin@csn.local' }));

    // Act
    await bootstrap.promoteConfiguredAdmins();

    // Assert
    const stored = await repos.memberRepo.findByEmail(Email.create('admin@csn.local'));
    expect(stored?.isAdmin).toBe(true);
  });
});
