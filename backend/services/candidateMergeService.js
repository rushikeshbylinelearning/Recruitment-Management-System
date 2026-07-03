/**
 * Intelligent candidate merge orchestration: preview, execute, rollback, history.
 */

import { query, transaction } from '../config/database.js';
import { ensureMergeSchema } from './ensureMergeSchema.js';
import { ensureCandidateDuplicateColumns } from './duplicateCandidateService.js';
import {
  buildMergePreview,
  buildProfileSnapshot,
  buildAutoDecisionsFromPreview,
  resolveFieldValue,
  MERGE_STRATEGIES,
  PROFILE_FIELDS,
} from './candidateReconciliationEngine.js';
import {
  pickPrimaryForDuplicate,
  findMatchingCandidates,
  scoreMatches,
} from './candidateMatchService.js';
import { normalizeEmail } from '../utils/contactNormalizer.js';

const MERGEABLE_COLUMNS = new Set([
  'name',
  'email',
  'phone',
  'position',
  'experience',
  'salary_expected',
  'current_ctc',
  'location',
  'notice_period',
  'work_preference',
  'expertise',
  'resume_file_id',
]);

const RELINK_TABLES = [
  ['form_submissions', 'candidate_id'],
  ['candidate_applications', 'candidate_id'],
  ['candidate_notes', 'candidate_id'],
  ['candidate_assignments', 'candidate_id'],
  ['interviews', 'candidate_id'],
  ['communications', 'candidate_id'],
];

async function loadCandidateRow(candidateId, connection = null) {
  const exec = connection
    ? (sql, p) => connection.execute(sql, p).then(([r]) => r)
    : (sql, p) => query(sql, p);

  const rows = await exec('SELECT * FROM candidates WHERE id = ?', [candidateId]);
  return rows[0] || null;
}

async function loadResumeMeta(fileId, connection = null) {
  if (!fileId) return null;
  const exec = connection
    ? (sql, p) => connection.execute(sql, p).then(([r]) => r[0])
    : async (sql, p) => (await query(sql, p))[0];

  try {
    return await exec(
      `SELECT id, original_name AS original_filename, file_path AS file_url, uploaded_at
       FROM file_uploads WHERE id = ?`,
      [fileId]
    );
  } catch {
    return null;
  }
}

async function loadLinkedInFromApplications(candidateId, connection = null) {
  const exec = connection
    ? (sql, p) => connection.execute(sql, p).then(([r]) => r)
    : (sql, p) => query(sql, p);

  try {
    const rows = await exec(
      `SELECT linkedin_url, submitted_at, id, form_id
       FROM candidate_applications
       WHERE candidate_id = ? AND linkedin_url IS NOT NULL AND TRIM(linkedin_url) != ''
       ORDER BY submitted_at DESC LIMIT 1`,
      [candidateId]
    );
    return rows[0]?.linkedin_url || null;
  } catch {
    return null;
  }
}

async function loadApplications(candidateId, connection = null) {
  const exec = connection
    ? (sql, p) => connection.execute(sql, p).then(([r]) => r)
    : (sql, p) => query(sql, p);

  try {
    return await exec(
      `SELECT ca.id, ca.form_id, ca.submitted_at, ca.version, f.name AS form_name
       FROM candidate_applications ca
       LEFT JOIN forms f ON f.id = ca.form_id
       WHERE ca.candidate_id = ?
       ORDER BY ca.submitted_at DESC`,
      [candidateId]
    );
  } catch {
    return [];
  }
}

export async function loadEnrichedProfile(candidateId, connection = null) {
  const row = await loadCandidateRow(candidateId, connection);
  if (!row) return null;

  const [resumeMeta, linkedin, applications] = await Promise.all([
    loadResumeMeta(row.resume_file_id, connection),
    loadLinkedInFromApplications(candidateId, connection),
    loadApplications(candidateId, connection),
  ]);

  return buildProfileSnapshot(row, {
    linkedin_url: linkedin,
    resumeMeta,
    applications,
  });
}

async function collectRelinkSnapshot(duplicateId, connection) {
  const snapshot = [];
  for (const [table, col] of RELINK_TABLES) {
    try {
      const [rows] = await connection.execute(
        `SELECT id FROM ${table} WHERE ${col} = ?`,
        [duplicateId]
      );
      for (const row of rows) {
        snapshot.push({ table, id: row.id, column: col, previousCandidateId: duplicateId });
      }
    } catch {
      /* table may not exist */
    }
  }
  return snapshot;
}

