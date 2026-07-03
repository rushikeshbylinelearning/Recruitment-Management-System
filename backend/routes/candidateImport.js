/**
 * Candidate Import Routes
 * 
 * API endpoints for the Intelligent Candidate Import System.
 * Handles file upload, preview, confirmation, import history, and mapping management.
 */

import express from 'express';
import multer from 'multer';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import fileParserService from '../services/fileParserService.js';
import fieldMapperService from '../services/fieldMapperService.js';
import { generatePreview } from '../services/previewGenerator.js';
import { detectDuplicates } from '../services/duplicateResolverService.js';
import { normalize } from '../services/dataNormalizerService.js';
import { insertCandidates, shouldProcessAsync, processAsync } from '../services/bulkInsertService.js';
import { logImport, getImportLogs, getFailedRows, downloadFailedRows } from '../services/importLoggerService.js';
import uploadCache from '../services/uploadCache.js';
import { query } from '../config/database.js';

const router = express.Router();

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept only CSV and Excel files
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExtension = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new ValidationError('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  }
});

/**
 * POST /api/candidates/import/upload
 * Upload and preview candidate file
 */
router.post('/upload',
  authenticateToken,
  checkPermission('candidates', 'create'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const { sheetIndex = 0 } = req.body;
    const userId = req.user.id;

    // Parse file
    const parsedFile = await fileParserService.parseFile(
      req.file.buffer,
      req.file.originalname,
      parseInt(sheetIndex) || 0
    );

    // Get user's saved mappings
    const savedMappings = await query(
      'SELECT source_column, target_field FROM field_mappings WHERE user_id = ? ORDER BY last_used DESC LIMIT 1',
      [userId]
    );

    const savedMappingData = savedMappings.length > 0 
      ? JSON.parse(savedMappings[0].source_column || '[]')
      : [];

    // Apply field mapping
    const mappingResult = fieldMapperService.mapFields(parsedFile.headers, savedMappingData);

    // Normalize data (used for duplicate detection and caching)
    // CRITICAL: preserve __cellColors so stage detection works in preview and on confirm
    const normalizedRows = parsedFile.rows.map(row => {
      const mappedData = {};
      mappingResult.mappings.forEach(mapping => {
        if (row[mapping.sourceColumn] !== undefined) {
          mappedData[mapping.targetField] = row[mapping.sourceColumn];
        }
      });
      // Carry cell color metadata through normalization
      if (row.__cellColors) {
        mappedData.__cellColors = row.__cellColors;
      }
      return normalize(mappedData);
    });

    // Generate preview from raw rows + mappings (previewGenerator handles mapping internally)
    const preview = await generatePreview(parsedFile.rows, mappingResult.mappings);

    // Detect duplicates
    const duplicateAnalysis = await detectDuplicates(normalizedRows);

    // Store parsed data in cache
    const uploadId = uploadCache.set({
      filename: req.file.originalname,
      parsedFile,
      normalizedRows,
      mappings: mappingResult.mappings,
      userId
    });

    // Return response
    res.json({
      success: true,
      data: {
        uploadId,
        fileInfo: {
          filename: req.file.originalname,
          fileType: parsedFile.fileType,
          totalRows: parsedFile.totalRows,
          sheetNames: parsedFile.sheetNames
        },
        mappings: mappingResult.mappings,
        unmappedColumns: mappingResult.unmappedColumns,
        conflicts: mappingResult.conflicts,
        preview,
        duplicates: {
          uniqueCandidates: duplicateAnalysis.uniqueCandidates,
          duplicatesInFile: duplicateAnalysis.duplicatesInFile,
          duplicatesInDatabase: duplicateAnalysis.duplicatesInDatabase
        }
      },
      message: 'File uploaded and parsed successfully'
    });
  })
);


/**
 * POST /api/candidates/import/confirm
 * Confirm and execute import
 */
