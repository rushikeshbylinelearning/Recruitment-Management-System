/**
 * Bulk Insert Service
 *
 * Performs efficient batch database insertions with UUID generation.
 * Handles transaction management, failure isolation, and async processing.
 * Now integrates with roleMatchingService for intelligent job auto-segregation.
 *
 * Requirements: 2.1, 2.4, 5.1, 5.3, 5.4, 6.1, 6.2, 6.3, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';
import {
  buildJobSegregationMap,
  getCandidateKey,
} from './roleMatchingService.js';
import { detectStage, getLegacyStage } from './stageMappingService.js';
import { insertHrNote, resolveHrNoteAuthorId } from './hrNotesSyncService.js';

// Configuration
const DEFAULT_BATCH_SIZE = 250;
const ASYNC_THRESHOLD = 1000;

/**
 * Generate a unique System ID for a candidate
 * @param {Object} candidate - Candidate data
 * @returns {string} UUID v4
 */
function generateSystemId(candidate) {
  return uuidv4();
}

/**
 * Build a position → job_id lookup map from active job postings.
 * Delegates to roleMatchingService for intelligent matching.
 * Kept for backward compatibility.
 * @param {Array} candidates - Normalized candidate rows
 * @param {number|null} jobIdOverride - Explicit job_id from import options
 * @returns {Promise<Map<string, number>>}
 */
async function buildJobLookupMap(candidates, jobIdOverride) {
  const { lookupMap } = await buildJobSegregationMap(candidates, jobIdOverride);
  return lookupMap;
}

/**
 * Insert candidates in batches
 * @param {Array} candidates - Array of normalized candidate rows
 * @param {number} batchSize - Number of rows per batch (default 250)
 * @param {Function} progressCallback - Optional callback for progress updates
 * @param {Object} options - Additional options (jobId override, authorId for notes)
 * @returns {Promise<Object>} BulkInsertResult with jobSegregation stats
 */
async function insertCandidates(candidates, batchSize = DEFAULT_BATCH_SIZE, progressCallback = null, options = {}) {
  const startTime = Date.now();
  const successRows = [];
  const failedRows = [];

  // Build intelligent job segregation map
  const jobIdOverride = options.jobId ? Number(options.jobId) : null;
  // authorId is used when inserting hr_notes for bulk-uploaded candidates.
  // Pass the logged-in user's ID here so notes are attributed to the importer.
  const authorId = await resolveHrNoteAuthorId(options.authorId);
  const { lookupMap: jobLookupMap, matchResults, jobs } = await buildJobSegregationMap(candidates, jobIdOverride);

  // Process in batches
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);

    try {
      const batchResults = await insertBatch(batch, i, jobIdOverride, jobLookupMap, matchResults, authorId);
      successRows.push(...batchResults.success);
      failedRows.push(...batchResults.failed);
    } catch (error) {
      console.error(`Batch ${i / batchSize + 1} failed:`, error);
      batch.forEach((candidate, batchIndex) => {
        failedRows.push({
          rowNumber: i + batchIndex,
          candidateName: candidate.normalized?.name || null,
          error: `Batch insert failed: ${error.message}`,
          data: candidate.normalized
        });
      });
    }

    if (progressCallback) {
      const processed = Math.min(i + batchSize, candidates.length);
      progressCallback({
        processed,
        total: candidates.length,
        percentage: Math.round((processed / candidates.length) * 100)
      });
    }
  }

  const processingTime = Date.now() - startTime;

  // Build job segregation summary
  const jobSegregation = buildSegregationSummary(successRows, jobs);

  return {
    successCount: successRows.length,
    failureCount: failedRows.length,
    successRows,
    failedRows,
    processingTime,
    jobSegregation,
  };
}

/**
 * Build a human-readable job segregation summary from inserted rows.
 * @param {Array} successRows - Successfully inserted rows with jobId info
 * @param {Array} jobs - Active job postings
 * @returns {Object} { mappedCount, unmappedCount, byJob: [{jobId, jobTitle, count, matchMethod}] }
 */