async function syncResumeRecords(connection, primaryId, primaryRow, duplicateRow, primaryResumeId) {
  const entries = [
    { candidateId: primaryId, fileId: primaryRow.resume_file_id, row: primaryRow },
    { candidateId: primaryId, fileId: duplicateRow.resume_file_id, row: duplicateRow },
  ];

  for (const { fileId, row } of entries) {
    if (!fileId) continue;
    const meta = await loadResumeMeta(fileId, connection);
    const [existing] = await connection.execute(
      `SELECT id FROM candidate_resumes WHERE candidate_id = ? AND file_upload_id = ?`,
      [primaryId, fileId]
    );
    if (existing.length) {
      await connection.execute(
        `UPDATE candidate_resumes
         SET file_url = ?, original_filename = ?, uploaded_at = ?, is_primary = ?
         WHERE candidate_id = ? AND file_upload_id = ?`,
        [
          meta?.file_url || null,
          meta?.original_filename || null,
          meta?.uploaded_at || row.updated_at || null,
          fileId === primaryResumeId ? 1 : 0,
          primaryId,
          fileId,
        ]
      );
    } else {
      await connection.execute(
        `INSERT INTO candidate_resumes
         (candidate_id, file_upload_id, file_url, original_filename, uploaded_at, is_primary)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          primaryId,
          fileId,
          meta?.file_url || null,
          meta?.original_filename || null,
          meta?.uploaded_at || row.updated_at || null,
          fileId === primaryResumeId ? 1 : 0,
        ]
      );
    }
  }

  await connection.execute(
    `UPDATE candidate_resumes SET is_primary = 0 WHERE candidate_id = ?`,
    [primaryId]
  );
  if (primaryResumeId) {
    await connection.execute(
      `UPDATE candidate_resumes SET is_primary = 1 WHERE candidate_id = ? AND file_upload_id = ?`,
      [primaryId, primaryResumeId]
    );
  }
}

async function syncPositionRecords(connection, primaryId, positions, duplicateId) {
  for (const positionName of positions) {
    if (!positionName?.trim()) continue;
    await connection.execute(
      `INSERT IGNORE INTO candidate_positions (candidate_id, position_name, source_application_id)
       VALUES (?, ?, NULL)`,
      [primaryId, positionName.trim()]
    );
  }
}

async function recordFieldChange(connection, {
  candidateId,
  fieldName,
  oldValue,
  newValue,
  changedBy,
  mergeHistoryId,
}) {
  await connection.execute(
    `INSERT INTO candidate_field_history
     (candidate_id, field_name, old_value, new_value, source, changed_by, merge_history_id)
     VALUES (?, ?, ?, ?, 'merge', ?, ?)`,
    [
      candidateId,
      fieldName,
      oldValue == null ? null : String(oldValue),
      newValue == null ? null : String(newValue),
      changedBy,
      mergeHistoryId,
    ]
  );
}

export async function previewMerge(primaryId, duplicateId, strategy = MERGE_STRATEGIES.HR_REVIEW_REQUIRED) {
  await ensureMergeSchema();

  const [primary, duplicate] = await Promise.all([
    loadEnrichedProfile(primaryId),
    loadEnrichedProfile(duplicateId),
  ]);

  if (!primary || !duplicate) {
    throw new Error('Primary or duplicate candidate not found');
  }

  const preview = buildMergePreview(primary, duplicate, strategy);

  return {
    primaryId,
    duplicateId,
    primary: formatProfileForUi(primary),
    duplicate: formatProfileForUi(duplicate),
    ...preview,
  };
}

function formatProfileForUi(profile) {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    position: profile.position,
    stage: profile.stage,
    experience: profile.experience,
    salaryExpected: profile.salary_expected,
    currentCtc: profile.current_ctc,
    location: profile.location,
    noticePeriod: profile.notice_period,
    workPreference: profile.work_preference,
    expertise: profile.expertise,
    linkedinUrl: profile.linkedin_url,
    resumeFileId: profile.resume_file_id,
    resumeLabel: profile._resumeMeta?.original_filename || null,
    resumeUploadedAt: profile._resumeMeta?.uploaded_at || null,
    updatedAt: profile.updated_at,
    createdAt: profile.created_at,
    applications: profile._applications || [],
  };
}

export async function executeMerge({
  primaryId,
  duplicateId,
  strategy = MERGE_STRATEGIES.HR_REVIEW_REQUIRED,
  decisions = {},
  mergedBy = null,
}) {
  await ensureMergeSchema();
  await ensureCandidateDuplicateColumns();

  if (String(primaryId) === String(duplicateId)) {
    throw new Error('Cannot merge a candidate with itself');
  }

  const primaryRow = await loadCandidateRow(primaryId);
  if (!primaryRow) {
    throw new Error('Primary candidate profile was not found');
  }

  const duplicateRow = await loadCandidateRow(duplicateId);
  if (!duplicateRow) {
    const existing = await findCompletedMerge(primaryId, duplicateId);
    if (existing) {
      return {
        alreadyMerged: true,
        mergeHistoryId: existing.id,
        primaryCandidateId: primaryId,
        mergedCandidateId: duplicateId,
        fieldUpdates: {},
        positions: [],
        conflictCount: 0,
      };
    }
    throw new Error(
      'Duplicate application was not found. Refresh the page — it may already be merged.'
    );
  }

  const preview = await previewMerge(primaryId, duplicateId, strategy);

  return transaction(async (connection) => {
    const relinkSnapshot = await collectRelinkSnapshot(duplicateId, connection);

    const rollbackSnapshot = {
      primary: serializeRowForSnapshot(primaryRow),
      duplicate: serializeRowForSnapshot(duplicateRow),
      relinkSnapshot,
      timestamp: new Date().toISOString(),
    };

    const fieldUpdates = {};
    const appliedDecisions = [];

    for (const [fieldKey, resolution] of Object.entries(preview.fieldResolutions)) {
      if (fieldKey === 'position') continue;
      const resolved = resolveFieldValue(resolution, decisions);
      if (resolved.type === 'scalar' && resolved.field) {
        const col = resolved.field === 'skills' ? 'expertise' : resolved.field;
        if (!MERGEABLE_COLUMNS.has(col)) continue;
        if (col === 'email' && resolution.emailAlias) {
          const alias = normalizeEmail(resolution.emailAlias);
          if (alias && alias !== normalizeEmail(primaryRow.email)) {
            await connection.execute(
              `INSERT IGNORE INTO candidate_email_aliases (candidate_id, email, source)
               VALUES (?, ?, 'merge')`,
              [primaryId, resolution.emailAlias]
            );
          }
        }
        const oldVal = primaryRow[col];
        const newVal = normalizeFieldValue(resolved.value);
        if (!valuesChanged(oldVal, newVal)) continue;
        fieldUpdates[col] = newVal;
        appliedDecisions.push({ field: col, resolution, resolved });
      }
      if (resolved.type === 'resume') {
        fieldUpdates.resume_file_id = resolved.value;
        appliedDecisions.push({ field: 'resume_file_id', resolution, resolved });
      }
    }

    const positionDecision = decisions.position;
    const mergedPositions =
      positionDecision?.positions ||
      preview.positions.merged ||
      [primaryRow.position, duplicateRow.position].filter(Boolean);

    const setClauses = [];
    const setParams = [];
    for (const [col, val] of Object.entries(fieldUpdates)) {
      setClauses.push(`${col} = ?`);
      setParams.push(val ?? null);
    }

    setClauses.push('has_merged_applications = 1');
    setClauses.push('is_flagged_duplicate = 0');
    setClauses.push('duplicate_of_candidate_id = NULL');
    setClauses.push('duplicate_detected_at = NULL');
    setClauses.push('updated_at = NOW()');

    const mergeHistoryInsert = await connection.execute(
      `INSERT INTO candidate_merge_history
       (primary_candidate_id, merged_candidate_id, merge_strategy, merged_by,
        rollback_snapshot, conflict_snapshot, field_decisions)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        primaryId,
        duplicateId,
        strategy,
        mergedBy,
        JSON.stringify(rollbackSnapshot),
        JSON.stringify(preview.conflicts),
        JSON.stringify({ decisions, appliedDecisions }),
      ]
    );
    const mergeHistoryId = mergeHistoryInsert[0].insertId;

    if (setClauses.length > 0) {
      await connection.execute(
        `UPDATE candidates SET ${setClauses.join(', ')} WHERE id = ?`,
        [...setParams, primaryId]
      );
    }

    for (const { field, resolution } of appliedDecisions) {
      const col = field === 'skills' ? 'expertise' : field;
      try {
        await recordFieldChange(connection, {
          candidateId: primaryId,
          fieldName: col,
          oldValue: primaryRow[col],
          newValue: fieldUpdates[col],
          changedBy: mergedBy,
          mergeHistoryId,
        });
      } catch (err) {
        console.warn('[Merge] field history skipped:', col, err.message);
      }
    }

    const primaryResumeId =
      fieldUpdates.resume_file_id ?? primaryRow.resume_file_id ?? duplicateRow.resume_file_id;

    try {
      await syncResumeRecords(connection, primaryId, primaryRow, duplicateRow, primaryResumeId);
    } catch (err) {
      console.warn('[Merge] resume sync:', err.message);
    }
    try {
      await syncPositionRecords(connection, primaryId, mergedPositions, duplicateId);
    } catch (err) {
      console.warn('[Merge] position sync:', err.message);
    }

    for (const [table, col] of RELINK_TABLES) {
      try {
        await connection.execute(
          `UPDATE ${table} SET ${col} = ? WHERE ${col} = ?`,
          [primaryId, duplicateId]
        );
      } catch {
        /* optional */
      }
    }

    await connection.execute(
      `UPDATE candidates SET notes = CONCAT(
         COALESCE(notes, ''),
         '\n[Intelligent merge: ',
         ?,
         ' (',
         COALESCE(?, 'no email'),
         ') on ',
         DATE_FORMAT(NOW(), '%d %b %Y'),
         ' — strategy: ',
         ?,
         ']'
       ) WHERE id = ?`,
      [duplicateRow.name, duplicateRow.email, strategy, primaryId]
    );

    await connection.execute('DELETE FROM candidates WHERE id = ?', [duplicateId]);

    return {
      mergeHistoryId,
      primaryCandidateId: primaryId,
      mergedCandidateId: duplicateId,
      fieldUpdates,
      positions: mergedPositions,
      conflictCount: preview.conflicts.length,
    };
  });
}

