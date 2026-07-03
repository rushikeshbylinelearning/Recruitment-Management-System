import { resolveShortCode } from '../services/publicFormLinkService.js';
import { ensurePublicApplicationSchema } from '../services/ensurePublicApplicationSchema.js';

/**
 * Resolve :shortCode from public application routes.
 * Attaches req.publicForm and req.form (internal — not sent to client).
 */
export async function resolvePublicForm(req, res, next) {
  try {
    await ensurePublicApplicationSchema();
    const shortCode =
      req.params.shortCode ||
      req.body?.shortCode ||
      req.headers['x-short-code'];
    if (!shortCode || shortCode.length < 4 || shortCode.length > 12) {
      return res.status(404).json({ success: false, message: 'Application link not found.' });
    }

    const routePrefix =
      req.params.routePrefix ||
      req.body?.routePrefix ||
      req.headers['x-route-prefix'] ||
      null;
    const resolved = await resolveShortCode(shortCode, routePrefix);

    if (!resolved) {
      return res.status(404).json({ success: false, message: 'Application link not found.' });
    }

    if (resolved.error === 'revoked') {
      return res.status(410).json({ success: false, message: 'This application link is no longer active.' });
    }
    if (resolved.error === 'expired') {
      return res.status(410).json({ success: false, message: 'This application link has expired.' });
    }
    if (resolved.error === 'form_inactive') {
      return res.status(403).json({ success: false, message: 'This position is not accepting applications.' });
    }

    const { row } = resolved;
    req.publicForm = {
      id: row.public_form_id,
      shortCode: row.short_code,
      routePrefix: row.route_prefix,
    };
    req.form = {
      id: row.form_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      is_active: row.form_active,
      job_id: row.job_id,
    };
    return next();
  } catch (error) {
    console.error('[resolvePublicForm]', error);
    return res.status(500).json({ success: false, message: 'Unable to load application.' });
  }
}
