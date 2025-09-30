import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads/resumes');
const ensureUploadsDir = async () => {
  try {
    await fs.access(uploadsDir);
  } catch (error) {
    await fs.mkdir(uploadsDir, { recursive: true });
  }
};

// Initialize uploads directory
ensureUploadsDir();

class FileStorageService {
  constructor() {
    this.allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    this.allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
  }

  /**
   * Validate file type and size
   */
  validateFile(file) {
    const errors = [];

    // Check file size
    if (file.size > this.maxFileSize) {
      errors.push(`File size exceeds ${this.maxFileSize / (1024 * 1024)}MB limit`);
    }

    // Check MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} is not allowed`);
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!this.allowedExtensions.includes(ext)) {
      errors.push(`File extension ${ext} is not allowed`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate unique filename with UUID
   */
  generateFileName(originalName) {
    const ext = path.extname(originalName).toLowerCase();
    const uuid = uuidv4();
    return `${uuid}${ext}`;
  }

  /**
   * Save file to disk
   */
  async saveFile(file, candidateId = null) {
    try {
      // Ensure uploads directory exists
      await ensureUploadsDir();

      // Validate file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
      }

      // Generate unique filename
      const filename = this.generateFileName(file.originalname);
      const filepath = path.join(uploadsDir, filename);

      // Save file to disk
      await fs.writeFile(filepath, file.buffer);

      // Return file metadata
      return {
        success: true,
        filename,
        originalName: file.originalname,
        filepath,
        size: file.size,
        mimeType: file.mimetype,
        candidateId,
        uploadedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete file from disk
   */
  async deleteFile(filename) {
    try {
      const filepath = path.join(uploadsDir, filename);
      await fs.unlink(filepath);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get file path for serving
   */
  getFilePath(filename) {
    return path.join(uploadsDir, filename);
  }

  /**
   * Check if file exists
   */
  async fileExists(filename) {
    try {
      const filepath = path.join(uploadsDir, filename);
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats
   */
  async getFileStats(filename) {
    try {
      const filepath = path.join(uploadsDir, filename);
      const stats = await fs.stat(filepath);
      return {
        success: true,
        stats: {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Upload multiple files (for assignments)
   */
  async uploadFiles(req, res, options = {}) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      const uploadedFiles = [];
      const errors = [];

      for (const file of req.files) {
        const result = await this.saveFile(file, options.candidateId || options.assignmentId);
        
        if (result.success) {
          // Save file metadata to database
          const { query } = await import('../config/database.js');
          const fileRecord = await query(
            `INSERT INTO file_uploads (filename, original_name, file_path, file_size, mime_type, candidate_id, assignment_id, uploaded_by, uploaded_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              result.filename,
              result.originalName,
              result.filepath,
              result.size,
              result.mimeType,
              options.candidateId || null,
              options.assignmentId || null,
              req.user.id
            ]
          );

          uploadedFiles.push({
            id: fileRecord.insertId,
            filename: result.filename,
            originalName: result.originalName,
            fileSize: result.size,
            mimeType: result.mimeType,
            uploadedAt: result.uploadedAt
          });
        } else {
          errors.push({
            filename: file.originalname,
            error: result.error
          });
        }
      }

      return res.json({
        success: true,
        message: `Successfully uploaded ${uploadedFiles.length} files`,
        data: {
          uploadedFiles: uploadedFiles.map(file => ({
            id: file.id,
            filename: file.filename,
            originalName: file.originalName,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
            uploadedAt: file.uploadedAt
          })),
          errors: errors.length > 0 ? errors : undefined
        }
      });

    } catch (error) {
      console.error('File upload error:', error);
      return res.status(500).json({
        success: false,
        message: 'File upload failed',
        error: error.message
      });
    }
  }
}

export default new FileStorageService();