function valuesChanged(a, b) {
  return String(a ?? '').trim() !== String(b ?? '').trim();
}

function serializeRowForSnapshot(row) {
  if (!row) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      out[key] = value.toISOString();
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      try {
        out[key] = JSON.parse(JSON.stringify(value));
      } catch {
        out[key] = String(value);
      }
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function findCompletedMerge(primaryId, duplicateId) {
  try {
    const rows = await query(
      `SELECT id, merged_at FROM candidate_merge_history
       WHERE primary_candidate_id = ? AND merged_candidate_id = ? AND is_rolled_back = 0
       ORDER BY merged_at DESC LIMIT 1`,
      [primaryId, duplicateId]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

function normalizeFieldValue(val) {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val.filter(Boolean).join(', ');
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return val;
}

export async function rollbackMerge(mergeHistoryId, rolledBackBy = null) {
  await ensureMergeSchema();

  const [history] = await query(
    `SELECT * FROM candidate_merge_history WHERE id = ? AND is_rolled_back = 0`,
    [mergeHistoryId]
  );
  if (!history) throw new Error('Merge history not found or already rolled back');

  const snapshot = JSON.parse(history.rollback_snapshot || '{}');
  const primary = snapshot.primary;
  const duplicate = snapshot.duplicate;

  if (!primary?.id || !duplicate?.id) {
    throw new Error('Invalid rollback snapshot');
  }

  return transaction(async (connection) => {
    const primaryCols = Object.keys(primary).filter(
      (k) => !['created_at'].includes(k) && primary[k] !== undefined
    );
    const setPrimary = primaryCols.map((c) => `${c} = ?`).join(', ');
    await connection.execute(`UPDATE candidates SET ${setPrimary} WHERE id = ?`, [
      ...primaryCols.map((c) => primary[c]),
      primary.id,
    ]);

    const [existingDup] = await connection.execute(
      'SELECT id FROM candidates WHERE id = ?',
      [duplicate.id]
    );
    if (!existingDup.length) {
      const dupCols = Object.keys(duplicate);
      const placeholders = dupCols.map(() => '?').join(', ');
      await connection.execute(
        `INSERT INTO candidates (${dupCols.join(', ')}) VALUES (${placeholders})`,
        dupCols.map((c) => duplicate[c])
      );
    }

    for (const link of snapshot.relinkSnapshot || []) {
      try {
        await connection.execute(
          `UPDATE ${link.table} SET ${link.column} = ? WHERE id = ?`,
          [link.previousCandidateId, link.id]
        );
      } catch {
        /* ignore */
      }
    }

    await connection.execute(
      `UPDATE candidate_merge_history
       SET is_rolled_back = 1, rolled_back_at = NOW(), rolled_back_by = ?
       WHERE id = ?`,
      [rolledBackBy, mergeHistoryId]
    );

    return { success: true, primaryId: primary.id, restoredDuplicateId: duplicate.id };
  });
}

export async function getMergeHistory(candidateId) {
  await ensureMergeSchema();
  const rows = await query(
    `SELECT h.*, u.name AS merged_by_name
     FROM candidate_merge_history h
     LEFT JOIN users u ON u.id = h.merged_by
     WHERE h.primary_candidate_id = ? OR h.merged_candidate_id = ?
     ORDER BY h.merged_at DESC
     LIMIT 50`,
    [candidateId, candidateId]
  );
  return rows.map((r) => ({
    id: r.id,
    primaryCandidateId: r.primary_candidate_id,
    mergedCandidateId: r.merged_candidate_id,
    mergeStrategy: r.merge_strategy,
    mergedBy: r.merged_by,
    mergedByName: r.merged_by_name,
    mergedAt: r.merged_at,
    isRolledBack: Boolean(r.is_rolled_back),
    rolledBackAt: r.rolled_back_at,
    conflictCount: r.conflict_snapshot ? JSON.parse(r.conflict_snapshot).length : 0,
  }));
}

export async function getResumeHistory(candidateId) {
  await ensureMergeSchema();
  try {
    const rows = await query(
      `SELECT cr.*, fu.original_name, fu.file_path
       FROM candidate_resumes cr
       LEFT JOIN file_uploads fu ON fu.id = cr.file_upload_id
       WHERE cr.candidate_id = ?
       ORDER BY cr.is_primary DESC, cr.uploaded_at DESC, cr.created_at DESC`,
      [candidateId]
    );
    return rows;
  } catch {
    const row = await loadCandidateRow(candidateId);
    if (!row?.resume_file_id) return [];
    const meta = await loadResumeMeta(row.resume_file_id);
    return [
      {
        candidate_id: candidateId,
        file_upload_id: row.resume_file_id,
        original_filename: meta?.original_filename,
        file_url: meta?.file_url,
        uploaded_at: meta?.uploaded_at,
        is_primary: 1,
      },
    ];
  }
}

export async function getCandidateTimeline(candidateId) {
  await ensureMergeSchema();
  const events = [];

  const applications = await loadApplications(candidateId);
  for (const app of applications) {
    events.push({
      type: 'application',
      date: app.submitted_at,
      title: `Applied${app.form_name ? ` — ${app.form_name}` : ''}`,
      meta: { applicationId: app.id, formId: app.form_id, version: app.version },
    });
  }

  const merges = await query(
    `SELECT id, merged_at, merge_strategy, merged_candidate_id, is_rolled_back
     FROM candidate_merge_history
     WHERE primary_candidate_id = ?
     ORDER BY merged_at DESC`,
    [candidateId]
  );
  for (const m of merges) {
    events.push({
      type: m.is_rolled_back ? 'merge_rollback' : 'merge',
      date: m.merged_at,
      title: m.is_rolled_back ? 'Merge rolled back' : 'Merged duplicate profile',
      meta: { mergeHistoryId: m.id, strategy: m.merge_strategy },
    });
  }

  const fieldHistory = await query(
    `SELECT field_name, new_value, created_at, source
     FROM candidate_field_history
     WHERE candidate_id = ?
     ORDER BY created_at DESC
     LIMIT 30`,
    [candidateId]
  );
  for (const f of fieldHistory) {
    if (f.field_name === 'resume_file_id') {
      events.push({
        type: 'resume_update',
        date: f.created_at,
        title: 'Resume updated',
        meta: { source: f.source },
      });
    }
  }

  events.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return events;
}

/**
 * Merge multiple duplicate profiles into one primary (oldest non-flagged wins).
 * Runs sequential merges so each pass enriches the surviving profile.
 */
export async function executeBatchMerge({
  primaryId,
  duplicateIds,
  strategy = MERGE_STRATEGIES.AUTO_SAFE,
  mergedBy = null,
}) {
  await ensureMergeSchema();
  await ensureCandidateDuplicateColumns();

  const unique = [...new Set((duplicateIds || []).map(String))].filter(
    (id) => id && id !== String(primaryId)
  );
  if (!unique.length) {
    throw new Error('No duplicate profiles to merge');
  }

  const dupRows = await query(
    `SELECT id, created_at, is_flagged_duplicate FROM candidates WHERE id IN (${unique.map(() => '?').join(',')})`,
    unique
  );
  const sorted = [...dupRows].sort((a, b) => {
    const aFlag = Number(a.is_flagged_duplicate) || 0;
    const bFlag = Number(b.is_flagged_duplicate) || 0;
    if (aFlag !== bFlag) return bFlag - aFlag;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });

  const merges = [];
  for (const row of sorted) {
    const preview = await previewMerge(primaryId, row.id, strategy);
    const decisions = buildAutoDecisionsFromPreview(preview);
    const result = await executeMerge({
      primaryId,
      duplicateId: row.id,
      strategy,
      decisions,
      mergedBy,
    });
    merges.push(result);
  }

  return {
    primaryCandidateId: primaryId,
    mergedCount: merges.length,
    merges,
  };
}

/**
 * Resolve duplicate cluster for a candidate (contact + flagged primary link).
 */
export async function findDuplicateClusterForCandidate(candidateId) {
  const rows = await query(
    `SELECT c.id, c.name, c.email, c.phone, c.position, c.stage, c.created_at,
            c.is_flagged_duplicate, c.duplicate_of_candidate_id
     FROM candidates c WHERE c.id = ?`,
    [candidateId]
  );
  const seed = rows[0];
  if (!seed) return { matches: [], suggestedPrimaryId: null, duplicateIds: [] };

  let raw = await findMatchingCandidates({
    email: seed.email,
    phone: seed.phone,
    linkedinUrl: null,
  });

  if (seed.duplicate_of_candidate_id) {
    const primaryRows = await query(
      `SELECT id, name, email, phone, position, stage, created_at, is_flagged_duplicate
       FROM candidates WHERE id = ?`,
      [seed.duplicate_of_candidate_id]
    );
    if (primaryRows[0] && !raw.some((r) => r.id === primaryRows[0].id)) {
      raw = [primaryRows[0], ...raw];
    }
  }

  const scored = scoreMatches(raw, {
    email: seed.email,
    phone: seed.phone,
    linkedinUrl: null,
  });

  const pool = scored.length >= 2 ? scored : raw.length >= 2 ? raw : scored.length ? scored : raw;

  const seen = new Set();
  const matches = [];
  for (const row of pool) {
    const id = row.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    matches.push(row);
  }

  matches.sort(
    (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
  );

  if (matches.length < 2) {
    return { matches: [], suggestedPrimaryId: null, duplicateIds: [] };
  }

  const primary = pickPrimaryForDuplicate(matches) || matches[0];
  const duplicateIds = matches.filter((m) => m.id !== primary.id).map((m) => m.id);

  return {
    matches: matches.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      position: m.position,
      stage: m.stage,
      isFlaggedDuplicate: Boolean(m.is_flagged_duplicate),
      createdAt: m.created_at,
    })),
    suggestedPrimaryId: primary.id,
    duplicateIds,
  };
}

export async function getCandidatePositions(candidateId) {
  await ensureMergeSchema();
  try {
    const rows = await query(
      `SELECT id, position_name, source_application_id, created_at
       FROM candidate_positions WHERE candidate_id = ? ORDER BY created_at ASC`,
      [candidateId]
    );
    if (rows.length) return rows;
  } catch {
    /* fall through */
  }
  const row = await loadCandidateRow(candidateId);
  if (row?.position) {
    return [{ position_name: row.position, created_at: row.created_at }];
  }
  return [];
}