function buildSegregationSummary(successRows, jobs) {
  const jobMap = new Map(jobs.map(j => [j.id, j.title]));
  const byJobId = new Map(); // jobId → { jobTitle, count, matchMethod }

  let mappedCount = 0;
  let unmappedCount = 0;

  for (const row of successRows) {
    if (row.jobId) {
      mappedCount++;
      if (!byJobId.has(row.jobId)) {
        byJobId.set(row.jobId, {
          jobId: row.jobId,
          jobTitle: jobMap.get(row.jobId) || `Job #${row.jobId}`,
          count: 0,
          matchMethod: row.matchMethod || 'unknown',
        });
      }
      byJobId.get(row.jobId).count++;
    } else {
      unmappedCount++;
    }
  }

  return {
    mappedCount,
    unmappedCount,
    byJob: Array.from(byJobId.values()).sort((a, b) => b.count - a.count),
  };
}

/**
 * Insert a single batch of candidates
 * @param {Array} batch - Batch of candidates
 * @param {number} startIndex - Starting row index for this batch
 * @param {number|null} jobIdOverride - Explicit job_id for all candidates
 * @param {Map} jobLookupMap - Map of candidateKey → job_id
 * @param {Map} matchResults - Map of candidateKey → match info
 * @param {number|string|null} authorId - User ID to attribute hr_notes to
 * @returns {Promise<Object>} { success: [], failed: [] }
 */
async function insertBatch(batch, startIndex, jobIdOverride = null, jobLookupMap = new Map(), matchResults = new Map(), authorId = null) {
  const success = [];
  const failed = [];

  const insertData = [];
  const candidateMap = new Map(); // systemId -> candidate info

  for (let i = 0; i < batch.length; i++) {
    const candidate = batch[i];
    const rowNumber = startIndex + i;

    try {
      if (!candidate.normalized?.name) {
        failed.push({
          rowNumber,
          candidateName: null,
          error: 'Missing required field: name',
          data: candidate.normalized
        });
        continue;
      }

      const systemId = generateSystemId(candidate.normalized);

      // Resolve job_id using per-candidate key (new approach) or legacy position key
      const candidateKey = getCandidateKey(candidate.normalized, startIndex + i);
      const positionKey = (candidate.normalized.position || '').trim().toLowerCase();
      const expertiseKey = (candidate.normalized.expertise || '').trim().toLowerCase();

      const resolvedJobId = jobIdOverride
        || jobLookupMap.get(candidateKey)
        || jobLookupMap.get(positionKey)
        || jobLookupMap.get(expertiseKey)
        || candidate.normalized.job_id
        || null;

      const matchInfo = matchResults.get(candidateKey) || null;

      const rowData = prepareRowData(systemId, candidate.normalized, resolvedJobId, authorId);
      insertData.push(rowData);

      candidateMap.set(systemId, {
        rowNumber,
        name: candidate.normalized.name,
        jobId: resolvedJobId,
        matchMethod: matchInfo?.matchMethod || (resolvedJobId ? 'override' : null),
        matchScore: matchInfo?.score || null,
      });
    } catch (error) {
      failed.push({
        rowNumber,
        candidateName: candidate.normalized?.name || null,
        error: `Preparation failed: ${error.message}`,
        data: candidate.normalized
      });
    }
  }

  if (insertData.length > 0) {
    try {
      await executeBatchInsert(insertData);

      // ── FIX: Persist bulk-upload notes into hr_notes (single source of truth) ──
      // The NotesPanel and HR Notes Drawer both read from hr_notes via
      // GET /api/candidates/:id/hr-notes. Without this step, notes saved into
      // the candidates.notes column are invisible in the drawer.
      const notesInsertData = insertData
        .filter(row => row.notes && typeof row.notes === 'string' && row.notes.trim())
        .map(row => ({
          candidateId: row.id,
          stage: row.stage || 'Applied',  // Use detected stage, not hardcoded
          noteText: row.notes.trim(),
          authorId: authorId,
        }));

      if (notesInsertData.length > 0) {
        await insertBulkNotes(notesInsertData, authorId);
      }
      // ── END FIX ──

      insertData.forEach(row => {
        const info = candidateMap.get(row.id);
        if (info) {
          success.push({
            systemId: row.id,
            rowNumber: info.rowNumber,
            name: info.name,
            jobId: info.jobId,
            matchMethod: info.matchMethod,
            matchScore: info.matchScore,
          });
        }
      });
    } catch (error) {
      insertData.forEach(row => {
        const info = candidateMap.get(row.id);
        if (info) {
          failed.push({
            rowNumber: info.rowNumber,
            candidateName: info.name,
            error: `Database insert failed: ${error.message}`,
            data: row
          });
        }
      });
    }
  }

  return { success, failed };
}

