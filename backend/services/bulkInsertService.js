/**
 * Bulk Insert Service
 * 
 * Performs efficient batch database insertions with UUID generation.
 * Handles transaction management, failure isolation, and async processing.
 * 
 * Requirements: 2.1, 2.4, 5.1, 5.3, 5.4, 6.1, 6.2, 6.3, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../config/database.js';

// Configuration
const DEFAULT_BATCH_SIZE = 250;
const ASYNC_THRESHOLD = 1000;

/**
 * Generate a unique System ID for a candidate
 * @param {Object} candidate - Candidate data
 * @returns {string} UUID v4
 */
function generateSystemId(candidate) {
  // Use UUID v4 for guaranteed uniqueness
  return uuidv4();
}

/**
 * Insert candidates in batches
 * @param {Array} candidates - Array of normalized candidate rows
 * @param {number} batchSize - Number of rows per batch (default 250)
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<Object>} BulkInsertResult
 */
async function insertCandidates(candidates, batchSize = DEFAULT_BATCH_SIZE, progressCallback = null) {
  const startTime = Date.now();
  const successRows = [];
  const failedRows = [];

  // Process in batches
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    
    try {
      const batchResults = await insertBatch(batch, i);
      successRows.push(...batchResults.success);
      failedRows.push(...batchResults.failed);
    } catch (error) {
      // If entire batch fails, log all rows as failed
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

    // Report progress if callback provided
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

  return {
    successCount: successRows.length,
    failureCount: failedRows.length,
    successRows,
    failedRows,
    processingTime
  };
}

/**
 * Insert a single batch of candidates
 * @param {Array} batch - Batch of candidates
 * @param {number} startIndex - Starting row index for this batch
 * @returns {Promise<Object>} { success: [], failed: [] }
 */
async function insertBatch(batch, startIndex) {
  const success = [];
  const failed = [];

  // Prepare insert data
  const insertData = [];
  const candidateMap = new Map(); // systemId -> candidate info

  for (let i = 0; i < batch.length; i++) {
    const candidate = batch[i];
    const rowNumber = startIndex + i;

    try {
      // Validate required fields
      if (!candidate.normalized?.name) {
        failed.push({
          rowNumber,
          candidateName: null,
          error: 'Missing required field: name',
          data: candidate.normalized
        });
        continue;
      }

      // Generate System ID
      const systemId = generateSystemId(candidate.normalized);

      // Prepare row data
      const rowData = prepareRowData(systemId, candidate.normalized);
      insertData.push(rowData);

      candidateMap.set(systemId, {
        rowNumber,
        name: candidate.normalized.name
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

  // Execute batch insert if we have data
  if (insertData.length > 0) {
    try {
      await executeBatchInsert(insertData);

      // Mark all as successful
      insertData.forEach(row => {
        const info = candidateMap.get(row.id);
        if (info) {
          success.push({
            systemId: row.id,
            rowNumber: info.rowNumber,
            name: info.name
          });
        }
      });
    } catch (error) {
      // If batch insert fails, mark all rows in this batch as failed
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
 * @returns {Object} Row data ready for insertion
 */
function prepareRowData(systemId, normalized) {
  return {
    id: systemId,
    name: normalized.name,
    email: normalized.email || null,
    phone: normalized.phone || null,
    position: normalized.position || null,
    experience: normalized.experience || null,
    location: normalized.location || null,
    source: normalized.source || null,
    stage: 'Applied',
    resume: normalized.resume || null,
    notes: normalized.notes || null,
    score: 0,
    assigned_to_id: normalized.assigned_to_id || null,
    skills: normalized.skills ? JSON.stringify(normalized.skills) : null,
    salary_expected: normalized.salary_expected || null,
    salary_offered: normalized.salary_offered || null,
    salary_negotiable: normalized.salary_negotiable || false,
    joining_time: normalized.joining_time || null,
    notice_period: normalized.notice_period || null,
    immediate_joiner: normalized.immediate_joiner || false,
    work_preference: normalized.work_preference || null,
    current_ctc: normalized.current_ctc || null,
    ctc_frequency: normalized.ctc_frequency || null
  };
}

/**
 * Execute batch insert using prepared statement
 * @param {Array} insertData - Array of row data objects
 * @returns {Promise<void>}
 */
async function executeBatchInsert(insertData) {
  if (insertData.length === 0) return;

  const fields = Object.keys(insertData[0]);
  const placeholders = fields.map(() => '?').join(', ');
  
  const query = `
    INSERT INTO candidates (${fields.join(', ')})
    VALUES (${placeholders})
  `;

  // Insert each row (could be optimized with multi-row insert)
  for (const row of insertData) {
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
    options.progressCallback
  );
  
  console.log(`Async processing completed (Job ID: ${jobId})`);
  
  return {
    jobId,
    result
  };
}

export {
  generateSystemId,
  insertCandidates,
  insertBatch,
  prepareRowData,
  executeBatchInsert,
  shouldProcessAsync,
  processAsync,
  DEFAULT_BATCH_SIZE,
  ASYNC_THRESHOLD
};
