/**
 * Hostname-aware portal detection for route segregation.
 * Local dev: unified routes unless ?portal=public|hr is set.
 */

import { DOMAINS } from '../config/domains';

export type PortalKind = 'public' | 'hr';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().split(':')[0];
}

export function isLocalDevHost(hostname?: string): boolean {
  const host = normalizeHostname(
    hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')
  );
  return LOCAL_HOSTS.has(host);
}

/** ?portal=public|hr — persisted for the session on localhost. */
export function getPortalOverride(): PortalKind | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('portal');
  if (fromQuery === 'public' || fromQuery === 'hr') {
    try {
      sessionStorage.setItem('hr_portal_override', fromQuery);
    } catch {
      /* ignore */
    }
    return fromQuery;
  }

  try {
    const stored = sessionStorage.getItem('hr_portal_override');
    if (stored === 'public' || stored === 'hr') return stored;
  } catch {
    /* ignore */
  }

  return null;
}

export function getHostname(): string {
  if (typeof window === 'undefined') return '';
  return normalizeHostname(window.location.hostname);
}

/**
 * True on apply.bylinelms.com (or ?portal=public on localhost).
 */
export function isPublicPortal(): boolean {
  const override = getPortalOverride();
  if (override === 'public') return true;
  if (override === 'hr') return false;

  const hostname = getHostname();
  if (hostname === DOMAINS.PUBLIC_PORTAL) return true;
  if (hostname.startsWith('apply.')) return true;

  return false;
}

/**
 * True on hr.bylinelms.com (or ?portal=hr on localhost).
 * Localhost without override: treated as HR for builder workflows.
 */
export function isHRPortal(): boolean {
  const override = getPortalOverride();
  if (override === 'hr') return true;
  if (override === 'public') return false;

  const hostname = getHostname();
  if (hostname === DOMAINS.HR_PORTAL) return true;
  if (hostname.startsWith('hr.')) return true;

  if (isLocalDevHost(hostname)) return true;

  return !isPublicPortal();
}

/**
 * Production domains use strict route trees; localhost stays unified unless overridden.
 */
export function shouldSegregatePortals(): boolean {
  if (typeof window === 'undefined') return false;
  if (getPortalOverride()) return true;
  return !isLocalDevHost();
}

/** HR-only paths blocked on the public apply portal. */
export const HR_ONLY_PATH_PREFIXES = [
  '/login',
  '/dashboard',
  '/admin',
  '/settings',
  '/jobs',
  '/candidates',
  '/interviews',
  '/team',
  '/tasks',
  '/communications',
  '/assignments',
  '/analytics',
  '/form-builder',
  '/workflows',
  '/recruiter-monitor',
  '/interviewer-jobs',
  '/interviewer-candidates',
] as const;

export function isHrOnlyPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  return HR_ONLY_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}
