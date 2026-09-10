import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Email } from '@csn/domain-shared';
import { Member, MemberId, Credential } from '@csn/domain-identity';
import { InMemoryMemberRepository } from '@csn/infra-identity';
import { AdminBootstrapService } from '../services/admin-bootstrap.service';

function createActiveMember(email: string): Member {
  const member = Member.register(
    MemberId.generate(),
    Email.create(email),
    Credential.create('$2b$10$hashedpasswordvalue'),
    'Seeded User',
  );
  member.activate();
  member.pullDomainEvents();
  return member;
}

describe('AdminBootstrapService', () => {
  let repository: InMemoryMemberRepository;
  let service: AdminBootstrapService;
  let previousAdminEmails: string | undefined;

  beforeEach(() => {
    previousAdminEmails = process.env['ADMIN_EMAILS'];
    repository = new InMemoryMemberRepository();
    service = new AdminBootstrapService(repository);
  });

  afterEach(() => {
    if (previousAdminEmails === undefined) delete process.env['ADMIN_EMAILS'];
    else process.env['ADMIN_EMAILS'] = previousAdminEmails;
  });

  it('should promote a member listed in ADMIN_EMAILS', async () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = 'admin@csn.local';
    const member = createActiveMember('admin@csn.local');
    await repository.save(member);

    // Act
    await service.promoteConfiguredAdmins();

    // Assert
    expect(member.isAdmin).toBe(true);
  });

  it('should report the number of members it promoted', async () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = 'admin@csn.local,second@csn.local';
    await repository.save(createActiveMember('admin@csn.local'));
    await repository.save(createActiveMember('second@csn.local'));

    // Act
    const promoted = await service.promoteConfiguredAdmins();

    // Assert
    expect(promoted).toBe(2);
  });

  it('should promote nothing on a second run', async () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = 'admin@csn.local';
    await repository.save(createActiveMember('admin@csn.local'));
    await service.promoteConfiguredAdmins();

    // Act
    const promoted = await service.promoteConfiguredAdmins();

    // Assert
    expect(promoted).toBe(0);
  });

  it('should leave an already-promoted member an admin after a second run', async () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = 'admin@csn.local';
    const member = createActiveMember('admin@csn.local');
    await repository.save(member);
    await service.promoteConfiguredAdmins();

    // Act
    await service.promoteConfiguredAdmins();

    // Assert
    expect(member.isAdmin).toBe(true);
  });

  it('should not raise the version of an already-promoted member', async () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = 'admin@csn.local';
    const member = createActiveMember('admin@csn.local');
    await repository.save(member);
    await service.promoteConfiguredAdmins();
    const versionAfterBootstrap = member.version;

    // Act
    await service.promoteConfiguredAdmins();

    // Assert
    expect(member.version).toBe(versionAfterBootstrap);
  });

  it('should match allowlist entries case-insensitively', async () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = 'Admin@CSN.local';
    const member = createActiveMember('admin@csn.local');
    await repository.save(member);

    // Act
    await service.promoteConfiguredAdmins();

    // Assert
    expect(member.isAdmin).toBe(true);
  });

  it('should promote nobody when ADMIN_EMAILS is unset', async () => {
    // Arrange
    delete process.env['ADMIN_EMAILS'];
    const member = createActiveMember('admin@csn.local');
    await repository.save(member);

    // Act
    await service.promoteConfiguredAdmins();

    // Assert
    expect(member.isAdmin).toBe(false);
  });

  it('should skip an allowlisted email that has no matching member', async () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = 'ghost@csn.local';

    // Act
    const promoted = await service.promoteConfiguredAdmins();

    // Assert
    expect(promoted).toBe(0);
  });

  it('should leave members outside the allowlist untouched', async () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = 'admin@csn.local';
    await repository.save(createActiveMember('admin@csn.local'));
    const regular = createActiveMember('regular@csn.local');
    await repository.save(regular);

    // Act
    await service.promoteConfiguredAdmins();

    // Assert
    expect(regular.isAdmin).toBe(false);
  });

  it('should run the bootstrap on application bootstrap', async () => {
    // Arrange
    process.env['ADMIN_EMAILS'] = 'admin@csn.local';
    const member = createActiveMember('admin@csn.local');
    await repository.save(member);

    // Act
    await service.onApplicationBootstrap();

    // Assert
    expect(member.isAdmin).toBe(true);
  });
});
