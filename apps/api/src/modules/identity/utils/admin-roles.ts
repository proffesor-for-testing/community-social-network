/**
 * Determine the role array to embed in JWTs for a member.
 *
 * Admin status is a data-layer fact on the Member aggregate (`isAdmin`),
 * so login, refresh, and admin-login all derive roles from the same source.
 *
 * `ADMIN_EMAILS` survives only as a one-time bootstrap allowlist consumed by
 * `AdminBootstrapService` on API startup — it never grants roles at token
 * minting time.
 */
export interface RoleBearingMember {
  readonly isAdmin: boolean;
}

export function rolesFor(member: RoleBearingMember): string[] {
  return member.isAdmin ? ['admin', 'member'] : ['member'];
}

/**
 * Bootstrap-only: is this email listed in the `ADMIN_EMAILS` env allowlist?
 * Whitespace is trimmed; comparison is case-insensitive.
 */
export function isBootstrapAdminEmail(email: string): boolean {
  return bootstrapAdminEmails().includes(email.trim().toLowerCase());
}

/** Bootstrap-only: the normalised list of emails in `ADMIN_EMAILS`. */
export function bootstrapAdminEmails(): string[] {
  const raw = process.env['ADMIN_EMAILS'] ?? '';
  if (!raw) return [];
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
