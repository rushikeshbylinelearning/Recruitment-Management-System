import { query } from '../config/database.js';
import { generateShortCode, pickRoutePrefix, buildPublicPath } from '../utils/shortCode.js';
import { getFrontendBaseUrl } from '../utils/frontendUrl.js';

const MAX_COLLISION_RETRIES = 8;

/**
 * Resolve a public short link to form metadata (never exposes internal IDs to client).
 */
export async function resolveShortCode(shortCode, routePrefix = null) {
  let sql = `
    SELECT pf.id AS public_form_id, pf.short_code, pf.route_prefix, pf.is_active AS link_active,
           pf.expires_at, pf.form_id,
           f.name, f.slug, f.is_active AS form_active, f.description, f.job_id
    FROM public_forms pf
    INNER JOIN forms f ON f.id = pf.form_id
    WHERE pf.short_code = ?`;
  const params = [shortCode];

  if (routePrefix) {
    sql += ' AND pf.route_prefix = ?';
    params.push(routePrefix);
  }

  const rows = await query(sql, params);
  if (!rows.length) return null;

  const row = rows[0];
  if (!row.link_active) return { error: 'revoked', row };
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { error: 'expired', row };
  }
  if (!row.form_active) return { error: 'form_inactive', row };

  query('UPDATE public_forms SET access_count = access_count + 1 WHERE id = ?', [
    row.public_form_id,
  ]).catch(() => {});

  return { row };
}

/**
 * Create a new short public link for a form.
 */
export async function createPublicFormLink({
  formId,
  createdBy = null,
  shareTokenId = null,
  expiresAt = null,
  jobId = null,
  req = null,
}) {
  const routePrefix = pickRoutePrefix({ jobId });

  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt += 1) {
    const shortCode = generateShortCode(7);
    try {
      const result = await query(
        `INSERT INTO public_forms (short_code, route_prefix, form_id, share_token_id, expires_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [shortCode, routePrefix, formId, shareTokenId, expiresAt, createdBy]
      );

      const publicFormId = result.insertId;
      const path = buildPublicPath(routePrefix, shortCode);
      const url = `${getFrontendBaseUrl(req)}${path}`;

      return {
        publicFormId,
        shortCode,
        routePrefix,
        path,
        url,
      };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') continue;
      throw error;
    }
  }

  throw new Error('Failed to generate unique short code');
}

/**
 * Backfill short link for legacy share token if missing.
 */
export async function getOrCreateLinkForForm(formId, opts = {}) {
  const existing = await query(
    `SELECT short_code, route_prefix FROM public_forms
     WHERE form_id = ? AND is_active = TRUE
     ORDER BY created_at DESC LIMIT 1`,
    [formId]
  );

  if (existing.length) {
    const { short_code: shortCode, route_prefix: routePrefix } = existing[0];
    const path = buildPublicPath(routePrefix, shortCode);
    return {
      shortCode,
      routePrefix,
      path,
      url: `${getFrontendBaseUrl(opts.req)}${path}`,
      created: false,
    };
  }

  const created = await createPublicFormLink({
    formId,
    createdBy: opts.createdBy,
    shareTokenId: opts.shareTokenId,
    expiresAt: opts.expiresAt,
    jobId: opts.jobId,
    req: opts.req,
  });
  return { ...created, created: true };
}

export function buildShortApplyUrl(routePrefix, shortCode, req) {
  return `${getFrontendBaseUrl(req)}${buildPublicPath(routePrefix, shortCode)}`;
}

/**
 * Resolve legacy /apply/:slug?share=TOKEN to a short public link (creates mapping if missing).
 */
export async function resolveLegacyShareToShortLink(slug, shareToken, req = null) {
  const rows = await query(
    `SELECT st.id AS share_token_id, st.form_id, st.is_active, st.expires_at,
            f.slug, f.job_id, f.is_active AS form_active
     FROM form_share_tokens st
     INNER JOIN forms f ON f.id = st.form_id
     WHERE st.token = ? AND f.slug = ?`,
    [shareToken, slug]
  );

  if (!rows.length || !rows[0].is_active) return null;
  const row = rows[0];
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
  if (!row.form_active) return null;

  const existing = await query(
    `SELECT short_code, route_prefix FROM public_forms
     WHERE share_token_id = ? AND is_active = TRUE LIMIT 1`,
    [row.share_token_id]
  );

  if (existing.length) {
    const { short_code: shortCode, route_prefix: routePrefix } = existing[0];
    const path = buildPublicPath(routePrefix, shortCode);
    return { shortCode, routePrefix, path, url: `${getFrontendBaseUrl(req)}${path}` };
  }

  return createPublicFormLink({
    formId: row.form_id,
    shareTokenId: row.share_token_id,
    expiresAt: row.expires_at,
    jobId: row.job_id,
    req,
  });
}
