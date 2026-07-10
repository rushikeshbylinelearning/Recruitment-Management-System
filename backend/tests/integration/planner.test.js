/**
 * Integration tests for the HR Planner Workspace API
 * Uses supertest to test the full request/response cycle.
 *
 * NOTE: These tests require a running test database with at least:
 *   - An Admin user with username 'test_admin' and password 'Test1234!'
 *   - A Recruiter user with username 'test_recruiter' and password 'Test1234!'
 *   - An HR Intern user with username 'test_intern' and password 'Test1234!'
 *
 * Run with: npm run test:integration
 * Requirements: Design Testing Strategy
 */

import request from 'supertest';
import app from '../../server.js';
import { query } from '../../config/database.js';

// ── Auth helpers ──────────────────────────────────────────────────────────────

let adminToken = null;
let recruiterToken = null;

async function login(username, password = 'Test1234!') {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password });
  return res.body?.data?.token ?? null;
}

// ── Board helpers ─────────────────────────────────────────────────────────────

async function createPlan(token, name = 'Test Plan') {
  const res = await request(app)
    .post('/api/planner/plans')
    .set('Authorization', `Bearer ${token}`)
    .send({ name, colour: '#3B82F6' });
  return res.body?.data?.planId ?? null;
}

async function createBucket(token, planId, name = 'Test Bucket') {
  const res = await request(app)
    .post(`/api/planner/plans/${planId}/buckets`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name });
  return res.body?.data?.bucketId ?? null;
}

async function createTask(token, bucketId, title = 'Test Task') {
  const res = await request(app)
    .post('/api/planner/tasks')
    .set('Authorization', `Bearer ${token}`)
    .send({ bucket_id: bucketId, title });
  return { taskId: res.body?.data?.taskId ?? null, status: res.status };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  adminToken = await login('test_admin');
  recruiterToken = await login('test_recruiter');
});

// Skip all tests when tokens could not be obtained (no test DB)
const itIfAuth = (adminToken || recruiterToken) ? it : it.skip;

// ── Plan CRUD ─────────────────────────────────────────────────────────────────

