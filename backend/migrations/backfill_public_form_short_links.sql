-- Optional manual backfill: run backend/scripts/backfill-public-form-links.js instead for safer idempotent migration.
-- This SQL only documents intent; use the Node script for production.

-- SELECT st.id, st.form_id FROM form_share_tokens st WHERE st.is_active = TRUE;
-- For each row without public_forms.share_token_id, insert via API or backfill-public-form-links.js
