/**
 * Import Logger Service
 * 
 * Tracks import history and stores failed row details.
 * Provides log retrieval and failed row download functionality.
 * 
 * Requirements: 6.5, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */

import db from '../config/database.js';
import { Parser } from 'json2csv';

// Configuration
const LOG_RETENTION_DAYS = process.env.LOG_RETENTION_DAYS || 90;

/**
 * Log an import operation
 * @param {Object} importData - Import log data
 * @returns {Promise<number>} Import log ID
 */
async function logImport(importData) {
  const {
    userId,
    filename,
    totalRows,
    successCount,
    failureCount,
    failedRows = [],
    processingTime
  } = importData;

  try {
    // Insert into import_logs table
    const [result] = await db.query(
      `INSERT INTO import_logs 
       (user_id, filename, total_rows, success_count, failure_count, processing_time)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, filename, totalRows, successCount, failureCount, processingTime]
    );

    const importLogId = result.insertId;

    // Insert failed rows if any
    if (failedRows.length > 0) {
      await insertFailedRows(importLogId, failedRows);
    }

    return importLogId;
  } catch (error) {
    console.error('Error logging import:', error);
    throw error;
  }
}

/**
 * Insert failed rows into database
 * @param {number} importLogId - Import log ID
 * @param {Array} failedRows - Array of failed row objects
 * @returns {Promise<void>}
 */
async function insertFailedRows(importLogId, failedRows) {
  if (failedRows.length === 0) return;

  const query = `
    INSERT INTO import_failed_rows 
    (import_log_id, row_number, candidate_name, error_message, row_data)
    VALUES (?, ?, ?, ?, ?)
  `;

  for (const row of failedRows) {
    await db.query(query, [
      importLogId,
      row.rowNumber,
      row.candidateName || null,
      row.error,
      JSON.stringify(row.data)
    ]);
  }
}

/**
 * Get import logs with pagination
 * @param {number} userId - User ID
 * @param {Object} pagination - Pagination options
 * @returns {Promise<Array>} Array of import logs
 */
async function getImportLogs(userId, pagination = {}) {
  const {
    page = 1,
    limit = 20,
    startDate = null,
    endDate = null
  } = pagination;

  const offset = (page - 1) * limit;

  try {
    let query = `
      SELECT 
        il.id,
        il.user_id,
        u.username,
        il.filename,
        il.total_rows,
        il.success_count,
        il.failure_count,
        il.processing_time,
        il.uploaded_at
      FROM import_logs il
      LEFT JOIN users u ON il.user_id = u.id
      WHERE il.user_id = ?
    `;

    const params = [userId];

    // Add date range filters if provided
    if (startDate) {
      query += ' AND il.uploaded_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND il.uploaded_at <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY il.uploaded_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [logs] = await db.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM import_logs WHERE user_id = ?';
    const countParams = [userId];

    if (startDate) {
      countQuery += ' AND uploaded_at >= ?';
      countParams.push(startDate);
    }

    if (endDate) {
      countQuery += ' AND uploaded_at <= ?';
      countParams.push(endDate);
    }

    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting import logs:', error);
    throw error;
  }
}

/**
 * Get failed rows for a specific import
 * @param {number} importId - Import log ID
 * @returns {Promise<Array>} Array of failed rows
 */
async function getFailedRows(importId) {
  try {
    const [rows] = await db.query(
      `SELECT 
        id,
        row_number,
        candidate_name,
        error_message,
        row_data
       FROM import_failed_rows
       WHERE import_log_id = ?
       ORDER BY row_number`,
      [importId]
    );

    // Parse row_data JSON
    return rows.map(row => ({
      id: row.id,
      rowNumber: row.row_number,
      candidateName: row.candidate_name,
      errorMessage: row.error_message,
      rowData: JSON.parse(row.row_data)
    }));
  } catch (error) {
    console.error('Error getting failed rows:', error);
    throw error;
  }
}

/**
 * Download failed rows as CSV
 * @param {number} importId - Import log ID
 * @returns {Promise<Buffer>} CSV file buffer
 */
async function downloadFailedRows(importId) {
  try {
    const failedRows = await getFailedRows(importId);

    if (failedRows.length === 0) {
      throw new Error('No failed rows found for this import');
    }

    // Prepare data for CSV
    const csvData = failedRows.map(row => ({
      row_number: row.rowNumber,
      error_reason: row.errorMessage,
      ...row.rowData
    }));

    // Convert to CSV
    const parser = new Parser();
    const csv = parser.parse(csvData);

    return Buffer.from(csv, 'utf-8');
  } catch (error) {
    console.error('Error downloading failed rows:', error);
    throw error;
  }
}

/**
 * Clean up old import logs (retention policy)
 * @returns {Promise<number>} Number of logs deleted
 */
async function cleanupOldLogs() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - LOG_RETENTION_DAYS);

    const [result] = await db.query(
      'DELETE FROM import_logs WHERE uploaded_at < ?',
      [cutoffDate]
    );

    console.log(`Cleaned up ${result.affectedRows} old import logs`);
    return result.affectedRows;
  } catch (error) {
    console.error('Error cleaning up old logs:', error);
    throw error;
  }
}

/**
 * Get import log by ID
 * @param {number} importId - Import log ID
 * @returns {Promise<Object>} Import log details
 */
async function getImportLogById(importId) {
  try {
    const [logs] = await db.query(
      `SELECT 
        il.id,
        il.user_id,
        u.username,
        il.filename,
        il.total_rows,
        il.success_count,
        il.failure_count,
        il.processing_time,
        il.uploaded_at
       FROM import_logs il
       LEFT JOIN users u ON il.user_id = u.id
       WHERE il.id = ?`,
      [importId]
    );

    if (logs.length === 0) {
      return null;
    }

    return logs[0];
  } catch (error) {
    console.error('Error getting import log by ID:', error);
    throw error;
  }
}

export {
  logImport,
  insertFailedRows,
  getImportLogs,
  getFailedRows,
  downloadFailedRows,
  cleanupOldLogs,
  getImportLogById,
  LOG_RETENTION_DAYS
};
