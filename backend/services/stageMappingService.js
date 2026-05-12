/**
 * Stage Mapping Service (Backend)
 * 
 * Intelligent stage detection and mapping for bulk candidate import.
 * Supports hierarchical umbrella stage architecture with micro stages.
 * Integrates with centralized color configuration system.
 * 
 * IMPORTANT: Now uses stageColorMapping.js as single source of truth for colors
 */

import { STAGE_COLOR_MAP, getStageByColor } from '../config/stageColorMapping.js';
import { detectStageByColor, normalizeColor } from './colorDetectionEngine.js';

/**
 * Comprehensive stage mapping configuration
 * Maps Excel values (including typos and variations) to umbrella stages
 */
const STAGE_ALIASES = {
  // Main stages
  'applied': { mainStage: 'applied', legacyStage: 'Applied' },
  'apply': { mainStage: 'applied', legacyStage: 'Applied' },
  'application': { mainStage: 'applied', legacyStage: 'Applied' },
  'new': { mainStage: 'applied', legacyStage: 'Applied' },
  
  'follow up': { mainStage: 'follow-up', legacyStage: 'Follow Up' },
  'followup': { mainStage: 'follow-up', legacyStage: 'Follow Up' },
  'follow-up': { mainStage: 'follow-up', legacyStage: 'Follow Up' },
  
  'screening': { mainStage: 'screening', legacyStage: 'Screening' },
  'screen': { mainStage: 'screening', legacyStage: 'Screening' },
  'initial screening': { mainStage: 'screening', legacyStage: 'Screening' },
  
  'interview': { mainStage: 'interview', subStage: 'came-down', legacyStage: 'Interview' },
  
  'offer': { mainStage: 'offer', legacyStage: 'Offer' },
  'offered': { mainStage: 'offer', legacyStage: 'Offer' },
  'offer made': { mainStage: 'offer', legacyStage: 'Offer' },
  
  'hired': { mainStage: 'hired', legacyStage: 'Hired' },
  'joined': { mainStage: 'hired', legacyStage: 'Hired' },
  'onboarded': { mainStage: 'hired', legacyStage: 'Hired' },
  
  // Interview sub-stages
  'follow up (for interview)': { mainStage: 'interview', subStage: 'follow-up-interview', legacyStage: 'Interview' },
  'follow up for interview': { mainStage: 'interview', subStage: 'follow-up-interview', legacyStage: 'Interview' },
  'followup for interview': { mainStage: 'interview', subStage: 'follow-up-interview', legacyStage: 'Interview' },
  'interview follow up': { mainStage: 'interview', subStage: 'follow-up-interview', legacyStage: 'Interview' },
  'interview followup': { mainStage: 'interview', subStage: 'follow-up-interview', legacyStage: 'Interview' },
  
  'came down for interview': { mainStage: 'interview', subStage: 'came-down', legacyStage: 'Interview' },
  'came down': { mainStage: 'interview', subStage: 'came-down', legacyStage: 'Interview' },
  'attended interview': { mainStage: 'interview', subStage: 'came-down', legacyStage: 'Interview' },
  'attended': { mainStage: 'interview', subStage: 'came-down', legacyStage: 'Interview' },
  'showed up': { mainStage: 'interview', subStage: 'came-down', legacyStage: 'Interview' },
  
  'didn\'t came down for the interview': { mainStage: 'interview', subStage: 'no-show', legacyStage: 'Interview' },
  'didn\'t came down for interview': { mainStage: 'interview', subStage: 'no-show', legacyStage: 'Interview' },
  'didnt came down for interview': { mainStage: 'interview', subStage: 'no-show', legacyStage: 'Interview' },
  'didn\'t come': { mainStage: 'interview', subStage: 'no-show', legacyStage: 'Interview' },
  'didnt come': { mainStage: 'interview', subStage: 'no-show', legacyStage: 'Interview' },
  'no show': { mainStage: 'interview', subStage: 'no-show', legacyStage: 'Interview' },
  'no-show': { mainStage: 'interview', subStage: 'no-show', legacyStage: 'Interview' },
  'absent': { mainStage: 'interview', subStage: 'no-show', legacyStage: 'Interview' },
  'did not attend': { mainStage: 'interview', subStage: 'no-show', legacyStage: 'Interview' },
  
  'selected (for interview)': { mainStage: 'interview', subStage: 'selected-interview', legacyStage: 'Interview' },
  'selected for interview': { mainStage: 'interview', subStage: 'selected-interview', legacyStage: 'Interview' },
  'interview selected': { mainStage: 'interview', subStage: 'selected-interview', legacyStage: 'Interview' },
  'passed interview': { mainStage: 'interview', subStage: 'selected-interview', legacyStage: 'Interview' },
  'interview passed': { mainStage: 'interview', subStage: 'selected-interview', legacyStage: 'Interview' },
  
  'rejected (for interview)': { mainStage: 'interview', subStage: 'rejected-interview', legacyStage: 'Interview' },
  'rejected for interview': { mainStage: 'interview', subStage: 'rejected-interview', legacyStage: 'Interview' },
  'interview rejected': { mainStage: 'interview', subStage: 'rejected-interview', legacyStage: 'Interview' },
  'failed interview': { mainStage: 'interview', subStage: 'rejected-interview', legacyStage: 'Interview' },
  'interview failed': { mainStage: 'interview', subStage: 'rejected-interview', legacyStage: 'Interview' },
  
  // Rejected sub-stages
  'rejected': { mainStage: 'rejected', subStage: 'rejected', legacyStage: 'Rejected' },
  'reject': { mainStage: 'rejected', subStage: 'rejected', legacyStage: 'Rejected' },
  'not selected': { mainStage: 'rejected', subStage: 'rejected', legacyStage: 'Rejected' },
  'declined': { mainStage: 'rejected', subStage: 'rejected', legacyStage: 'Rejected' },
  
  'on hold': { mainStage: 'rejected', subStage: 'on-hold', legacyStage: 'On Hold' },
  'onhold': { mainStage: 'rejected', subStage: 'on-hold', legacyStage: 'On Hold' },
  'hold': { mainStage: 'rejected', subStage: 'on-hold', legacyStage: 'On Hold' },
  'paused': { mainStage: 'rejected', subStage: 'on-hold', legacyStage: 'On Hold' },
  'pending': { mainStage: 'rejected', subStage: 'on-hold', legacyStage: 'On Hold' },
  
  'profile not matched': { mainStage: 'rejected', subStage: 'profile-not-matched', legacyStage: 'Profile Not Matched' },
  'profile not match': { mainStage: 'rejected', subStage: 'profile-not-matched', legacyStage: 'Profile Not Matched' },
  'profile mismatch': { mainStage: 'rejected', subStage: 'profile-not-matched', legacyStage: 'Profile Not Matched' },
  'not matched': { mainStage: 'rejected', subStage: 'profile-not-matched', legacyStage: 'Profile Not Matched' },
  'skills mismatch': { mainStage: 'rejected', subStage: 'profile-not-matched', legacyStage: 'Profile Not Matched' },
  'not suitable': { mainStage: 'rejected', subStage: 'profile-not-matched', legacyStage: 'Profile Not Matched' },
  
  'last minute back out': { mainStage: 'rejected', subStage: 'last-minute-back-out', legacyStage: 'Last Minute Back Out' },
  'last minute backout': { mainStage: 'rejected', subStage: 'last-minute-back-out', legacyStage: 'Last Minute Back Out' },
  'backed out': { mainStage: 'rejected', subStage: 'last-minute-back-out', legacyStage: 'Last Minute Back Out' },
  'withdrew': { mainStage: 'rejected', subStage: 'last-minute-back-out', legacyStage: 'Last Minute Back Out' },
  'withdrawal': { mainStage: 'rejected', subStage: 'last-minute-back-out', legacyStage: 'Last Minute Back Out' },
  'candidate withdrew': { mainStage: 'rejected', subStage: 'last-minute-back-out', legacyStage: 'Last Minute Back Out' },
};

