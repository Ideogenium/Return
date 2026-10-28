/**
 * Guard for prefix purges: a prefix must name at least one folder ("users/<id>/"),
 * end with "/" and contain no empty, "." or ".." segment. An empty or partial prefix
 * ("", "users", "users/<id>") could otherwise delete far more than intended.
 */
export function assertPurgePrefix(prefix: string): void {
  // "users/<id>/" splits into ["users", "<id>", ""]: at least two named folders.
  const segments = prefix.split('/');
  const valid =
    prefix.endsWith('/') &&
    segments.length >= 3 &&
    segments.slice(0, -1).every((segment) => segment !== '' && segment !== '.' && segment !== '..');
  if (!valid) {
    throw new Error(`Refusing to purge an unsafe storage prefix: "${prefix}"`);
  }
}