/**
 * Prepare row data for database insertion
 * @param {string} systemId - Generated UUID
 * @param {Object} normalized - Normalized candidate data
 * @param {number|null} jobId - Optional job_id override
 * @returns {Object} Row data ready for insertion
 */
function prepareRowData(systemId, normalized, jobId = null, uploadedBy = null) {
  // Sanitize work_preference to only accepted ENUM values
  const WORK_PREF_ENUM = ['Onsite', 'WFH', 'Hybrid'];
  let workPref = null;
  if (normalized.work_preference) {
    const wp = normalized.work_preference.trim();
    // Case-insensitive match
    const match = WORK_PREF_ENUM.find(v => v.toLowerCase() === wp.toLowerCase());
    workPref = match || null;
  }

  // Sanitize ctc_frequency to only accepted ENUM values
  const CTC_FREQ_ENUM = ['Monthly', 'Annual'];
  let ctcFreq = null;
  if (normalized.ctc_frequency) {
    const cf = normalized.ctc_frequency.trim();
    const match = CTC_FREQ_ENUM.find(v => v.toLowerCase() === cf.toLowerCase());
    ctcFreq = match || null;
  }

  // Sanitize in_house_assignment_status to only accepted ENUM values
  const IHA_ENUM = ['Pending', 'Shortlisted', 'Rejected'];
  let ihaStatus = null;
  if (normalized.in_house_assignment) {
    const iha = normalized.in_house_assignment.trim();
    const match = IHA_ENUM.find(v => v.toLowerCase() === iha.toLowerCase());
    ihaStatus = match || null;
  }

  // ═══════════════════════════════════════════════════════════════
  // STAGE DETECTION INTEGRATION - COLOR-DRIVEN WORKFLOW SYSTEM
  // ═══════════════════════════════════════════════════════════════
  // IMPORTANT: Uses CANDIDATE NAME CELL COLOR as primary workflow identifier
  // Detect stage from Excel data (text + NAME cell color)
  let mainStage = 'applied';
  let subStage = null;
  let legacyStage = 'Applied';
  let stageConfidence = 0.3;
  let detectionMethod = 'fallback';

  // Extract stage text and colors from normalized data
  const stageText = normalized.stage || '';
  const cellColors = normalized.__cellColors || {};
  
  // CRITICAL: Extract color from CANDIDATE NAME column ONLY
  // Common name column headers: "Name", "Candidate Name", "Full Name", "Candidate", etc.
  // Also handles lowercase and mixed-case variants.
  const nameCellColor = cellColors['Name'] || 
                        cellColors['Candidate Name'] || 
                        cellColors['Full Name'] ||
                        cellColors['Candidate'] ||
                        cellColors['name'] ||
                        cellColors['candidate name'] ||
                        cellColors['full name'] ||
                        cellColors['candidate'] ||
                        cellColors['CANDIDATE NAME'] ||
                        cellColors['NAME'] ||
                        null;

  // Call stage detection service with NAME cell color
  if (stageText || nameCellColor) {
    const detectionResult = detectStage({
      cellValue: stageText,
      cellColor: nameCellColor,  // Use NAME cell color, not stage column color
      allowFuzzyMatch: true,
      confidenceThreshold: 0.7
    });

    // Use detected stage if confidence is acceptable
    if (detectionResult.confidence >= 0.4) {
      mainStage = detectionResult.mainStage;
      subStage = detectionResult.subStage;
      legacyStage = detectionResult.legacyStage;
      stageConfidence = detectionResult.confidence;
      detectionMethod = detectionResult.matchMethod;
    }
  }
  // ═══════════════════════════════════════════════════════════════

  return {
    id: systemId,
    name: normalized.name,
    email: normalized.email || null,
    phone: normalized.phone || null,
    position: normalized.position || null,
    experience: normalized.experience != null ? String(normalized.experience) : null,
    location: normalized.location || null,
    source: normalized.source || null,
    stage: legacyStage,  // Legacy column (synced by database trigger)
    main_stage: mainStage,  // Umbrella stage architecture
    sub_stage: subStage,    // Micro-stage within umbrella
    notes: normalized.notes || null,
    score: null,
    job_id: jobId || normalized.job_id || null,
    assigned_to: normalized.assigned_to_id || null,
    skills: normalized.skills ? JSON.stringify(normalized.skills) : null,
    expertise: normalized.expertise || null,
    salary_expected: normalized.salary_expected || null,
    salary_offered: normalized.salary_offered || null,
    salary_negotiable: normalized.salary_negotiable ? 1 : 0,
    joining_time: normalized.joining_time || null,
    notice_period: normalized.notice_period || null,
    immediate_joiner: normalized.immediate_joiner ? 1 : 0,
    willing_alternate_saturday: normalized.willing_alternate_saturday ? 1 : 0,
    work_preference: workPref,
    current_ctc: normalized.current_ctc || null,
    ctc_frequency: ctcFreq,
    in_house_assignment_status: ihaStatus,
    assignment_location: normalized.assignment_location || null,
    resume_location: normalized.resume_location || normalized.resume || null,
    // Track who uploaded this candidate to the portal
    uploaded_by: uploadedBy || null,
    // Store stage detection metadata for debugging/logging
    __stageConfidence: stageConfidence,
    __detectionMethod: detectionMethod,
    __nameCellColor: nameCellColor
  };
}

