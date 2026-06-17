import { describe, it, expect, vi } from 'vitest';
import {
  runAuthBootstrap,
  memberToCurrentUser,
  type RefreshSuccess,
} from '../useBootstrapAuth';

function freshMember(): RefreshSuccess['member'] {
  return {
    id: 'member-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('memberToCurrentUser', () => {
  it('derives username from the email local part', () => {
    expect(memberToCurrentUser(freshMember()).username).toBe('alice');
  });

  it('defaults role to "member"', () => {
    expect(memberToCurrentUser(freshMember()).role).toBe('member');
  });

  it('preserves id, displayName, and createdAt verbatim', () => {
    const out = memberToCurrentUser(freshMember());
    expect(out).toMatchObject({
      id: 'member-1',
      displayName: 'Alice',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});

describe('runAuthBootstrap', () => {
  it('POSTs an empty body to /auth/refresh with credentials so the cookie is sent', async () => {
    const post = vi.fn().mockResolvedValue({
      data: { accessToken: 't', member: freshMember() },
    });
    const login = vi.fn();

    await runAuthBootstrap({ post, baseUrl: '/api', login });

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, config] = post.mock.calls[0]!;
    expect(url).toBe('/api/auth/refresh');
    expect(body).toEqual({});
    expect(config).toMatchObject({ withCredentials: true });
  });

  it('seeds the auth store with the access token and mapped user on success', async () => {
    const member = freshMember();
    const post = vi.fn().mockResolvedValue({
      data: { accessToken: 'access-xyz', member },
    });
    const login = vi.fn();

    const ok = await runAuthBootstrap({ post, baseUrl: '/api', login });

    expect(ok).toBe(true);
    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith('access-xyz', memberToCurrentUser(member));
  });

  it('resolves false and leaves the store untouched on a 401', async () => {
    const post = vi.fn().mockRejectedValue({ response: { status: 401 } });
    const login = vi.fn();

    const ok = await runAuthBootstrap({ post, baseUrl: '/api', login });

    expect(ok).toBe(false);
    expect(login).not.toHaveBeenCalled();
  });

  it('resolves false on network errors instead of throwing', async () => {
    const post = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const login = vi.fn();

    await expect(runAuthBootstrap({ post, baseUrl: '/api', login })).resolves.toBe(false);
    expect(login).not.toHaveBeenCalled();
  });

  it('does not log in when the server returns 200 but a malformed body', async () => {
    const post = vi.fn().mockResolvedValue({ data: { accessToken: '', member: null } });
    const login = vi.fn();

    const ok = await runAuthBootstrap({ post, baseUrl: '/api', login });

    expect(ok).toBe(false);
    expect(login).not.toHaveBeenCalled();
  });
});
