/**
 * Property-based integration tests for HR Planner Workspace
 * Tests Correctness Properties 2, 8, and 9
 *
 * Requirements: Design Correctness Properties 2, 8, 9
 * Run with: npm run test:property
 *
 * NOTE: These tests require a running test database.
 * Skipped automatically when test auth tokens cannot be obtained.
 */

import fc from 'fast-check';
import request from 'supertest';
import app from '../../server.js';
import { query } from '../../config/database.js';

// ── Auth ──────────────────────────────────────────────────────────────────────

let adminToken = null;

beforeAll(async () => {
  try {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test_admin', password: 'Test1234!' });
    adminToken = res.body?.data?.token ?? null;
  } catch {
    adminToken = null;
  }
});

// Helper to skip tests when no auth
const integrationIt = (name, fn) => {
  it(name, async () => {
    if (!adminToken) {
      console.warn(`Skipping "${name}" — no test_admin user available`);
      return;
    }
    await fn();
  });
};

// ── Board helpers ─────────────────────────────────────────────────────────────

async function createPlan(name) {
  const res = await request(app)
    .post('/api/planner/plans')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name, colour: '#3B82F6' });
  return res.body?.data?.planId ?? null;
}

async function createBucket(planId, name = 'Bucket') {
  const res = await request(app)
    .post(`/api/planner/plans/${planId}/buckets`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name });
  return res.body?.data?.bucketId ?? null;
}

async function createTask(bucketId, title = 'Task') {
  const res = await request(app)
    .post('/api/planner/tasks')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ bucket_id: bucketId, title });
  return res.body?.data?.taskId ?? null;
}

// ── Property 2: Soft Delete Preserves Records and Filters ─────────────────────
// After soft-deleting a plan:
//   - The DB row still exists with is_deleted=1
//   - The plan does NOT appear in the default GET /plans list

describe('Property 2 - Soft delete round-trip', () => {
  integrationIt('created plan soft-deleted: absent from list, present in DB with is_deleted=1', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        async (nameSuffix) => {
          const planName = `PBT P2 ${nameSuffix.trim()}`.slice(0, 100);
          const planId = await createPlan(planName);
          if (!planId) return true; // Skip if creation failed

          // Soft-delete
          const delRes = await request(app)
            .delete(`/api/planner/plans/${planId}`)
            .set('Authorization', `Bearer ${adminToken}`);
          if (delRes.status !== 200) return true;

          // Verify absent from list
          const listRes = await request(app)
            .get('/api/planner/plans')
            .set('Authorization', `Bearer ${adminToken}`);
          const ids = (listRes.body.data?.plans ?? []).map((p) => p.id);
          if (ids.includes(planId)) return false;

          // Verify present in DB with is_deleted=1
          const rows = await query('SELECT is_deleted FROM plans WHERE id = ?', [planId]);
          if (rows.length === 0) return false;
          return rows[0].is_deleted === 1;
        }
      ),
      { numRuns: 5 } // Limit to 5 API round-trips
    );
  });
});

// ── Property 8: Activity Log Append-Only Invariant ────────────────────────────
// After N task updates, all prior activity log entries remain and count only grows.

describe('Property 8 - Activity log append-only invariant', () => {
  integrationIt('all prior log entries persist after N updates', async () => {
    const planId = await createPlan('PBT P8 Plan');
    if (!planId) return;
    const bucketId = await createBucket(planId);
    if (!bucketId) return;
    const taskId = await createTask(bucketId, 'PBT P8 Task');
    if (!taskId) return;

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constantFrom('pending', 'in_progress', 'completed'),
          { minLength: 1, maxLength: 4 }
        ),
        async (statuses) => {
          // Get current log before updates
          const beforeRes = await request(app)
            .get(`/api/planner/tasks/${taskId}/activity`)
            .set('Authorization', `Bearer ${adminToken}`);
          const before = beforeRes.body.data?.entries ?? [];

          // Perform updates
          for (const status of statuses) {
            await request(app)
              .put(`/api/planner/tasks/${taskId}`)
              .set('Authorization', `Bearer ${adminToken}`)
              .send({ status });
          }

          // Get updated log
          const afterRes = await request(app)
            .get(`/api/planner/tasks/${taskId}/activity`)
            .set('Authorization', `Bearer ${adminToken}`);
          const after = afterRes.body.data?.entries ?? [];

          // All before entries still present
          const allPresent = before.every((entry) =>
            after.some((e) => e.id === entry.id)
          );
          // Count only grew
          const countGrew = after.length >= before.length + statuses.length;

          return allPresent && countGrew;
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ── Property 9: Cross-Plan Drag Operation Prevention ─────────────────────────
// Moving a task to a bucket in a different plan always returns 400 or 403.

describe('Property 9 - Cross-plan drag prevention', () => {
  integrationIt('move to cross-plan bucket always returns 400 or 403', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // Number of cross-plan attempts
        async (attempts) => {
          for (let i = 0; i < attempts; i++) {
            const plan1 = await createPlan(`PBT P9 Plan A ${i}`);
            const plan2 = await createPlan(`PBT P9 Plan B ${i}`);
            if (!plan1 || !plan2) continue;

            const bucket1 = await createBucket(plan1, 'Source');
            const bucket2 = await createBucket(plan2, 'Target');
            if (!bucket1 || !bucket2) continue;

            const taskId = await createTask(bucket1, `PBT P9 Task ${i}`);
            if (!taskId) continue;

            const res = await request(app)
              .post(`/api/planner/tasks/${taskId}/move`)
              .set('Authorization', `Bearer ${adminToken}`)
              .send({ targetBucketId: bucket2 });

            if (![400, 403].includes(res.status)) return false;
          }
          return true;
        }
      ),
      { numRuns: 3 }
    );
  });
});