router.post('/confirm',
  authenticateToken,
  checkPermission('candidates', 'create'),
  asyncHandler(async (req, res) => {
    const { uploadId, mappings, options = {} } = req.body;
    const userId = req.user.id;

    if (!uploadId) {
      throw new ValidationError('Upload ID is required');
    }

    // Retrieve cached data
    const cachedData = uploadCache.get(uploadId);
    if (!cachedData) {
      throw new NotFoundError('Upload session expired or not found. Please upload the file again.');
    }

    // Verify user owns this upload
    if (cachedData.userId !== userId) {
      throw new ValidationError('Unauthorized access to upload session');
    }

    const {
      saveMappings = false,
      mappingName = '',
      duplicateHandling = 'skip',
      removeRows = [],
      jobId = null
    } = options;

    // Apply user-confirmed mappings if provided
    let finalMappings = mappings || cachedData.mappings;
    
    // Re-normalize data with confirmed mappings.
    // CRITICAL: __cellColors must be carried through from the raw parsed row
    // so that bulkInsertService can read the candidate name cell color for
    // stage detection. Without this, every candidate falls back to 'Applied'.
    let normalizedRows = cachedData.parsedFile.rows.map(row => {
      const mappedData = {};
      finalMappings.forEach(mapping => {
        if (row[mapping.sourceColumn] !== undefined) {
          mappedData[mapping.targetField] = row[mapping.sourceColumn];
        }
      });

      // Preserve cell color metadata — NOT a user field, never overwritten by mappings
      if (row.__cellColors) {
        mappedData.__cellColors = row.__cellColors;
      }
      
      return normalize(mappedData);
    });

    // Remove rows if requested
    if (removeRows.length > 0) {
      normalizedRows = normalizedRows.filter((_, index) => !removeRows.includes(index));
    }

    // Handle duplicates based on user preference
    const duplicateAnalysis = await detectDuplicates(normalizedRows);
    let candidatesToImport = [];

    if (duplicateHandling === 'skip') {
      // Only import unique candidates
      candidatesToImport = duplicateAnalysis.uniqueCandidates;
    } else if (duplicateHandling === 'allow_all') {
      // Import all candidates (including duplicates)
      candidatesToImport = normalizedRows;
    } else if (duplicateHandling === 'merge') {
      // For now, treat merge as skip (merge logic can be implemented later)
      candidatesToImport = duplicateAnalysis.uniqueCandidates;
    }

    // Check if should process asynchronously
    const isAsync = shouldProcessAsync(candidatesToImport.length);

    if (isAsync) {
      // Process asynchronously for large files
      const { jobId: asyncJobId } = await processAsync(candidatesToImport, {
        userId,
        filename: cachedData.filename,
        jobId,
        authorId: userId
      });

      // Clear cache
      uploadCache.delete(uploadId);

      return res.json({
        success: true,
        data: {
          processing: true,
          jobId: asyncJobId,
          message: 'Import is being processed in the background. You will be notified when complete.'
        }
      });
    }

    // Process synchronously
    const startTime = Date.now();
    const insertResult = await insertCandidates(candidatesToImport, undefined, null, { jobId, authorId: userId });
    const processingTime = Date.now() - startTime;

    // Log import
    const importLogId = await logImport({
      userId,
      filename: cachedData.filename,
      totalRows: normalizedRows.length,
      successCount: insertResult.successCount,
      failureCount: insertResult.failureCount,
      failedRows: insertResult.failedRows,
      processingTime
    });

    // Save mappings if requested
    if (saveMappings && mappingName) {
      await saveMappingPreference(userId, mappingName, finalMappings);
    }

    // Clear cache
    uploadCache.delete(uploadId);

    // Calculate quality distribution
    const qualityDistribution = {
      high: 0,
      medium: 0,
      low: 0
    };

    insertResult.successRows.forEach((row) => {
      // Quality based on how many key fields are present
      const norm = row.normalized || {};
      const filledFields = ['email', 'phone', 'position', 'experience', 'skills'].filter(f => norm[f]).length;
      if (filledFields >= 4) qualityDistribution.high++;
      else if (filledFields >= 2) qualityDistribution.medium++;
      else qualityDistribution.low++;
    });

    // Build job segregation summary for the response
    const jobSegregation = insertResult.jobSegregation || {
      mappedCount: 0,
      unmappedCount: insertResult.successCount,
      byJob: [],
    };

    res.json({
      success: true,
      data: {
        importLogId,
        summary: {
          totalRows: normalizedRows.length,
          successCount: insertResult.successCount,
          failureCount: insertResult.failureCount,
          processingTime,
          qualityDistribution,
          jobSegregation,
        },
        failedRows: insertResult.failedRows.slice(0, 10),
      },
      message: `Import completed. ${insertResult.successCount} candidates imported successfully.`
    });  })
);

/**
 * GET /api/candidates/import/logs
 * Get import history with pagination
 */
router.get('/logs',
  authenticateToken,
  checkPermission('candidates', 'view'),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate
    } = req.query;

    const result = await getImportLogs(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: result
    });
  })
);

/**
 * GET /api/candidates/import/logs/:id/failed-rows
 * Download failed rows as CSV
 */
