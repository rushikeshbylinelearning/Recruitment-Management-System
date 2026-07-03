/**
 * Hiring Trends Analytics API
 * GET /api/candidates/hiring-trends
 *
 * Queries the candidates table directly (same source as the Candidates page and
 * Dashboard pipeline) — NOT the analytics aggregation tables.
 *
 * Date grouping is based on `created_at` which is always populated for every
 * candidate, regardless of how they were added (manual, bulk import, form).
 */

import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// ─── Dataset config ───────────────────────────────────────────────────────────

const DATASET_CONFIG = [
  { key: 'applied',   label: 'Applied Candidates',  color: '#3b82f6' },
  { key: 'interview', label: 'Interviews Scheduled', color: '#22c55e' },
  { key: 'offer',     label: 'Offers Released',      color: '#f97316' },
  { key: 'hired',     label: 'Hired Candidates',     color: '#ef4444' },
  { key: 'rejected',  label: 'Rejected',             color: '#a855f7' },
];

// Which stage values count for each dataset key
const STAGE_BUCKETS = {
  applied:   ['Applied'],
  interview: ['Interview'],
  offer:     ['Offer'],
  hired:     ['Hired'],
  rejected:  ['Rejected', 'On Hold', 'Profile Not Matched', 'Last Minute Back Out'],
};

