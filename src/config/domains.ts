/**
 * Centralized portal hostnames and base URLs.
 * Never hardcode production domains in components — import from here.
 */

export const DOMAINS = {
  HR_PORTAL: 'hr.bylinelms.com',
  PUBLIC_PORTAL: 'apply.bylinelms.com',
} as const;

const stripTrailingSlash = (url: string) => url.replace(/\/$/, '');

/** HR/admin SPA base URL (login, dashboard, form builder). */
export function getHrAppUrl(): string {
  const fromEnv = import.meta.env.VITE_HR_APP_URL || import.meta.env.VITE_APP_URL;
  if (fromEnv) return stripTrailingSlash(String(fromEnv));
  if (import.meta.env.PROD) return `https://${DOMAINS.HR_PORTAL}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return stripTrailingSlash(window.location.origin);
  }
  return 'http://localhost:5173';
}

/** Public candidate-facing SPA base URL (applications, short links). */
export function getPublicAppUrl(): string {
  const fromEnv = import.meta.env.VITE_PUBLIC_APP_URL;
  if (fromEnv) return stripTrailingSlash(String(fromEnv));
  if (import.meta.env.PROD) return `https://${DOMAINS.PUBLIC_PORTAL}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return stripTrailingSlash(window.location.origin);
  }
  return 'http://localhost:5173';
}

export const domainConfig = {
  hrHostname: DOMAINS.HR_PORTAL,
  publicHostname: DOMAINS.PUBLIC_PORTAL,
  hrAppUrl: getHrAppUrl,
  publicAppUrl: getPublicAppUrl,
};

export default domainConfig;
