/**
 * rmsWebhook.js  ─  OPTIONAL: ADD to hr-workflow-management/backend/routes/
 *
 * When a new candidate is created via the public form submission,
 * the RMS backend can automatically push (POST) that candidate
 * to the Assessment Portal so it shows up instantly — no manual sync needed.
 *
 * How to enable:
 *  1. Add to hr-workflow-management/backend/.env:
 *       ASSESSMENT_PORTAL_WEBHOOK_URL=https://assessment-portal.legatolxp.online/api/rms-webhook/candidate
 *       ASSESSMENT_PORTAL_WEBHOOK_SECRET=webhook_secret_change_me
 *
 *  2. Mount in server.js (AFTER the existing routes block):
 *       import rmsWebhookRoutes from './routes/rmsWebhook.js';
 *       app.use('/api/rms-webhook-dispatch', rmsWebhookRoutes);
 *
 *  3. Call triggerAssessmentPortalWebhook(candidate) from inside
 *     the public form submission handler (routes/publicForms.js) after
 *     a candidate is created successfully.
 */

import express from 'express';
// Uses native fetch (Node 18+) — no external dependency needed

const router = express.Router();

/**
 * Utility: fire-and-forget push to Assessment Portal.
 * Call this after a candidate is created from the public form.
 *
 * @param {object} candidate - plain candidate row from MySQL
 */
export async function triggerAssessmentPortalWebhook(candidate) {
  const webhookUrl    = process.env.ASSESSMENT_PORTAL_WEBHOOK_URL;
  const webhookSecret = process.env.ASSESSMENT_PORTAL_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) {
    // Webhook not configured — silent skip
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'x-webhook-secret': webhookSecret,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'candidate.created',
          candidate: {
            id:          candidate.id,
            name:        candidate.name,
            email:       candidate.email,
            phone:       candidate.phone,
            position:    candidate.position,
            stage:       candidate.stage,
            experience:  candidate.experience,
            location:    candidate.location,
            source:      candidate.source,
            appliedDate: candidate.applied_date || candidate.appliedDate,
          },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    console.log('[RmsWebhook] Pushed candidate to Assessment Portal:', candidate.email);
  } catch (err) {
    // Non-blocking — log but don't crash
    console.error('[RmsWebhook] Push failed:', err.message);
  }
}

export default router;
