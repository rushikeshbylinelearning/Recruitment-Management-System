/**
 * Backfill short public links for all active form_share_tokens.
 * Run: node backend/scripts/backfill-public-form-links.js
 */

import { query } from '../config/database.js';
import { ensurePublicApplicationSchema } from '../services/ensurePublicApplicationSchema.js';
import { createPublicFormLink } from '../services/publicFormLinkService.js';

async function main() {
  await ensurePublicApplicationSchema();

  const tokens = await query(
    `SELECT st.id, st.form_id, st.token, st.expires_at, f.slug, f.job_id
     FROM form_share_tokens st
     INNER JOIN forms f ON f.id = st.form_id
     WHERE st.is_active = TRUE
     ORDER BY st.created_at ASC`
  );

  let created = 0;
  let skipped = 0;

  for (const t of tokens) {
    const existing = await query(
      'SELECT id FROM public_forms WHERE share_token_id = ? LIMIT 1',
      [t.id]
    );
    if (existing.length) {
      skipped += 1;
      continue;
    }

    await createPublicFormLink({
      formId: t.form_id,
      shareTokenId: t.id,
      expiresAt: t.expires_at,
      jobId: t.job_id,
    });
    created += 1;
    console.log(`Created short link for form ${t.slug} (token ${t.id})`);
  }

  console.log(`Done. Created: ${created}, skipped: ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
