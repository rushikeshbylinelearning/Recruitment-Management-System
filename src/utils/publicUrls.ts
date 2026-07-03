/**
 * Public application URL builders — always use the apply portal base URL.
 */

import { getPublicAppUrl } from '../config/domains';

const stripSlash = (s: string) => s.replace(/\/$/, '');

/**
 * Preferred short public link: https://apply.bylinelms.com/a/{shortCode}
 */
export function generatePublicFormUrl(
  shortCode: string,
  routePrefix: string = 'a'
): string {
  const base = stripSlash(getPublicAppUrl());
  const prefix = (routePrefix || 'a').replace(/^\//, '').replace(/\/$/, '');
  const code = String(shortCode || '').trim();
  return `${base}/${prefix}/${code}`;
}

/** Legacy share URL (still valid; may redirect to short link on load). */
export function generateLegacyApplyUrl(slug: string, shareToken: string): string {
  const base = stripSlash(getPublicAppUrl());
  return `${base}/apply/${encodeURIComponent(slug)}?share=${encodeURIComponent(shareToken)}`;
}

/** Static access-token preview / intern copy fallback. */
export function generateLegacyTokenApplyUrl(slug: string, accessToken: string): string {
  const base = stripSlash(getPublicAppUrl());
  return `${base}/apply/${encodeURIComponent(slug)}?token=${encodeURIComponent(accessToken)}`;
}

/** Assignment submission page (candidate-facing). */
export function generateSubmissionUrl(candidateId: string | number, token: string): string {
  const base = stripSlash(getPublicAppUrl());
  return `${base}/submit-assignment/${candidateId}/${encodeURIComponent(token)}`;
}

/**
 * Normalize API-returned links to the apply portal when backend still sends HR origin.
 */
export function ensurePublicPortalUrl(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const publicBase = new URL(stripSlash(getPublicAppUrl()));
    parsed.protocol = publicBase.protocol;
    parsed.host = publicBase.host;
    return parsed.toString().replace(/\/$/, '') + (parsed.search || '');
  } catch {
    return url;
  }
}
