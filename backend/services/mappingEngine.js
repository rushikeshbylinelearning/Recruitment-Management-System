/**
 * Mapping Engine
 * 
 * Stores and retrieves user field mapping preferences.
 * Enables auto-application of saved mappings for recurring imports.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import db from '../config/database.js';

// Configuration
const AUTO_APPLY_THRESHOLD = 0.80; // 80% column match required for auto-application

/**
 * Save field mappings for a user
 * @param {number} userId - User ID
 * @param {Array} mappings - Array of FieldMapping objects
 * @param {string} mappingName - Optional name for the mapping set
 * @returns {Promise<void>}
 */
async function saveMappings(userId, mappings, mappingName = null) {
  if (!mappings || mappings.length === 0) {
    throw new Error('No mappings provided');
  }

  try {
    // Use INSERT ... ON DUPLICATE KEY UPDATE to handle existing mappings
    const query = `
      INSERT INTO field_mappings 
      (user_id, mapping_name, source_column, target_field, last_used)
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE 
        mapping_name = VALUES(mapping_name),
        last_used = NOW()
    `;

    for (const mapping of mappings) {
      await db.query(query, [
        userId,
        mappingName,
        mapping.sourceColumn,
        mapping.targetField
      ]);
    }

    console.log(`Saved ${mappings.length} mappings for user ${userId}`);
  } catch (error) {
    console.error('Error saving mappings:', error);
    throw error;
  }
}

/**
 * Get saved mappings for a user based on uploaded headers
 * @param {number} userId - User ID
 * @param {Array} headers - Array of column headers from uploaded file
 * @returns {Promise<Array>} Array of FieldMapping objects
 */
async function getMappings(userId, headers) {
  if (!headers || headers.length === 0) {
    return [];
  }

  try {
    // Query for mappings matching the provided headers
    const query = `
      SELECT 
        source_column,
        target_field,
        mapping_name,
        created_at,
        last_used
      FROM field_mappings
      WHERE user_id = ? AND source_column IN (${headers.map(() => '?').join(',')})
      ORDER BY last_used DESC
    `;

    const [rows] = await db.query(query, [userId, ...headers]);

    // Convert to FieldMapping format
    const mappings = rows.map(row => ({
      sourceColumn: row.source_column,
      targetField: row.target_field,
      confidence: 1.0, // Saved mappings have full confidence
      method: 'saved'
    }));

    return mappings;
  } catch (error) {
    console.error('Error getting mappings:', error);
    throw error;
  }
}

/**
 * Check if saved mappings should be auto-applied
 * @param {Array} headers - Array of column headers from uploaded file
 * @param {Array} savedMappings - Array of saved FieldMapping objects
 * @returns {boolean} True if should auto-apply
 */
function shouldAutoApply(headers, savedMappings) {
  if (!headers || headers.length === 0) return false;
  if (!savedMappings || savedMappings.length === 0) return false;

  // Calculate match percentage
  const matchedHeaders = savedMappings.map(m => m.sourceColumn);
  const matchCount = headers.filter(h => matchedHeaders.includes(h)).length;
  const matchPercentage = matchCount / headers.length;

  return matchPercentage >= AUTO_APPLY_THRESHOLD;
}

/**
 * Apply saved mappings to headers
 * @param {Array} headers - Array of column headers from uploaded file
 * @param {Array} savedMappings - Array of saved FieldMapping objects
 * @returns {Object} { appliedMappings, unmappedColumns }
 */
function applyMappings(headers, savedMappings) {
  const appliedMappings = [];
  const unmappedColumns = [];

  // Create a map for quick lookup
  const mappingMap = new Map();
  savedMappings.forEach(m => {
    mappingMap.set(m.sourceColumn, m);
  });

  // Apply mappings to each header
  headers.forEach(header => {
    if (mappingMap.has(header)) {
      appliedMappings.push(mappingMap.get(header));
    } else {
      unmappedColumns.push(header);
    }
  });

  return {
    appliedMappings,
    unmappedColumns
  };
}

/**
 * List all saved mappings for a user
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of SavedMapping objects
 */
async function listUserMappings(userId) {
  try {
    const query = `
      SELECT 
        id,
        user_id,
        mapping_name,
        source_column,
        target_field,
        created_at,
        last_used
      FROM field_mappings
      WHERE user_id = ?
      ORDER BY last_used DESC
    `;

    const [rows] = await db.query(query, [userId]);

    // Group by mapping_name or create individual entries
    const mappingsMap = new Map();

    rows.forEach(row => {
      const key = row.mapping_name || `mapping_${row.id}`;
      
      if (!mappingsMap.has(key)) {
        mappingsMap.set(key, {
          id: row.id,
          userId: row.user_id,
          name: row.mapping_name || 'Unnamed Mapping',
          mappings: [],
          createdAt: row.created_at,
          lastUsed: row.last_used
        });
      }

      mappingsMap.get(key).mappings.push({
        sourceColumn: row.source_column,
        targetField: row.target_field
      });
    });

    return Array.from(mappingsMap.values());
  } catch (error) {
    console.error('Error listing user mappings:', error);
    throw error;
  }
}

/**
 * Delete a saved mapping
 * @param {number} userId - User ID
 * @param {number} mappingId - Mapping ID
 * @returns {Promise<boolean>} True if deleted
 */
async function deleteMappings(userId, mappingId) {
  try {
    const [result] = await db.query(
      'DELETE FROM field_mappings WHERE id = ? AND user_id = ?',
      [mappingId, userId]
    );

    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error deleting mapping:', error);
    throw error;
  }
}

/**
 * Delete all mappings for a specific mapping name
 * @param {number} userId - User ID
 * @param {string} mappingName - Mapping name
 * @returns {Promise<number>} Number of mappings deleted
 */
async function deleteMappingsByName(userId, mappingName) {
  try {
    const [result] = await db.query(
      'DELETE FROM field_mappings WHERE user_id = ? AND mapping_name = ?',
      [userId, mappingName]
    );

    return result.affectedRows;
  } catch (error) {
    console.error('Error deleting mappings by name:', error);
    throw error;
  }
}

/**
 * Update last_used timestamp for mappings
 * @param {number} userId - User ID
 * @param {Array} sourceColumns - Array of source column names
 * @returns {Promise<void>}
 */
async function updateLastUsed(userId, sourceColumns) {
  if (!sourceColumns || sourceColumns.length === 0) return;

  try {
    const query = `
      UPDATE field_mappings
      SET last_used = NOW()
      WHERE user_id = ? AND source_column IN (${sourceColumns.map(() => '?').join(',')})
    `;

    await db.query(query, [userId, ...sourceColumns]);
  } catch (error) {
    console.error('Error updating last_used:', error);
    throw error;
  }
}

export {
  saveMappings,
  getMappings,
  shouldAutoApply,
  applyMappings,
  listUserMappings,
  deleteMappings,
  deleteMappingsByName,
  updateLastUsed,
  AUTO_APPLY_THRESHOLD
};
