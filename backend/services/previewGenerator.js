/**
 * Preview Generator
 * 
 * Generates preview table for user review before final import.
 * Calculates quality scores and identifies validation issues.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 13.1, 13.2, 13.4
 */

import * as dataNormalizerService from './dataNormalizerService.js';

// Configuration
const DEFAULT_PREVIEW_ROWS = 10;

// System schema fields
const REQUIRED_FIELDS = ['name'];
const OPTIONAL_FIELDS = [
  'email',
  'phone',
  'position',
  'experience',
  'location',
  'source',
  'skills',
  'salary_expected',
  'joining_time'
];

/**
 * Generate preview from uploaded data
 * @param {Array} rows - Array of raw data rows
 * @param {Array} mappings - Array of FieldMapping objects
 * @param {number} maxRows - Maximum number of rows to preview
 * @returns {Object} PreviewResult
 */
function generatePreview(rows, mappings, maxRows = DEFAULT_PREVIEW_ROWS) {
  const previewRows = [];
  const statistics = {
    totalRows: rows.length,
    rowsWithMissingRequired: 0,
    rowsWithMissingOptional: 0,
    estimatedQuality: {
      high: 0,
      medium: 0,
      low: 0
    }
  };
  const warnings = [];

  // Create mapping lookup
  const mappingMap = new Map();
  mappings.forEach(m => {
    mappingMap.set(m.sourceColumn, m.targetField);
  });

  // Process rows for preview
  const rowsToPreview = rows.slice(0, maxRows);

  rowsToPreview.forEach((row, index) => {
    // Map data according to field mappings
    const mappedData = {};
    for (const [sourceColumn, value] of Object.entries(row)) {
      const targetField = mappingMap.get(sourceColumn);
      if (targetField) {
        mappedData[targetField] = value;
      }
    }

    // Normalize the mapped data
    const normalized = dataNormalizerService.normalize({ normalized: mappedData });

    // Identify missing fields
    const missingRequired = REQUIRED_FIELDS.filter(
      field => !normalized.normalized[field]
    );
    const missingOptional = OPTIONAL_FIELDS.filter(
      field => !normalized.normalized[field]
    );

    // Run validation checks
    const validationIssues = validateRow(normalized.normalized);

    // Add to preview
    previewRows.push({
      rowNumber: index + 1,
      mappedData: normalized.normalized,
      missingRequired,
      missingOptional,
      validationIssues
    });

    // Update statistics
    if (missingRequired.length > 0) {
      statistics.rowsWithMissingRequired++;
    }
    if (missingOptional.length > 0) {
      statistics.rowsWithMissingOptional++;
    }
  });

  // Calculate quality distribution for all rows (not just preview)
  rows.forEach(row => {
    const mappedData = {};
    for (const [sourceColumn, value] of Object.entries(row)) {
      const targetField = mappingMap.get(sourceColumn);
      if (targetField) {
        mappedData[targetField] = value;
      }
    }

    const quality = calculateQualityScore(mappedData);
    statistics.estimatedQuality[quality.toLowerCase()]++;
  });

  // Generate warnings
  if (statistics.rowsWithMissingRequired > 0) {
    warnings.push({
      type: 'missing_required',
      message: `${statistics.rowsWithMissingRequired} rows are missing required fields and will fail import`,
      severity: 'error'
    });
  }

  if (statistics.rowsWithMissingOptional > 0) {
    warnings.push({
      type: 'missing_optional',
      message: `${statistics.rowsWithMissingOptional} rows are missing some optional fields`,
      severity: 'warning'
    });
  }

  // Check for unmapped columns
  const allSourceColumns = new Set();
  rows.forEach(row => {
    Object.keys(row).forEach(col => allSourceColumns.add(col));
  });

  const unmappedColumns = Array.from(allSourceColumns).filter(
    col => !mappingMap.has(col)
  );

  if (unmappedColumns.length > 0) {
    warnings.push({
      type: 'unmapped_columns',
      message: `${unmappedColumns.length} columns are not mapped: ${unmappedColumns.join(', ')}`,
      severity: 'warning',
      columns: unmappedColumns
    });
  }

  return {
    previewRows,
    statistics,
    warnings
  };
}

/**
 * Validate a row for common issues
 * @param {Object} row - Normalized row data
 * @returns {Array} Array of ValidationIssue objects
 */
function validateRow(row) {
  const issues = [];

  // Validate email format
  if (row.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(row.email)) {
      issues.push({
        field: 'email',
        value: row.email,
        issue: 'invalid_email',
        severity: 'warning'
      });
    }
  }

  // Validate phone format
  if (row.phone) {
    const digitCount = (row.phone.match(/\d/g) || []).length;
    if (digitCount < 10) {
      issues.push({
        field: 'phone',
        value: row.phone,
        issue: 'invalid_phone',
        severity: 'warning'
      });
    }
  }

  // Check for missing critical contact info
  if (!row.email && !row.phone) {
    issues.push({
      field: 'contact',
      value: null,
      issue: 'missing_contact_info',
      severity: 'warning'
    });
  }

  // Validate experience
  if (row.experience !== null && row.experience !== undefined) {
    if (typeof row.experience !== 'number' || row.experience < 0) {
      issues.push({
        field: 'experience',
        value: row.experience,
        issue: 'unparseable_experience',
        severity: 'warning'
      });
    }
  }

  return issues;
}

/**
 * Calculate quality score for a candidate
 * @param {Object} candidate - Candidate data
 * @returns {string} 'High', 'Medium', or 'Low'
 */
function calculateQualityScore(candidate) {
  let presentCount = 0;

  OPTIONAL_FIELDS.forEach(field => {
    const value = candidate[field];
    if (value !== null && value !== undefined && value !== '') {
      presentCount++;
    }
  });

  const completeness = presentCount / OPTIONAL_FIELDS.length;

  if (completeness === 1.0) {
    return 'High';
  } else if (completeness >= 0.5) {
    return 'Medium';
  } else {
    return 'Low';
  }
}

/**
 * Generate quality distribution summary
 * @param {Array} candidates - Array of candidate data
 * @returns {Object} Quality distribution { high, medium, low }
 */
function generateQualityDistribution(candidates) {
  const distribution = {
    high: 0,
    medium: 0,
    low: 0
  };

  candidates.forEach(candidate => {
    const quality = calculateQualityScore(candidate).toLowerCase();
    distribution[quality]++;
  });

  return distribution;
}

/**
 * Highlight candidates with missing critical contact information
 * @param {Array} candidates - Array of candidate data
 * @returns {Array} Array of row indices with missing contact info
 */
function highlightMissingContactInfo(candidates) {
  const missingContactRows = [];

  candidates.forEach((candidate, index) => {
    if (!candidate.email && !candidate.phone) {
      missingContactRows.push(index);
    }
  });

  return missingContactRows;
}

export {
  generatePreview,
  validateRow,
  calculateQualityScore,
  generateQualityDistribution,
  highlightMissingContactInfo,
  DEFAULT_PREVIEW_ROWS,
  REQUIRED_FIELDS,
  OPTIONAL_FIELDS
};