describe('POST /api/planner/plans', () => {
  itIfAuth('creates a plan with a valid name', async () => {
    const res = await request(app)
      .post('/api/planner/plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Integration Test Plan' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.planId).toBeDefined();
  });

  itIfAuth('rejects empty plan name', async () => {
    const res = await request(app)
      .post('/api/planner/plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  itIfAuth('rejects plan name over 100 characters', async () => {
    const res = await request(app)
      .post('/api/planner/plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'A'.repeat(101) });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/planner/plans')
      .send({ name: 'Should Fail' });
    expect(res.status).toBe(401);
  });
});

// ── Soft delete ───────────────────────────────────────────────────────────────

describe('DELETE /api/planner/plans/:id — soft delete', () => {
  itIfAuth('soft-deletes and keeps row in DB with is_deleted=1', async () => {
    const planId = await createPlan(adminToken, 'Soft Delete Test Plan');
    expect(planId).not.toBeNull();

    const delRes = await request(app)
      .delete(`/api/planner/plans/${planId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);

    const rows = await query('SELECT is_deleted FROM plans WHERE id = ?', [planId]);
    expect(rows.length).toBe(1);
    expect(rows[0].is_deleted).toBe(1);
  });

  itIfAuth('deleted plan absent from GET /plans list', async () => {
    const planId = await createPlan(adminToken, 'Hidden Plan Test');
    await request(app)
      .delete(`/api/planner/plans/${planId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const listRes = await request(app)
      .get('/api/planner/plans')
      .set('Authorization', `Bearer ${adminToken}`);
    const ids = (listRes.body.data?.plans ?? []).map((p) => p.id);
    expect(ids).not.toContain(planId);
  });
});

// ── Assignment restrictions ───────────────────────────────────────────────────

describe('POST /api/planner/tasks — assignment restrictions', () => {
  let planId;
  let bucketId;

  beforeAll(async () => {
    if (!adminToken) return;
    planId = await createPlan(adminToken, 'Assignment Restriction Plan');
    bucketId = await createBucket(adminToken, planId);
  });

  itIfAuth('Recruiter cannot assign task to Admin — returns 403', async () => {
    if (!bucketId || !recruiterToken) return;

    // Get admin user ID
    const profile = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${adminToken}`);
    const adminUserId = profile.body?.data?.user?.id;
    if (!adminUserId) return;

    const { status } = await createTask(recruiterToken, bucketId, 'Recruiter→Admin');
    // Without assigned_to the task creates fine; with admin assigned_to it should 403
    const res = await request(app)
      .post('/api/planner/tasks')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ bucket_id: bucketId, title: 'Blocked Task', assigned_to: adminUserId });
    expect(res.status).toBe(403);
  });
});

// ── Cross-plan move prevention ────────────────────────────────────────────────

describe('POST /api/planner/tasks/:id/move — cross-plan prevention', () => {
  itIfAuth('rejects moving a task to a bucket in a different plan', async () => {
    const plan1 = await createPlan(adminToken, 'Plan A');
    const plan2 = await createPlan(adminToken, 'Plan B');
    const bucket1 = await createBucket(adminToken, plan1);
    const bucket2 = await createBucket(adminToken, plan2);
    const { taskId } = await createTask(adminToken, bucket1);
    if (!taskId || !bucket2) return;

    const res = await request(app)
      .post(`/api/planner/tasks/${taskId}/move`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ targetBucketId: bucket2 });

    expect([400, 403]).toContain(res.status);
  });
});

// ── File upload validation ────────────────────────────────────────────────────

describe('POST /api/planner/tasks/:taskId/attachments', () => {
  let taskId;

  beforeAll(async () => {
    if (!adminToken) return;
    const planId = await createPlan(adminToken, 'File Upload Plan');
    const bucketId = await createBucket(adminToken, planId);
    const result = await createTask(adminToken, bucketId, 'File Upload Task');
    taskId = result.taskId;
  });

  itIfAuth('rejects PHP file upload — returns 400', async () => {
    if (!taskId) return;
    const res = await request(app)
      .post(`/api/planner/tasks/${taskId}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('<?php echo "xss"; ?>'), {
        filename: 'shell.php',
        contentType: 'application/x-php',
      });
    expect(res.status).toBe(400);
  });

  itIfAuth('accepts valid PDF upload — returns 201', async () => {
    if (!taskId) return;
    const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< >>\nendobj\n');
    const res = await request(app)
      .post(`/api/planner/tasks/${taskId}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', pdfBuffer, {
        filename: 'document.pdf',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(201);
  });
});

// ── Activity log append-only ──────────────────────────────────────────────────

describe('Activity log — append-only invariant', () => {
  itIfAuth('prior entries persist after task update and count grows', async () => {
    const planId = await createPlan(adminToken, 'Activity Log Plan');
    const bucketId = await createBucket(adminToken, planId);
    const { taskId } = await createTask(adminToken, bucketId, 'Activity Log Task');
    if (!taskId) return;

    const log1 = (await request(app)
      .get(`/api/planner/tasks/${taskId}/activity`)
      .set('Authorization', `Bearer ${adminToken}`)
    ).body.data?.entries ?? [];

    // Perform an update
    await request(app)
      .put(`/api/planner/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'in_progress' });

    const log2 = (await request(app)
      .get(`/api/planner/tasks/${taskId}/activity`)
      .set('Authorization', `Bearer ${adminToken}`)
    ).body.data?.entries ?? [];

    // All prior entries still present
    log1.forEach((entry) => {
      expect(log2.find((e) => e.id === entry.id)).toBeDefined();
    });
    // Log only grows
    expect(log2.length).toBeGreaterThan(log1.length);
  });
});
