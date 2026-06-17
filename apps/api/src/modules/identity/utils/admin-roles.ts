/**
 * Determine the role array to embed in JWTs for a given member email.
 *
 * Source of truth (in priority order):
 *   1. `ADMIN_EMAILS` env var, a comma-separated list of admin emails.
 *      Whitespace is trimmed; comparison is case-insensitive.
 *
 * Until the Member aggregate carries a real role field, this single helper
 * is the canonical place that answers "is this email an admin?" so login,
 * refresh, and admin-login all agree.
 */
export function rolesFor(email: string): string[] {
  return isAdminEmail(email) ? ['admin', 'member'] : ['member'];
}

export function isAdminEmail(email: string): boolean {
  const raw = process.env['ADMIN_EMAILS'] ?? '';
  if (!raw) return false;
  const needle = email.trim().toLowerCase();
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(needle);
}