router.get('/logs/:id/failed-rows',
  authenticateToken,
  checkPermission('candidates', 'view'),
  asyncHandler(async (req, res) => {
    const importId = parseInt(req.params.id);
    const userId = req.user.id;

    // Verify user has access to this import log
    const logs = await query(
      'SELECT id, user_id, filename FROM import_logs WHERE id = ?',
      [importId]
    );

    if (logs.length === 0) {
      throw new NotFoundError('Import log not found');
    }

    if (logs[0].user_id !== userId && req.user.role !== 'Admin') {
      throw new ValidationError('Unauthorized access to import log');
    }

    // Get failed rows as CSV
    const csvBuffer = await downloadFailedRows(importId);
    const filename = `failed_rows_${importId}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvBuffer);
  })
);


/**
 * GET /api/candidates/import/mappings
 * Get user's saved mappings
 */
router.get('/mappings',
  authenticateToken,
  checkPermission('candidates', 'view'),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const mappings = await query(
      `SELECT id, mapping_name, source_column, target_field, created_at, last_used
       FROM field_mappings
       WHERE user_id = ?
       ORDER BY last_used DESC`,
      [userId]
    );

    // Parse JSON fields
    const parsedMappings = mappings.map(m => ({
      id: m.id,
      name: m.mapping_name,
      mappings: JSON.parse(m.source_column || '[]'),
      createdAt: m.created_at,
      lastUsed: m.last_used
    }));

    res.json({
      success: true,
      data: {
        mappings: parsedMappings
      }
    });
  })
);

/**
 * POST /api/candidates/import/mappings
 * Save a new mapping
 */
router.post('/mappings',
  authenticateToken,
  checkPermission('candidates', 'create'),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { name, mappings } = req.body;

    if (!name || !mappings) {
      throw new ValidationError('Mapping name and mappings are required');
    }

    if (!Array.isArray(mappings)) {
      throw new ValidationError('Mappings must be an array');
    }

    // Check if mapping name already exists for this user
    const existing = await query(
      'SELECT id FROM field_mappings WHERE user_id = ? AND mapping_name = ?',
      [userId, name]
    );

    if (existing.length > 0) {
      throw new ValidationError('A mapping with this name already exists');
    }

    // Insert new mapping
    const result = await query(
      `INSERT INTO field_mappings (user_id, mapping_name, source_column, target_field)
       VALUES (?, ?, ?, ?)`,
      [userId, name, JSON.stringify(mappings), '']
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        name,
        mappings
      },
      message: 'Mapping saved successfully'
    });
  })
);

/**
 * DELETE /api/candidates/import/mappings/:id
 * Delete a saved mapping
 */
router.delete('/mappings/:id',
  authenticateToken,
  checkPermission('candidates', 'delete'),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const mappingId = parseInt(req.params.id);

    // Verify user owns this mapping
    const mappings = await query(
      'SELECT id FROM field_mappings WHERE id = ? AND user_id = ?',
      [mappingId, userId]
    );

    if (mappings.length === 0) {
      throw new NotFoundError('Mapping not found or unauthorized');
    }

    // Delete mapping
    await query('DELETE FROM field_mappings WHERE id = ?', [mappingId]);

    res.json({
      success: true,
      message: 'Mapping deleted successfully'
    });
  })
);

/**
 * GET /api/candidates/import/unassigned
 * Get candidates that have no job assignment (unassigned pool)
 */
router.get('/unassigned',
  authenticateToken,
  checkPermission('candidates', 'view'),
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE c.job_id IS NULL';
    const params = [];

    if (search) {
      whereClause += ' AND (c.name LIKE ? OR c.position LIKE ? OR c.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM candidates c ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    const candidates = await query(
      `SELECT c.id, c.name, c.email, c.phone, c.position, c.expertise, c.skills, c.stage, c.applied_date
       FROM candidates c
       ${whereClause}
       ORDER BY c.applied_date DESC
       LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      params
    );

    // Parse skills JSON
    candidates.forEach(c => {
      try { c.skills = JSON.parse(c.skills || '[]'); } catch { c.skills = []; }
    });

    // Fetch active jobs for the reassignment dropdown
    const jobs = await query(
      `SELECT id, title, department FROM job_postings WHERE status = 'Active' ORDER BY title ASC`
    );

    res.json({
      success: true,
      data: {
        candidates,
        jobs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  })
);

/**
 * POST /api/candidates/import/reassign
 * Manually reassign one or more unassigned candidates to a job
 * Body: { candidateIds: string[], jobId: number }
 */
router.post('/reassign',
  authenticateToken,
  checkPermission('candidates', 'edit'),
  asyncHandler(async (req, res) => {
    const { candidateIds, jobId } = req.body;

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      throw new ValidationError('candidateIds must be a non-empty array');
    }

    if (!jobId) {
      throw new ValidationError('jobId is required');
    }

    // Verify job exists
    const jobs = await query('SELECT id, title FROM job_postings WHERE id = ?', [jobId]);
    if (jobs.length === 0) {
      throw new NotFoundError('Job posting not found');
    }

    // Update candidates
    const placeholders = candidateIds.map(() => '?').join(', ');
    await query(
      `UPDATE candidates SET job_id = ?, position = COALESCE(NULLIF(position, ''), ?) WHERE id IN (${placeholders})`,
      [jobId, jobs[0].title, ...candidateIds]
    );

    res.json({
      success: true,
      data: {
        updatedCount: candidateIds.length,
        jobId,
        jobTitle: jobs[0].title,
      },
      message: `${candidateIds.length} candidate(s) reassigned to "${jobs[0].title}"`,
    });
  })
);

/**
 * POST /api/candidates/import/job-segregation-preview/:uploadId
 * Preview how candidates from a cached upload would be segregated into jobs.
 * Accepts the current field mappings so the preview always reflects the user's
 * latest mapping choices — including manual overrides made in the UI.
 *
 * Body: { mappings?: FieldMapping[] }  (optional — falls back to cached mappings)
 */
router.post('/job-segregation-preview/:uploadId',
  authenticateToken,
  checkPermission('candidates', 'view'),
  asyncHandler(async (req, res) => {
    const { uploadId } = req.params;
    const { mappings: clientMappings } = req.body;

    const cachedData = uploadCache.get(uploadId);
    if (!cachedData) {
      throw new NotFoundError('Upload session expired or not found.');
    }

    if (cachedData.userId !== req.user.id) {
      throw new ValidationError('Unauthorized access to upload session');
    }

    // Use client-supplied mappings if provided, otherwise fall back to cached ones.
    // This is the key fix: the preview re-normalizes with the CURRENT mappings so
    // manual field mapping changes (e.g. "Expertise → position") are reflected
    // immediately in the segregation preview.
    const activeMappings = (Array.isArray(clientMappings) && clientMappings.length > 0)
      ? clientMappings
      : cachedData.mappings;

    // Re-normalize raw rows with the active mappings
    const freshNormalizedRows = cachedData.parsedFile.rows.map(row => {
      const mappedData = {};
      activeMappings.forEach(mapping => {
        if (mapping.sourceColumn && mapping.targetField && row[mapping.sourceColumn] !== undefined) {
          mappedData[mapping.targetField] = row[mapping.sourceColumn];
        }
      });
      return normalize(mappedData);
    });

    const { buildJobSegregationMap, getCandidateKey } = await import('../services/roleMatchingService.js');
    const { matchResults, jobs } = await buildJobSegregationMap(freshNormalizedRows, null);

    // Build preview summary
    const byJob = new Map();
    let unmappedCount = 0;

    freshNormalizedRows.forEach((row, idx) => {
      const norm = row.normalized || {};
      const key = getCandidateKey(norm, idx);
      const match = matchResults.get(key);

      if (match) {
        if (!byJob.has(match.jobId)) {
          byJob.set(match.jobId, {
            jobId: match.jobId,
            jobTitle: match.jobTitle,
            count: 0,
            matchMethod: match.matchMethod,
          });
        }
        byJob.get(match.jobId).count++;
      } else {
        unmappedCount++;
      }
    });

    res.json({
      success: true,
      data: {
        totalCandidates: freshNormalizedRows.length,
        mappedCount: freshNormalizedRows.length - unmappedCount,
        unmappedCount,
        byJob: Array.from(byJob.values()).sort((a, b) => b.count - a.count),
        availableJobs: jobs.map(j => ({ id: j.id, title: j.title })),
      },
    });
  })
);

/**
 * Helper function to save mapping preference
 */
async function saveMappingPreference(userId, mappingName, mappings) {  // Check if mapping already exists
  const existing = await query(
    'SELECT id FROM field_mappings WHERE user_id = ? AND mapping_name = ?',
    [userId, mappingName]
  );

  if (existing.length > 0) {
    // Update existing mapping
    await query(
      `UPDATE field_mappings 
       SET source_column = ?, last_used = NOW()
       WHERE id = ?`,
      [JSON.stringify(mappings), existing[0].id]
    );
  } else {
    // Insert new mapping
    await query(
      `INSERT INTO field_mappings (user_id, mapping_name, source_column, target_field)
       VALUES (?, ?, ?, ?)`,
      [userId, mappingName, JSON.stringify(mappings), '']
    );
  }
}

export default router;