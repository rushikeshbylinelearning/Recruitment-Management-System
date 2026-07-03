/**

 * Resolves frontend base URLs for share links, emails, redirects.

 * Public candidate links always use the apply portal — never the HR host.

 */



const DEFAULT_PROD_HR = 'https://hr.bylinelms.com';

const DEFAULT_PROD_PUBLIC = 'https://apply.bylinelms.com';

const DEFAULT_DEV_FRONTEND = 'http://localhost:5173';

const API_PORT_PATTERN = /:3001(\/|$)/;



function stripTrailingSlash(url) {

  return String(url || '').trim().replace(/\/$/, '');

}



function isApiOrigin(origin) {

  if (!origin) return true;

  try {

    const { port, hostname } = new URL(origin);

    if (port === '3001') return true;

    if (hostname === 'localhost' && port === '3001') return true;

  } catch {

    return true;

  }

  return API_PORT_PATTERN.test(origin);

}



/**

 * HR/admin SPA base (login, dashboard). First entry of FRONTEND_URL or HR default.

 */

export function getHrFrontendBaseUrl(req) {

  if (process.env.FRONTEND_URL) {

    return stripTrailingSlash(process.env.FRONTEND_URL.split(',')[0]);

  }



  const origin = req?.headers?.origin;

  if (origin && !isApiOrigin(origin)) {

    try {

      const { hostname } = new URL(origin);

      if (hostname.includes('hr.') || hostname === 'localhost' || hostname === '127.0.0.1') {

        return stripTrailingSlash(origin);

      }

    } catch {

      /* ignore */

    }

  }



  if (process.env.NODE_ENV === 'production') {

    return DEFAULT_PROD_HR;

  }



  return DEFAULT_DEV_FRONTEND;

}



/**

 * Public apply portal — used for /a/:code, legacy /apply redirects, emails.

 */

export function getPublicFrontendBaseUrl(req) {

  if (process.env.PUBLIC_FRONTEND_URL) {

    return stripTrailingSlash(process.env.PUBLIC_FRONTEND_URL.split(',')[0]);

  }



  const origin = req?.headers?.origin;

  if (origin && !isApiOrigin(origin)) {

    try {

      const { hostname } = new URL(origin);

      if (hostname.includes('apply.')) {

        return stripTrailingSlash(origin);

      }

    } catch {

      /* ignore */

    }

  }



  const referer = req?.headers?.referer;

  if (referer) {

    try {

      const refOrigin = new URL(referer).origin;

      if (!isApiOrigin(refOrigin) && refOrigin.includes('apply.')) {

        return stripTrailingSlash(refOrigin);

      }

    } catch {

      /* ignore */

    }

  }



  const forwardedHost = req?.headers?.['x-forwarded-host']?.split(',')[0]?.trim();

  const forwardedProto = req?.headers?.['x-forwarded-proto']?.split(',')[0]?.trim();

  if (forwardedHost && forwardedHost.includes('apply.')) {

    const proto = forwardedProto || 'https';

    return stripTrailingSlash(`${proto}://${forwardedHost}`);

  }



  if (process.env.NODE_ENV === 'production') {

    return DEFAULT_PROD_PUBLIC;

  }



  if (process.env.FRONTEND_URL) {

    const parts = process.env.FRONTEND_URL.split(',').map((u) => u.trim());

    const applyEntry = parts.find((u) => u.includes('apply.'));

    if (applyEntry) return stripTrailingSlash(applyEntry);

  }



  const host = req?.get?.('host');

  const protocol = forwardedProto || req?.protocol || 'http';

  if (host && host.includes('apply.')) {

    return stripTrailingSlash(`${protocol}://${host}`);

  }



  return DEFAULT_DEV_FRONTEND;

}



/**

 * @deprecated Prefer getPublicFrontendBaseUrl for share links.

 * Kept for backward compatibility — always returns public portal URL.

 */

export function getFrontendBaseUrl(req) {

  return getPublicFrontendBaseUrl(req);

}



/**

 * @param {string} slug

 * @param {string} shareToken

 * @param {import('express').Request} [req]

 */

export function buildFormApplyShareUrl(slug, shareToken, req) {

  return `${getPublicFrontendBaseUrl(req)}/apply/${slug}?share=${shareToken}`;

}



/**

 * ATS-style short public application URL (preferred).

 */

export function buildShortPublicUrl(routePrefix, shortCode, req) {

  const p = String(routePrefix || 'a').toLowerCase();

  return `${getPublicFrontendBaseUrl(req)}/${p}/${shortCode}`;

}


