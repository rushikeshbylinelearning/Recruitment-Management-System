/**
 * storageService.js
 *
 * Storage service abstraction for file operations in the HR Planner Workspace.
 * Handles file uploads, downloads, deletion, and validation.
 *
 * Storage structure: storage/tasks/{taskId}/attachments/{category}/{uuid}.{ext}
 * Files are stored outside the webroot for security.
 *
 * Requirements: R8 (File Attachment System), R20 (Future Extensibility)
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Allowed file types with their MIME types and extensions.
 * Maps MIME type prefixes to their categories for directory organization.
 */
const ALLOWED_FILE_TYPES = {
  // Images
  'image/png': { extensions: ['.png'], category: 'images' },
  'image/jpeg': { extensions: ['.jpg', '.jpeg'], category: 'images' },
  'image/webp': { extensions: ['.webp'], category: 'images' },
  
  // Documents
  'application/pdf': { extensions: ['.pdf'], category: 'pdf' },
  'application/msword': { extensions: ['.doc'], category: 'word' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extensions: ['.docx'], category: 'word' },
  
  // Excel
  'application/vnd.ms-excel': { extensions: ['.xls'], category: 'excel' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { extensions: ['.xlsx'], category: 'excel' },
  'text/csv': { extensions: ['.csv'], category: 'excel' },
  
  // PowerPoint
  'application/vnd.ms-powerpoint': { extensions: ['.ppt'], category: 'documents' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { extensions: ['.pptx'], category: 'documents' },
  
  // Text and Archives
  'text/plain': { extensions: ['.txt'], category: 'documents' },
  'application/zip': { extensions: ['.zip'], category: 'zip' },
  'application/x-zip-compressed': { extensions: ['.zip'], category: 'zip' },
};

/**
 * Default maximum file size: 10MB
 * Can be overridden via MAX_FILE_SIZE environment variable (in bytes)
 */
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

/**
 * Get the workspace root directory (two levels up from backend/services)
 */
function getWorkspaceRoot() {
  return path.resolve(__dirname, '..', '..');
}

/**
 * StorageService class for file operations
 */
class StorageService {
  /**
   * Get the configured maximum file size
   * @returns {number} Maximum file size in bytes
   */
  getMaxFileSize() {
    const envSize = process.env.MAX_FILE_SIZE;
    if (envSize && !isNaN(parseInt(envSize, 10))) {
      return parseInt(envSize, 10);
    }
    return DEFAULT_MAX_FILE_SIZE;
  }

  /**
   * Validate a file upload by checking:
   * - File extension is in the allowed list
   * - MIME type is in the allowed list
   * - Extension matches the MIME type
   * - File size is within limits
   *
   * @param {string} originalFilename - Original filename from upload
   * @param {string} mimeType - MIME type from upload
   * @param {number} [fileSize] - Optional file size in bytes
   * @returns {{ valid: boolean, error?: string, category?: string }} Validation result
   */
  validateFileUpload(originalFilename, mimeType, fileSize = null) {
    if (!originalFilename || typeof originalFilename !== 'string') {
      return { valid: false, error: 'Filename is required' };
    }

    if (!mimeType || typeof mimeType !== 'string') {
      return { valid: false, error: 'MIME type is required' };
    }

    // Extract file extension (lowercase, with leading dot)
    const ext = path.extname(originalFilename).toLowerCase();
    if (!ext) {
      return { valid: false, error: 'File must have an extension' };
    }

    // Check if MIME type is allowed
    const fileTypeConfig = ALLOWED_FILE_TYPES[mimeType];
    if (!fileTypeConfig) {
      return { valid: false, error: `File type not allowed: ${mimeType}` };
    }

    // Check if extension matches the MIME type
    if (!fileTypeConfig.extensions.includes(ext)) {
      return { valid: false, error: `Extension ${ext} does not match MIME type ${mimeType}` };
    }

    // Check file size if provided
    if (fileSize !== null && fileSize !== undefined) {
      const maxSize = this.getMaxFileSize();
      if (fileSize > maxSize) {
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
        return { valid: false, error: `File size exceeds maximum allowed size of ${maxSizeMB}MB` };
      }
    }

    return { valid: true, category: fileTypeConfig.category };
  }

  /**
   * Generate a storage path for a file
   * Format: storage/tasks/{taskId}/attachments/{category}/{uuid}.{ext}
   *
   * @param {number|string} taskId - Task ID
   * @param {string} category - File category (images, documents, excel, pdf, word, zip)
   * @param {string} originalFilename - Original filename to extract extension
   * @returns {string} Full filesystem path for storage
   */
  generateStoragePath(taskId, category, originalFilename) {
    const ext = path.extname(originalFilename).toLowerCase();
    const uuid = crypto.randomUUID();
    const storedFilename = `${uuid}${ext}`;
    
    const relativePath = path.join('storage', 'tasks', String(taskId), 'attachments', category, storedFilename);
    const fullPath = path.join(getWorkspaceRoot(), relativePath);
    
    return { fullPath, relativePath, storedFilename };
  }

  /**
   * Save a file to the filesystem
   *
   * @param {number|string} taskId - Task ID
   * @param {Buffer} buffer - File buffer to save
   * @param {string} originalFilename - Original filename
   * @param {string} mimeType - MIME type
   * @returns {Promise<{ storedFilename: string, filePath: string, category: string }>} Storage result
   * @throws {Error} If validation fails or file save fails
   */
  async saveFile(taskId, buffer, originalFilename, mimeType) {
    // Validate the file
    const validation = this.validateFileUpload(originalFilename, mimeType, buffer.length);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const { category } = validation;
    const { fullPath, relativePath, storedFilename } = this.generateStoragePath(taskId, category, originalFilename);

    // Create directory structure if it doesn't exist
    const directory = path.dirname(fullPath);
    await fs.mkdir(directory, { recursive: true });

    // Write the file
    await fs.writeFile(fullPath, buffer);

    return {
      storedFilename,
      filePath: relativePath,
      category,
    };
  }

  /**
   * Delete a file from the filesystem
   *
   * @param {string} filePath - Relative file path (from database)
   * @returns {Promise<boolean>} True if file was deleted, false if it didn't exist
   * @throws {Error} If deletion fails for reasons other than file not existing
   */
  async deleteFile(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('File path is required');
    }

    const fullPath = path.join(getWorkspaceRoot(), filePath);

    // Security check: ensure the path is within the storage directory
    const storageRoot = path.join(getWorkspaceRoot(), 'storage');
    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(storageRoot)) {
      throw new Error('Invalid file path: outside storage directory');
    }

    try {
      await fs.unlink(fullPath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, not an error for soft-delete scenarios
        return false;
      }
      throw error;
    }
  }

  /**
   * Get a readable stream for a file
   * Used for file downloads
   *
   * @param {string} filePath - Relative file path (from database)
   * @returns {Promise<fs.ReadStream>} Readable stream
   * @throws {Error} If file doesn't exist or path is invalid
   */
  async getFileStream(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('File path is required');
    }

    const fullPath = path.join(getWorkspaceRoot(), filePath);

    // Security check: ensure the path is within the storage directory
    const storageRoot = path.join(getWorkspaceRoot(), 'storage');
    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(storageRoot)) {
      throw new Error('Invalid file path: outside storage directory');
    }

    // Check if file exists
    try {
      await fs.access(fullPath, fs.constants.R_OK);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('File not found');
      }
      throw new Error('File is not accessible');
    }

    return fsSync.createReadStream(fullPath);
  }

  /**
   * Get the full filesystem path for a file
   * Used for direct file access when needed
   *
   * @param {string} filePath - Relative file path (from database)
   * @returns {string} Full filesystem path
   * @throws {Error} If path is invalid
   */
  getFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('File path is required');
    }

    const fullPath = path.join(getWorkspaceRoot(), filePath);

    // Security check: ensure the path is within the storage directory
    const storageRoot = path.join(getWorkspaceRoot(), 'storage');
    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(storageRoot)) {
      throw new Error('Invalid file path: outside storage directory');
    }

    return resolvedPath;
  }
}

// Export as singleton instance
export default new StorageService();
