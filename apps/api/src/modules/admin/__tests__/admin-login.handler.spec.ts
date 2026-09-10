import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AdminLoginHandler } from '../commands/admin-login.handler';
import { AdminLoginCommand } from '../commands/admin-login.command';

function activeMember(isAdmin = true) {
  return {
    id: { value: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890' },
    email: { value: 'admin@example.com' },
    credential: { value: '$2b$10$hashed' },
    status: { value: 'ACTIVE' },
    isAdmin,
  };
}

function mockRepo(member: ReturnType<typeof activeMember> | null) {
  return { findByEmail: vi.fn().mockResolvedValue(member) };
}

function mockAuditRepo() {
  return { save: vi.fn().mockResolvedValue(undefined) };
}

function mockJwtTokenService(token = 'admin-canonical-token') {
  return { generateAccessToken: vi.fn().mockResolvedValue(token) };
}

// bcrypt.compare is module-level — stub it.
vi.mock('bcrypt', () => ({
  compare: vi.fn(async (plain: string) => plain === 'correct-password'),
}));

describe('AdminLoginHandler', () => {
  let memberRepo: ReturnType<typeof mockRepo>;
  let auditRepo: ReturnType<typeof mockAuditRepo>;
  let jwt: ReturnType<typeof mockJwtTokenService>;
  let handler: AdminLoginHandler;
  let previousAdminEmails: string | undefined;

  beforeEach(() => {
    previousAdminEmails = process.env['ADMIN_EMAILS'];
    process.env['ADMIN_EMAILS'] = 'admin@example.com';
    memberRepo = mockRepo(activeMember());
    auditRepo = mockAuditRepo();
    jwt = mockJwtTokenService();
    handler = new AdminLoginHandler(
      memberRepo as never,
      auditRepo as never,
      jwt as never,
    );
  });

  afterEach(() => {
    if (previousAdminEmails === undefined) delete process.env['ADMIN_EMAILS'];
    else process.env['ADMIN_EMAILS'] = previousAdminEmails;
  });

  it('rejects a member whose isAdmin flag is false, even with correct password', async () => {
    memberRepo.findByEmail.mockResolvedValueOnce(activeMember(false));

    await expect(
      handler.execute({
        email: 'admin@example.com',
        password: 'correct-password',
        ipAddress: '127.0.0.1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(jwt.generateAccessToken).not.toHaveBeenCalled();
  });

  it('mints a canonical access token via JwtTokenService.generateAccessToken', async () => {
    const command: AdminLoginCommand = {
      email: 'admin@example.com',
      password: 'correct-password',
      ipAddress: '127.0.0.1',
    };

    const result = await handler.execute(command);

    expect(jwt.generateAccessToken).toHaveBeenCalledTimes(1);
    expect(jwt.generateAccessToken).toHaveBeenCalledWith({
      userId: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
      email: 'admin@example.com',
      roles: expect.arrayContaining(['admin']),
    });
    expect(result.accessToken).toBe('admin-canonical-token');
    expect(result.adminId).toBe('a1b2c3d4-e5f6-4890-abcd-ef1234567890');
  });

  it('includes both admin and member roles so admins keep regular access', async () => {
    await handler.execute({
      email: 'admin@example.com',
      password: 'correct-password',
      ipAddress: '127.0.0.1',
    });

    const arg = jwt.generateAccessToken.mock.calls[0]![0] as { roles: string[] };
    expect(arg.roles).toContain('admin');
    expect(arg.roles).toContain('member');
  });

  it('rejects unknown email with UnauthorizedException and audits the attempt', async () => {
    memberRepo.findByEmail.mockResolvedValueOnce(null);

    await expect(
      handler.execute({
        email: 'ghost@example.com',
        password: 'whatever',
        ipAddress: '127.0.0.1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(jwt.generateAccessToken).not.toHaveBeenCalled();
    expect(auditRepo.save).toHaveBeenCalledTimes(1);
  });

  it('rejects wrong password with UnauthorizedException and audits the attempt', async () => {
    await expect(
      handler.execute({
        email: 'admin@example.com',
        password: 'wrong-password',
        ipAddress: '127.0.0.1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(jwt.generateAccessToken).not.toHaveBeenCalled();
    expect(auditRepo.save).toHaveBeenCalledTimes(1);
  });

  it('blocks non-ACTIVE admin accounts with ForbiddenException', async () => {
    memberRepo.findByEmail.mockResolvedValueOnce({
      ...activeMember(),
      status: { value: 'SUSPENDED' },
    });

    await expect(
      handler.execute({
        email: 'admin@example.com',
        password: 'correct-password',
        ipAddress: '127.0.0.1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(jwt.generateAccessToken).not.toHaveBeenCalled();
  });
});