/**
 * Color-based stage hints
 * Secondary enhancement to text matching
 * Includes colors for all main stages and umbrella sub-stages
 */
const COLOR_HINTS = {
  // Main Stages
  'applied': ['#4169E1', '#1E90FF', '#6495ED', '#5B9BD5', '#4472C4'], // Blue shades
  'follow-up': ['#00B0F0', '#00B8E6', '#17A2B8', '#0DCAF0', '#20C997'], // Cyan/Teal shades
  'screening': ['#FFC000', '#FFB900', '#F39C12', '#E67E22', '#D68910'], // Amber/Gold shades
  'offer': ['#9370DB', '#8A2BE2', '#9932CC', '#BA55D3', '#8B5CF6'], // Purple shades
  'hired': ['#00FF00', '#228B22', '#008000', '#10B981'], // Green shades (removed #32CD32)
  
  // Interview Umbrella (Orange shades)
  'interview': ['#FF6347', '#FF4500', '#FF7F50', '#FF8C69', '#FFA07A'], // Orange/Coral shades
  'follow-up-interview': ['#FF8C00', '#FF7F00', '#FF9500'], // Dark Orange (Interview Follow Up)
  'came-down': ['#FF6347', '#FF5733', '#FF4500'], // Tomato/Orange Red (Attended)
  'no-show': ['#DC143C', '#C71585', '#B22222'], // Crimson/Dark Pink (No Show)
  'selected-interview': ['#32CD32', '#3CB371', '#2E8B57', '#00FA9A'], // Medium Green (Selected) - distinct from hired
  'rejected-interview': ['#FF1493', '#FF69B4', '#DB7093'], // Deep Pink (Rejected after interview)
  
  // Rejected Umbrella (Red/Orange/Yellow shades)
  'rejected': ['#FF0000', '#DC143C', '#8B0000', '#B22222', '#CD5C5C'], // Red shades (Standard Rejection)
  'on-hold': ['#FFA500', '#FF8C00', '#FFD700', '#F0E68C', '#FFEB3B'], // Orange/Yellow (On Hold)
  'profile-not-matched': ['#E74C3C', '#C0392B', '#A93226', '#922B21'], // Dark Red (Profile Mismatch)
  'last-minute-back-out': ['#FF6B6B', '#FF5252', '#EF5350', '#F44336'], // Light Red/Pink (Back Out)
};