const VALID_GROUP_BY = ['daily', 'weekly', 'monthly', 'quarterly'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeDate(raw, fallback) {
  if (!raw) return fallback;
  const s = String(raw).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fallback;
}

function defaultRange() {
  const today = new Date();
  const past  = new Date(today);
  past.setDate(past.getDate() - 89); // 90 days
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { startDate: fmt(past), endDate: fmt(today) };
}

/**
 * Return the SQL GROUP BY expression and a JS label formatter.
 * Uses DATE(created_at) as the base — always populated.
 */
function getGroupExpr(groupBy, col) {
  switch (groupBy) {
    case 'weekly':
      // Monday of the week
      return {
        expr: `DATE_FORMAT(DATE_SUB(DATE(${col}), INTERVAL WEEKDAY(${col}) DAY), '%Y-%m-%d')`,
        toLabel: (period) => {
          const d = new Date(period + 'T00:00:00');
          return `Wk ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        },
      };
    case 'monthly':
      return {
        expr: `DATE_FORMAT(${col}, '%Y-%m')`,
        toLabel: (period) => {
          const [y, m] = period.split('-');
          return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        },
      };
    case 'quarterly':
      return {
        expr: `CONCAT(YEAR(${col}), '-Q', QUARTER(${col}))`,
        toLabel: (period) => {
          const m = period.match(/^(\d{4})-Q?(\d)$/);
          return m ? `Q${m[2]} ${m[1]}` : period;
        },
      };
    default: // daily
      return {
        expr: `DATE(${col})`,
        toLabel: (period) => {
          const d = new Date(period + 'T00:00:00');
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        },
      };
  }
}

/**
 * Build all period-key strings for the requested range so that periods with
 * zero candidates still appear as 0 in the chart.
 */
function buildPeriodKeys(startDate, endDate, groupBy) {
  const keys = [];
  const start = new Date(startDate + 'T00:00:00');
  const end   = new Date(endDate   + 'T00:00:00');
  const fmt   = (d) => d.toISOString().slice(0, 10);

  if (groupBy === 'daily') {
    const cur = new Date(start);
    while (cur <= end) { keys.push(fmt(cur)); cur.setDate(cur.getDate() + 1); }

  } else if (groupBy === 'weekly') {
    // Snap to Monday
    const cur = new Date(start);
    const day = cur.getDay();
    cur.setDate(cur.getDate() - (day === 0 ? 6 : day - 1));
    while (cur <= end) { keys.push(fmt(cur)); cur.setDate(cur.getDate() + 7); }

  } else if (groupBy === 'monthly') {
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endM = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= endM) {
      keys.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
      cur.setMonth(cur.getMonth() + 1);
    }

  } else if (groupBy === 'quarterly') {
    let yr  = start.getFullYear();
    let qtr = Math.ceil((start.getMonth() + 1) / 3);
    const endYr  = end.getFullYear();
    const endQtr = Math.ceil((end.getMonth() + 1) / 3);
    while (yr < endYr || (yr === endYr && qtr <= endQtr)) {
      keys.push(`${yr}-Q${qtr}`);
      qtr++;
      if (qtr > 4) { qtr = 1; yr++; }
    }
  }
  return keys;
}

/**
 * Normalise a period string coming back from MySQL so it always matches the
 * keys produced by buildPeriodKeys.
 * e.g. MySQL quarterly: "2026-3" → "2026-Q3"
 *      MySQL Date obj:  Date(2026-04-01) → "2026-04-01"
 */
function normalisePeriod(raw) {
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const s = String(raw);
  // "2026-3" → "2026-Q3"  (quarterly without the Q prefix)
  return s.replace(/^(\d{4})-(\d)$/, '$1-Q$2');
}

// ─── Main trend query ─────────────────────────────────────────────────────────

/**
 * Count candidates per period for one set of stages.
 * Uses `created_at` as the date axis — same as the Candidates page.
 * Returns Map<periodKey, count>.
 */
async function fetchBucket({ stages, startDate, endDate, groupBy, recruiterId, jobId, department }) {
  if (!stages || stages.length === 0) return new Map();

  // Always use created_at — it is never NULL
  const col   = 'c.created_at';
  const { expr } = getGroupExpr(groupBy, col);

  const stagePlaceholders = stages.map(() => '?').join(', ');

  const where = [
    `DATE(${col}) >= ?`,
    `DATE(${col}) <= ?`,
    `c.stage IN (${stagePlaceholders})`,
  ];
  const params = [startDate, endDate, ...stages];

  if (recruiterId) {
    where.push('c.assigned_to = ?');
    params.push(recruiterId);
  }
  if (jobId) {
    where.push('c.job_id = ?');
    params.push(jobId);
  }

  let sql;
  if (department) {
    where.push('jp.department = ?');
    params.push(department);
    sql = `
      SELECT ${expr} AS period, COUNT(*) AS cnt
      FROM candidates c
      LEFT JOIN job_postings jp ON c.job_id = jp.id
      WHERE ${where.join(' AND ')}
      GROUP BY period
      ORDER BY period ASC
    `;
  } else {
    sql = `
      SELECT ${expr} AS period, COUNT(*) AS cnt
      FROM candidates c
      WHERE ${where.join(' AND ')}
      GROUP BY period
      ORDER BY period ASC
    `;
  }

  const rows = await query(sql, params);
  return new Map(rows.map((r) => [normalisePeriod(r.period), Number(r.cnt)]));
}

// ─── GET /  (main trends endpoint) ───────────────────────────────────────────

router.get('/', authenticateToken, checkPermission('candidates', 'view'), asyncHandler(async (req, res) => {
  const def = defaultRange();
  const startDate = safeDate(req.query.startDate, def.startDate);
  const endDate   = safeDate(req.query.endDate,   def.endDate);
  const rawGB     = String(req.query.groupBy || 'weekly').toLowerCase();
  const groupBy   = VALID_GROUP_BY.includes(rawGB) ? rawGB : 'weekly';

  const department = req.query.department ? String(req.query.department).trim() : null;
  const jobIdRaw   = req.query.jobId ? parseInt(req.query.jobId, 10) : null;
  const jobId      = Number.isFinite(jobIdRaw) ? jobIdRaw : null;

  // Status filter (comma-separated dataset keys)
  const statusRaw  = req.query.status ? String(req.query.status).split(',').map(s => s.trim()) : null;
  const activeKeys = statusRaw ? DATASET_CONFIG.filter(d => statusRaw.includes(d.key)) : DATASET_CONFIG;

  // Role-based recruiter scoping
  let recruiterId = null;
  if (req.user.role === 'Recruiter') {
    // Recruiter always sees only their own — never trust frontend param
    recruiterId = req.user.id;
  } else if (['Admin', 'HR Manager', 'HR Intern'].includes(req.user.role)) {
    if (req.query.recruiterId) {
      const rid = parseInt(req.query.recruiterId, 10);
      if (Number.isFinite(rid)) recruiterId = rid;
    }
  }

  // Fetch all buckets in parallel
  const bucketMaps = await Promise.all(
    activeKeys.map(ds => fetchBucket({
      stages: STAGE_BUCKETS[ds.key] || [],
      startDate, endDate, groupBy,
      recruiterId, jobId, department,
    }))
  );

  // Build aligned label + data arrays
  const periodKeys  = buildPeriodKeys(startDate, endDate, groupBy);
  const { toLabel } = getGroupExpr(groupBy, 'c.created_at');
  const labels      = periodKeys.map(toLabel);

  const datasets = activeKeys.map((ds, i) => ({
    key:   ds.key,
    label: ds.label,
    color: ds.color,
    data:  periodKeys.map(k => bucketMaps[i].get(k) ?? 0),
  }));

  res.json({
    success: true,
    data: { labels, datasets, meta: { startDate, endDate, groupBy, totalPoints: periodKeys.length } },
  });
}));

// ─── GET /recruiters ─────────────────────────────────────────────────────────

router.get('/recruiters', authenticateToken, checkPermission('candidates', 'view'), asyncHandler(async (req, res) => {
  if (!['Admin', 'HR Manager', 'HR Intern'].includes(req.user.role)) {
    return res.json({ success: true, data: [] });
  }
  const rows = await query(
    `SELECT id, name FROM users WHERE role IN ('Recruiter','Admin','HR Manager','HR Intern') AND status = 'Active' ORDER BY name ASC`
  );
  res.json({ success: true, data: rows });
}));

// ─── GET /departments ─────────────────────────────────────────────────────────

router.get('/departments', authenticateToken, checkPermission('candidates', 'view'), asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT DISTINCT department FROM job_postings WHERE department IS NOT NULL AND department != '' ORDER BY department ASC`
  );
  res.json({ success: true, data: rows.map(r => r.department) });
}));

// ─── GET /jobs ────────────────────────────────────────────────────────────────

router.get('/jobs', authenticateToken, checkPermission('candidates', 'view'), asyncHandler(async (req, res) => {
  const search = req.query.search ? `%${String(req.query.search).trim()}%` : null;
  const rows   = search
    ? await query(`SELECT id, title, department FROM job_postings WHERE title LIKE ? ORDER BY title ASC LIMIT 50`, [search])
    : await query(`SELECT id, title, department FROM job_postings ORDER BY title ASC LIMIT 100`);
  res.json({ success: true, data: rows });
}));

// ─── GET /debug ───────────────────────────────────────────────────────────────

router.get('/debug', authenticateToken, asyncHandler(async (req, res) => {
  const stageCounts = await query(`
    SELECT stage, COUNT(*) AS total,
      MIN(DATE(created_at)) AS min_created,
      MAX(DATE(created_at)) AS max_created
    FROM candidates
    GROUP BY stage
    ORDER BY total DESC
  `);
  const sample = await query(`
    SELECT id, name, stage, DATE(created_at) AS created
    FROM candidates ORDER BY created_at DESC LIMIT 5
  `);
  res.json({ success: true, data: { stageCounts, sample } });
}));

export default router;
