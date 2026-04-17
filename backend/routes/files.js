import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/errorHandler.js';
import fileStorageService from '../services/fileStorage.js';
import { query } from '../config/database.js';
import { validateUUID, handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

// Configure multer for memory storage (we'll handle file saving manually)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Upload resume file
router.post('/upload', authenticateToken, checkPermission('candidates', 'create'), upload.single('resume'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ValidationError('No file uploaded');
  }

  const { candidateId } = req.body;
  
  // Save file using our file storage service
  const result = await fileStorageService.saveFile(req.file, candidateId);
  
  if (!result.success) {
    throw new ValidationError(`File save failed: ${result.error}`);
  }

  // Store file metadata in database
  const fileMetadata = {
    filename: result.filename,
    original_name: result.originalName,
    file_path: result.filepath,
    file_size: result.size,
    mime_type: result.mimeType,
    candidate_id: candidateId || null,
    uploaded_by: req.user.id,
    uploaded_at: new Date()
  };

  const insertResult = await query(
    `INSERT INTO file_uploads (filename, original_name, file_path, file_size, mime_type, candidate_id, uploaded_by, uploaded_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fileMetadata.filename,
      fileMetadata.original_name,
      fileMetadata.file_path,
      fileMetadata.file_size,
      fileMetadata.mime_type,
      fileMetadata.candidate_id,
      fileMetadata.uploaded_by,
      fileMetadata.uploaded_at
    ]
  );


  res.json({
    success: true,
    message: 'File uploaded successfully',
    data: {
      fileId: insertResult.insertId, // Send database ID instead of filename
      originalName: result.originalName,
      size: result.size,
      uploadedAt: result.uploadedAt
    }
  });
}));

// View file inline (for in-browser preview — no download prompt)
router.get('/view/:filename', authenticateToken, checkPermission('candidates', 'view'), asyncHandler(async (req, res) => {
  const { filename } = req.params;

  // Try file_uploads table first (admin-uploaded files)
  let filePath = null;
  let mimeType = 'application/octet-stream';
  let originalName = filename;

  const adminFiles = await query('SELECT * FROM file_uploads WHERE filename = ?', [filename]);
  if (adminFiles.length > 0) {
    const rec = adminFiles[0];
    mimeType = rec.mime_type || mimeType;
    originalName = rec.original_name || filename;
    // Use stored file_path if it exists, otherwise fall back to service path
    const candidate1 = rec.file_path;
    const candidate2 = fileStorageService.getFilePath(filename);
    filePath = (candidate1 && fs.existsSync(candidate1)) ? candidate1
             : (fs.existsSync(candidate2) ? candidate2 : null);
  }

  // If not found in file_uploads, try candidate_assignment_files (submission files)
  if (!filePath) {
    const subFiles = await query(
      'SELECT * FROM candidate_assignment_files WHERE stored_filename = ?',
      [filename]
    );
    if (subFiles.length > 0) {
      const rec = subFiles[0];
      mimeType = rec.mime_type || mimeType;
      originalName = rec.original_filename || filename;
      filePath = (rec.storage_path && fs.existsSync(rec.storage_path)) ? rec.storage_path : null;
    }
  }

  if (!filePath) {
    // File is in DB but missing on disk — clean up the stale record(s) and return 404
    if (adminFiles.length > 0) {
      await query('DELETE FROM file_uploads WHERE filename = ?', [filename]).catch(() => {});
    } else {
      await query('DELETE FROM candidate_assignment_files WHERE stored_filename = ?', [filename]).catch(() => {});
    }
    return res.status(404).json({ success: false, message: 'File not found — stale record removed' });
  }

  // Stream the file inline (no download prompt)
  const stat = fs.statSync(filePath);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${originalName}"`);
  res.setHeader('Content-Length', stat.size);

  const stream = fs.createReadStream(filePath);
  stream.on('error', (err) => {
    console.error('File stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error serving file' });
    }
  });
  stream.pipe(res);
}));

// Download resume file
router.get('/download/:filename', authenticateToken, checkPermission('candidates', 'view'), asyncHandler(async (req, res) => {
  const { filename } = req.params;

  // Check if file exists in database
  const files = await query(
    'SELECT * FROM file_uploads WHERE filename = ?',
    [filename]
  );

  if (files.length === 0) {
    throw new NotFoundError('File not found');
  }

  const fileRecord = files[0];

  // Check if file exists on disk
  const exists = await fileStorageService.fileExists(filename);
  if (!exists) {
    throw new NotFoundError('File not found on disk');
  }

  // Get file path and serve file
  const filePath = fileStorageService.getFilePath(filename);
  
  res.download(filePath, fileRecord.original_name, (err) => {
    if (err) {
      console.error('File download error:', err);
      res.status(500).json({
        success: false,
        message: 'Error downloading file'
      });
    }
  });
}));

// Get file metadata
router.get('/metadata/:filename', authenticateToken, checkPermission('candidates', 'view'), asyncHandler(async (req, res) => {
  const { filename } = req.params;

  const files = await query(
    'SELECT * FROM file_uploads WHERE filename = ?',
    [filename]
  );

  if (files.length === 0) {
    throw new NotFoundError('File not found');
  }

  const fileRecord = files[0];
  const stats = await fileStorageService.getFileStats(filename);

  res.json({
    success: true,
    data: {
      filename: fileRecord.filename,
      originalName: fileRecord.original_name,
      size: fileRecord.file_size,
      mimeType: fileRecord.mime_type,
      uploadedAt: fileRecord.uploaded_at,
      uploadedBy: fileRecord.uploaded_by,
      candidateId: fileRecord.candidate_id,
      stats: stats.success ? stats.stats : null
    }
  });
}));

// Delete file
router.delete('/:filename', authenticateToken, checkPermission('candidates', 'delete'), asyncHandler(async (req, res) => {
  const { filename } = req.params;

  // Check if file exists in database
  const files = await query(
    'SELECT * FROM file_uploads WHERE filename = ?',
    [filename]
  );

  if (files.length === 0) {
    throw new NotFoundError('File not found');
  }

  // Delete from database
  await query('DELETE FROM file_uploads WHERE filename = ?', [filename]);

  // Delete from disk
  const deleteResult = await fileStorageService.deleteFile(filename);
  
  if (!deleteResult.success) {
    console.error('Failed to delete file from disk:', deleteResult.error);
  }

  res.json({
    success: true,
    message: 'File deleted successfully'
  });
}));

// Get files for a candidate
router.get('/candidate/:candidateId', authenticateToken, checkPermission('candidates', 'view'), validateUUID('candidateId'), handleValidationErrors, asyncHandler(async (req, res) => {
  const { candidateId } = req.params;

  const files = await query(
    `SELECT f.*, u.name as uploaded_by_name 
     FROM file_uploads f
     LEFT JOIN users u ON f.uploaded_by = u.id
     WHERE f.candidate_id = ?
     ORDER BY f.uploaded_at DESC`,
    [candidateId]
  );

  res.json({
    success: true,
    data: {
      files: files.map(file => ({
        filename: file.filename,
        originalName: file.original_name,
        size: file.file_size,
        mimeType: file.mime_type,
        uploadedAt: file.uploaded_at,
        uploadedByName: file.uploaded_by_name
      }))
    }
  });
}));

export default router;
