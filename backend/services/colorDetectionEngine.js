/**
 * Color Detection Engine
 * 
 * ENTERPRISE-GRADE COLOR MATCHING SYSTEM
 * 
 * Detects workflow stages from Excel cell colors with:
 * - Exact color matching
 * - RGB tolerance matching
 * - ARGB format support (Excel format)
 * - HEX normalization
 * - Confidence scoring
 * 
 * IMPORTANT: Only processes colors from CANDIDATE NAME COLUMN
 */

import { STAGE_COLOR_MAP, getStageByColor } from '../config/stageColorMapping.js';

/**
 * Normalize color to standard hex format
 * Supports: #RRGGBB, RRGGBB, AARRGGBB (Excel ARGB), FFRRGGBB
 * 
 * @param {string} color - Color in any format
 * @returns {string|null} - Normalized #RRGGBB format or null
 */
export function normalizeColor(color) {
  if (!color || typeof color !== 'string') {
    return null;
  }
  
  // Remove whitespace and convert to uppercase
  let normalized = color.trim().toUpperCase();
  
  // Remove # prefix if present
  normalized = normalized.replace(/^#/, '');
  
  // Handle ARGB format (8 characters: AARRGGBB or FFRRGGBB)
  // Excel often uses ARGB format where first 2 chars are alpha channel
  if (normalized.length === 8) {
    // Extract RGB part (last 6 characters)
    normalized = normalized.substring(2);
  }
  
  // Validate hex format (should be 6 characters now)
  if (!/^[0-9A-F]{6}$/.test(normalized)) {
    console.warn(`Invalid color format: ${color}`);
    return null;
  }
  
  // Return with # prefix
  return `#${normalized}`;
}

/**
 * Convert hex color to RGB object
 * 
 * @param {string} hex - Hex color (#RRGGBB)
 * @returns {Object|null} - {r, g, b} or null
 */
export function hexToRgb(hex) {
  const normalized = normalizeColor(hex);
  if (!normalized) return null;
  
  const result = /^#?([A-F0-9]{2})([A-F0-9]{2})([A-F0-9]{2})$/i.exec(normalized);
  
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Calculate RGB distance between two colors
 * Uses Euclidean distance in RGB color space
 * 
 * @param {Object} rgb1 - {r, g, b}
 * @param {Object} rgb2 - {r, g, b}
 * @returns {number} - Distance (0-441.67)
 */
export function calculateRgbDistance(rgb1, rgb2) {
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
}

/**
 * Find best matching stage by color with tolerance
 * 
 * @param {string} hexColor - Color to match
 * @param {number} tolerance - RGB distance tolerance (default: 30)
 * @returns {Object|null} - { stageId, config, distance, confidence, matchType }
 */
export function findStageByColorWithTolerance(hexColor, tolerance = 30) {
  const normalized = normalizeColor(hexColor);
  if (!normalized) return null;
  
  const inputRgb = hexToRgb(normalized);
  if (!inputRgb) return null;
  
  let bestMatch = null;
  let minDistance = Infinity;
  
  // Check all stages
  for (const [stageId, config] of Object.entries(STAGE_COLOR_MAP)) {
    // Check primary color
    const primaryRgb = hexToRgb(config.color);
    if (primaryRgb) {
      const distance = calculateRgbDistance(inputRgb, primaryRgb);
      
      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = {
          stageId,
          config,
          distance,
          matchType: distance === 0 ? 'exact' : 'tolerance'
        };
      }
    }
    
    // Check tolerance shades
    if (config.toleranceShades) {
      for (const shade of config.toleranceShades) {
        const shadeRgb = hexToRgb(shade);
        if (shadeRgb) {
          const distance = calculateRgbDistance(inputRgb, shadeRgb);
          
          if (distance < minDistance) {
            minDistance = distance;
            bestMatch = {
              stageId,
              config,
              distance,
              matchType: distance === 0 ? 'exact' : 'tolerance'
            };
          }
        }
      }
    }
  }
  
  // Only return match if within tolerance
  if (bestMatch && bestMatch.distance <= tolerance) {
    // Calculate confidence (0-1)
    // Exact match = 1.0, at tolerance boundary = 0.5
    const confidence = bestMatch.distance === 0 
      ? 1.0 
      : Math.max(0.5, 1.0 - (bestMatch.distance / (tolerance * 2)));
    
    return {
      ...bestMatch,
      confidence: parseFloat(confidence.toFixed(2))
    };
  }
  
  return null;
}

/**
 * Detect stage from candidate name cell color
 * 
 * MAIN DETECTION FUNCTION
 * 
 * @param {string} cellColor - Hex color from candidate name cell
 * @param {Object} options - Detection options
 * @param {number} options.tolerance - RGB tolerance (default: 30)
 * @param {boolean} options.strictMode - Require exact match (default: false)
 * @returns {Object|null} - Detection result or null
 */
export function detectStageByColor(cellColor, options = {}) {
  const {
    tolerance = 30,
    strictMode = false
  } = options;
  
  if (!cellColor) {
    return null;
  }
  
  // Normalize color
  const normalized = normalizeColor(cellColor);
  if (!normalized) {
    console.warn(`Failed to normalize color: ${cellColor}`);
    return null;
  }
  
  // Try exact match first (fastest)
  const exactMatch = getStageByColor(normalized);
  if (exactMatch) {
    return {
      stageId: Object.keys(STAGE_COLOR_MAP).find(
        id => STAGE_COLOR_MAP[id] === exactMatch
      ),
      mainStage: exactMatch.mainStage,
      subStage: exactMatch.subStage,
      legacyStage: exactMatch.legacyStage,
      confidence: 1.0,
      matchMethod: 'color-exact',
      detectedColor: normalized,
      originalColor: cellColor
    };
  }
  
  // If strict mode, don't try tolerance matching
  if (strictMode) {
    return null;
  }
  
  // Try tolerance matching
  const toleranceMatch = findStageByColorWithTolerance(normalized, tolerance);
  if (toleranceMatch) {
    return {
      stageId: toleranceMatch.stageId,
      mainStage: toleranceMatch.config.mainStage,
      subStage: toleranceMatch.config.subStage,
      legacyStage: toleranceMatch.config.legacyStage,
      confidence: toleranceMatch.confidence,
      matchMethod: 'color-tolerance',
      detectedColor: normalized,
      originalColor: cellColor,
      distance: toleranceMatch.distance
    };
  }
  
  // No match found
  return null;
}

/**
 * Extract color from candidate name cell
 * 
 * IMPORTANT: Only extracts from NAME column, not other columns
 * 
 * @param {Object} rowData - Row data with __cellColors metadata
 * @param {string} nameColumnHeader - Header name for candidate name column
 * @returns {string|null} - Hex color or null
 */
export function extractNameCellColor(rowData, nameColumnHeader) {
  if (!rowData || !rowData.__cellColors) {
    return null;
  }
  
  // Get color from name column only
  const cellColor = rowData.__cellColors[nameColumnHeader];
  
  if (!cellColor) {
    return null;
  }
  
  return normalizeColor(cellColor);
}

/**
 * Batch detect stages from multiple rows
 * 
 * @param {Array} rows - Array of row data with __cellColors
 * @param {string} nameColumnHeader - Header for name column
 * @param {Object} options - Detection options
 * @returns {Array} - Array of detection results
 */
export function batchDetectStages(rows, nameColumnHeader, options = {}) {
  return rows.map(row => {
    const cellColor = extractNameCellColor(row, nameColumnHeader);
    
    if (!cellColor) {
      return {
        row,
        detection: null,
        reason: 'no-color'
      };
    }
    
    const detection = detectStageByColor(cellColor, options);
    
    return {
      row,
      detection,
      reason: detection ? 'detected' : 'no-match'
    };
  });
}

/**
 * Validate color detection result
 * 
 * @param {Object} detection - Detection result
 * @param {number} minConfidence - Minimum confidence threshold (default: 0.5)
 * @returns {boolean} - True if valid
 */
export function isValidDetection(detection, minConfidence = 0.5) {
  return detection && 
         detection.confidence >= minConfidence &&
         detection.mainStage &&
         detection.legacyStage;
}

/**
 * Get detection statistics
 * 
 * @param {Array} detectionResults - Array of detection results from batchDetectStages
 * @returns {Object} - Statistics
 */
export function getDetectionStatistics(detectionResults) {
  const total = detectionResults.length;
  const detected = detectionResults.filter(r => r.detection).length;
  const noColor = detectionResults.filter(r => r.reason === 'no-color').length;
  const noMatch = detectionResults.filter(r => r.reason === 'no-match').length;
  
  const confidenceScores = detectionResults
    .filter(r => r.detection)
    .map(r => r.detection.confidence);
  
  const avgConfidence = confidenceScores.length > 0
    ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
    : 0;
  
  return {
    total,
    detected,
    noColor,
    noMatch,
    detectionRate: total > 0 ? (detected / total * 100).toFixed(1) : 0,
    avgConfidence: avgConfidence.toFixed(2)
  };
}

export default {
  normalizeColor,
  hexToRgb,
  calculateRgbDistance,
  findStageByColorWithTolerance,
  detectStageByColor,
  extractNameCellColor,
  batchDetectStages,
  isValidDetection,
  getDetectionStatistics
};