/**
 * Normalize text for comparison
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s()-]/g, '') // Remove special chars except ()- 
    .replace(/\s*\(\s*/g, ' (') // Normalize parentheses
    .replace(/\s*\)\s*/g, ') ');
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity score (0-1)
 */
function calculateSimilarity(str1, str2) {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;
  
  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLength;
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex) {
  if (!hex) return null;
  
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Check if color matches stage hint
 */
function matchColorHint(color, stageId) {
  if (!color) return false;
  
  const normalizedColor = color.toUpperCase();
  const hints = COLOR_HINTS[stageId] || [];
  
  // First check for exact match
  if (hints.some(hint => normalizedColor === hint.toUpperCase())) {
    return true;
  }
  
  // Then check RGB tolerance
  return hints.some(hint => {
    const colorRgb = hexToRgb(normalizedColor);
    const hintRgb = hexToRgb(hint);
    
    if (colorRgb && hintRgb) {
      const distance = Math.sqrt(
        Math.pow(colorRgb.r - hintRgb.r, 2) +
        Math.pow(colorRgb.g - hintRgb.g, 2) +
        Math.pow(colorRgb.b - hintRgb.b, 2)
      );
      return distance < 50; // Tolerance threshold
    }
    
    return false;
  });
}

/**
 * Find best color match with confidence scoring
 */
function findBestColorMatch(cellColor, fontColor) {
  const matches = [];
  
  for (const [stageId, colors] of Object.entries(COLOR_HINTS)) {
    const cellMatch = matchColorHint(cellColor, stageId);
    const fontMatch = matchColorHint(fontColor, stageId);
    
    if (cellMatch || fontMatch) {
      // Calculate distance to get best match
      const color = cellColor || fontColor;
      const colorRgb = hexToRgb(color);
      
      if (colorRgb) {
        let minDistance = Infinity;
        
        for (const hint of colors) {
          const hintRgb = hexToRgb(hint);
          if (hintRgb) {
            const distance = Math.sqrt(
              Math.pow(colorRgb.r - hintRgb.r, 2) +
              Math.pow(colorRgb.g - hintRgb.g, 2) +
              Math.pow(colorRgb.b - hintRgb.b, 2)
            );
            minDistance = Math.min(minDistance, distance);
          }
        }
        
        matches.push({ stageId, distance: minDistance });
      }
    }
  }
  
  // Return the closest match
  if (matches.length > 0) {
    matches.sort((a, b) => a.distance - b.distance);
    return matches[0].stageId;
  }
  
  return null;
}

/**
 * Main stage detection function
 * @param {Object} options - Detection options
 * @param {string} options.cellValue - Text value from Excel cell
 * @param {string} [options.cellColor] - Hex color from Excel cell
 * @param {string} [options.fontColor] - Font color from Excel cell
 * @param {boolean} [options.allowFuzzyMatch=true] - Enable fuzzy matching
 * @param {number} [options.confidenceThreshold=0.7] - Minimum confidence threshold
 * @returns {Object} StageMappingResult
 */
function detectStage(options) {
  const {
    cellValue,
    cellColor,
    fontColor,
    allowFuzzyMatch = true,
    confidenceThreshold = 0.7,
  } = options;

  const normalized = normalizeText(cellValue);

  // 1. Exact match (highest confidence)
  if (STAGE_ALIASES[normalized]) {
    const mapping = STAGE_ALIASES[normalized];
    return {
      mainStage: mapping.mainStage,
      subStage: mapping.subStage || null,
      confidence: 1.0,
      matchMethod: 'exact',
      originalValue: cellValue,
      legacyStage: mapping.legacyStage,
    };
  }

  // 2. Fuzzy match with aliases
  if (allowFuzzyMatch) {
    let bestMatch = null;

    for (const [alias, mapping] of Object.entries(STAGE_ALIASES)) {
      const similarity = calculateSimilarity(normalized, alias);
      
      if (similarity >= confidenceThreshold && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { alias, similarity, mapping };
      }
    }

    if (bestMatch) {
      return {
        mainStage: bestMatch.mapping.mainStage,
        subStage: bestMatch.mapping.subStage || null,
        confidence: bestMatch.similarity,
        matchMethod: 'fuzzy',
        originalValue: cellValue,
        legacyStage: bestMatch.mapping.legacyStage,
      };
    }
  }

  // 3. Color-based detection using centralized color engine (if text match failed)
  if (cellColor || fontColor) {
    // Use the new color detection engine
    const colorToUse = cellColor || fontColor;
    const colorDetection = detectStageByColor(colorToUse, { tolerance: 30 });
    
    if (colorDetection) {
      return {
        mainStage: colorDetection.mainStage,
        subStage: colorDetection.subStage,
        confidence: colorDetection.confidence,
        matchMethod: colorDetection.matchMethod,
        originalValue: cellValue,
        legacyStage: colorDetection.legacyStage,
        detectedColor: colorDetection.detectedColor
      };
    }
  }

  // 4. Fallback to Applied
  return {
    mainStage: 'applied',
    subStage: null,
    confidence: 0.3,
    matchMethod: 'fallback',
    originalValue: cellValue,
    legacyStage: 'Applied',
  };
}

/**
 * Get legacy stage name from main_stage and sub_stage
 * Mirrors the database function get_legacy_stage_name()
 */
function getLegacyStage(mainStage, subStage) {
  if (mainStage === 'rejected') {
    switch (subStage) {
      case 'rejected': return 'Rejected';
      case 'on-hold': return 'On Hold';
      case 'profile-not-matched': return 'Profile Not Matched';
      case 'last-minute-back-out': return 'Last Minute Back Out';
      default: return 'Rejected';
    }
  } else if (mainStage === 'interview') {
    // All Interview sub-stages map to 'Interview' for legacy compatibility
    return 'Interview';
  } else {
    switch (mainStage) {
      case 'applied': return 'Applied';
      case 'follow-up': return 'Follow Up';
      case 'screening': return 'Screening';
      case 'interview': return 'Interview';
      case 'offer': return 'Offer';
      case 'hired': return 'Hired';
      default: return 'Applied';
    }
  }
}

/**
 * Map interaction status to candidate stage
 * Used when creating candidates from interaction notes
 * @param {string} interactionStatus - Status from interaction_notes table
 * @returns {string} Candidate stage (legacy format)
 */
function mapInteractionStatusToStage(interactionStatus) {
  if (!interactionStatus) {
    return 'Applied';
  }

  const normalized = interactionStatus.toLowerCase().trim();

  // Map interaction statuses to candidate stages
  const statusMapping = {
    'interested': 'Applied',
    'no response': 'Applied',
    'follow-up': 'Applied',
    'callback': 'Applied',
    'shortlisted': 'Screening',
    'screening': 'Screening',
    'interview': 'Interview',
    'scheduled': 'Interview',
    'selected': 'Offer',
    'offer': 'Offer',
    'joined': 'Hired',
    'hired': 'Hired',
    'rejected': 'On Hold',
    'not interested': 'On Hold',
    'declined': 'On Hold',
  };

  return statusMapping[normalized] || 'Applied';
}

export {
  detectStage,
  getLegacyStage,
  mapInteractionStatusToStage,
  normalizeText,
  STAGE_ALIASES,
  COLOR_HINTS
};
