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
    const userId = req.user.userId;

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

    // Normalize data
    const normalizedRows = parsedFile.rows.map(row => {
      // Map row data according to field mappings
      const mappedData = {};
      mappingResult.mappings.forEach(mapping => {
        if (row[mapping.sourceColumn] !== undefined) {
          mappedData[mapping.targetField] = row[mapping.sourceColumn];
        }
      });
      
      return normalize(mappedData);
    });

    // Generate preview
    const preview = generatePreview(normalizedRows, mappingResult.mappings);

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
          uniqueCount: duplicateAnalysis.uniqueCandidates.length,
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
    const userId = req.user.userId;

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
      removeRows = []
    } = options;

    // Apply user-confirmed mappings if provided
    let finalMappings = mappings || cachedData.mappings;
    
    // Re-normalize data with confirmed mappings
    let normalizedRows = cachedData.parsedFile.rows.map(row => {
      const mappedData = {};
      finalMappings.forEach(mapping => {
        if (row[mapping.sourceColumn] !== undefined) {
          mappedData[mapping.targetField] = row[mapping.sourceColumn];
        }
      });
      
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
      const { jobId } = await processAsync(candidatesToImport, {
        userId,
        filename: cachedData.filename
      });

      // Clear cache
      uploadCache.delete(uploadId);

      return res.json({
        success: true,
        data: {
          processing: true,
          jobId,
          message: 'Import is being processed in the background. You will be notified when complete.'
        }
      });
    }

    // Process synchronously
    const startTime = Date.now();
    const insertResult = await insertCandidates(candidatesToImport);
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

    insertResult.successRows.forEach(() => {
      // Simplified quality calculation - can be enhanced
      qualityDistribution.medium++;
    });

    res.json({
      success: true,
      data: {
        importLogId,
        summary: {
          totalRows: normalizedRows.length,
          successCount: insertResult.successCount,
          failureCount: insertResult.failureCount,
          processingTime,
          qualityDistribution
        },
        failedRows: insertResult.failedRows.slice(0, 10) // Return first 10 failed rows
      },
      message: `Import completed. ${insertResult.successCount} candidates imported successfully.`
    });
  })
);

/**
 * GET /api/candidates/import/logs
 * Get import history with pagination
 */
router.get('/logs',
  authenticateToken,
  checkPermission('candidates', 'view'),
  asyncHandler(async (req, res) => {
    const userId = req.user.userId;
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
    const userId = req.user.userId;

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
    const userId = req.user.userId;

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
    const userId = req.user.userId;
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
    const userId = req.user.userId;
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
 * Helper function to save mapping preference
 */
async function saveMappingPreference(userId, mappingName, mappings) {
  // Check if mapping already exists
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
