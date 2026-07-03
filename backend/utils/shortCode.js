import crypto from 'crypto';

/** URL-safe charset — excludes ambiguous 0/O, 1/l/I */
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

const ROUTE_PREFIXES = ['a', 'j', 'c'];

/**
 * Generate a cryptographically random short code (6–10 chars).
 * @param {number} [length=7]
 */
export function generateShortCode(length = 7) {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return code;
}

/**
 * Pick route prefix: a=application (default), j=job-linked, c=candidate intake.
 * @param {{ jobId?: number|null }} [opts]
 */
export function pickRoutePrefix(opts = {}) {
  if (opts.jobId) return 'j';
  return 'a';
}

export function isValidRoutePrefix(prefix) {
  return ROUTE_PREFIXES.includes(String(prefix || '').toLowerCase());
}

export function buildPublicPath(routePrefix, shortCode) {
  const p = String(routePrefix || 'a').toLowerCase();
  return `/${p}/${shortCode}`;
}