/**
 * Insert bulk-upload notes into the hr_notes table.
 * This ensures notes from Excel/CSV uploads are visible in the HR Notes Drawer
 * and Candidate Modal, which both read from hr_notes (single source of truth).
 *
 * @param {Array<{candidateId: string, stage: string, noteText: string}>} notesData
 * @returns {Promise<void>}
 */
async function insertBulkNotes(notesData, authorId) {
  if (!notesData || notesData.length === 0) return;

  for (const note of notesData) {
    await insertHrNote({
      candidateId: note.candidateId,
      noteText: note.noteText,
      stage: note.stage || 'Applied',
      authorId: note.authorId ?? authorId,
      interactionType: 'General Note',
    });
  }
}

/**
 * Execute batch insert using prepared statement
 * @param {Array} insertData - Array of row data objects
 * @returns {Promise<void>}
 */
async function executeBatchInsert(insertData) {
  if (insertData.length === 0) return;

  // Filter out metadata fields (starting with __)
  const cleanedData = insertData.map(row => {
    const cleaned = {};
    for (const [key, value] of Object.entries(row)) {
      if (!key.startsWith('__')) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  });

  const fields = Object.keys(cleanedData[0]);
  const placeholders = fields.map(() => '?').join(', ');
  
  const query = `
    INSERT INTO candidates (${fields.join(', ')})
    VALUES (${placeholders})
  `;

  // Insert each row (could be optimized with multi-row insert)
  for (const row of cleanedData) {
    const values = fields.map(field => row[field]);
    await db.query(query, values);
  }
}

/**
 * Check if file should be processed asynchronously
 * @param {number} rowCount - Number of rows in file
 * @returns {boolean} True if should process async
 */
function shouldProcessAsync(rowCount) {
  return rowCount > ASYNC_THRESHOLD;
}

/**
 * Process candidates asynchronously (for large files)
 * @param {Array} candidates - Array of normalized candidate rows
 * @param {Object} options - Processing options
 * @returns {Promise<string>} Job ID for tracking
 */
async function processAsync(candidates, options = {}) {
  // This would integrate with a job queue like Bull or Agenda
  // For now, we'll just process synchronously and return a mock job ID
  const jobId = uuidv4();
  
  // In a real implementation, this would:
  // 1. Create a job in the queue
  // 2. Return the job ID immediately
  // 3. Process in background
  // 4. Send notification on completion
  
  console.log(`Async processing started for ${candidates.length} candidates (Job ID: ${jobId})`);
  
  // For now, process synchronously
  const result = await insertCandidates(
    candidates,
    options.batchSize || DEFAULT_BATCH_SIZE,
    options.progressCallback,
    { jobId: options.jobId, authorId: options.authorId }
  );
  
  console.log(`Async processing completed (Job ID: ${jobId})`);
  
  return {
    jobId,
    result
  };
}

export {
  generateSystemId,
  buildJobLookupMap,
  buildSegregationSummary,
  insertCandidates,
  insertBatch,
  prepareRowData,
  executeBatchInsert,
  shouldProcessAsync,
  processAsync,
  DEFAULT_BATCH_SIZE,
  ASYNC_THRESHOLD
};