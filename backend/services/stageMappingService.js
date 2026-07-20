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

  // ── NEW: Selected (standalone stage — color #92D050) ──────────
  'selected': { mainStage: 'selected', legacyStage: 'Selected' },
  'shortlisted': { mainStage: 'selected', legacyStage: 'Selected' },
  'cleared': { mainStage: 'selected', legacyStage: 'Selected' },
  'approved': { mainStage: 'selected', legacyStage: 'Selected' },

  // ── NEW: Not Relevant (color #FFC000 → profile-not-matched) ───
  'not relevant': { mainStage: 'rejected', subStage: 'profile-not-matched', legacyStage: 'Profile Not Matched' },
  'irrelevant': { mainStage: 'rejected', subStage: 'profile-not-matched', legacyStage: 'Profile Not Matched' },
  'not a fit': { mainStage: 'rejected', subStage: 'profile-not-matched', legacyStage: 'Profile Not Matched' },

  // ── NEW: Didn't Respond (color #7F7F7F → no-response) ─────────
  "didn't respond": { mainStage: 'follow-up', subStage: 'no-response', legacyStage: 'Follow Up' },
  'didnt respond': { mainStage: 'follow-up', subStage: 'no-response', legacyStage: 'Follow Up' },
  'did not respond': { mainStage: 'follow-up', subStage: 'no-response', legacyStage: 'Follow Up' },
  'no response': { mainStage: 'follow-up', subStage: 'no-response', legacyStage: 'Follow Up' },
  'no-response': { mainStage: 'follow-up', subStage: 'no-response', legacyStage: 'Follow Up' },
  'unresponsive': { mainStage: 'follow-up', subStage: 'no-response', legacyStage: 'Follow Up' },
  'not reachable': { mainStage: 'follow-up', subStage: 'no-response', legacyStage: 'Follow Up' },
  'unreachable': { mainStage: 'follow-up', subStage: 'no-response', legacyStage: 'Follow Up' },
};

/** Keywords in remarks that imply rejection (Book1.xlsx tracker style) */
const REJECT_REMARK_KEYWORDS = [
  'reject', 'not selected', 'not a relevant', 'not relevant',
  'lack of', 'ditched', 'did not show', "didn't show",
  'did not attend', "didn't attend", 'did not come', "didn't come",
  'no show', 'fake experience', 'out of budget', 'language issue',
  'attitude issue', 'not a graduate', 'not an id', 'not core id',
  'profile not matched',
];

/**
 * Color-based stage hints
 *
 * NEW REQUIRED COLOR SYSTEM (v2) — these are the ONLY colors used for
 * Excel name-cell color detection. Each entry is the primary color plus
 * near-tolerance shades so minor Excel rendering differences still match.
 *
 *  Rejected                → #FF0000  (Bright Red)
 *  Selected                → #92D050  (Light Green)
 *  Not Relevant            → #FFC000  (Gold Yellow)  → profile-not-matched
 *  Follow up               → #00B0F0  (Bright Blue)
 *  Came Down for interview → #FFFF00  (Bright Yellow)
 *  Didn't came down        → #7030A0  (Purple)       → no-show
 *  didn't respond          → #7F7F7F  (Gray)         → no-response
 */
const COLOR_HINTS = {
  // ── 7 REQUIRED WORKFLOW COLORS ──────────────────────────────
  'rejected':            ['#FF0000', '#EE0000', '#CC0000', '#FF1111', '#FF2222'],
  'selected':            ['#92D050', '#8DC44A', '#9AD855', '#85C040', '#A0D860'],
  'profile-not-matched': ['#FFC000', '#FFB800', '#FFCA00', '#F0B400', '#FFD000'],
  'follow-up':           ['#00B0F0', '#00A8E8', '#00B8F8', '#00A0E0', '#10B8F0'],
  'came-down':           ['#FFFF00', '#F8F800', '#FFFF11', '#EEEE00', '#FFFF22'],
  'no-show':             ['#7030A0', '#6828A0', '#7838A8', '#6020A0', '#8040B0'],
  'no-response':         ['#7F7F7F', '#787878', '#888888', '#707070', '#909090'],
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
 * Detect stage from Stage/Status text only.
 * @param {string} cellValue
 * @param {Object} [options]
 * @returns {Object|null}
 */
function detectStageFromText(cellValue, options = {}) {
  const {
    allowFuzzyMatch = true,
    confidenceThreshold = 0.7,
  } = options;

  if (!cellValue || typeof cellValue !== 'string' || !cellValue.trim()) {
    return null;
  }

  const normalized = normalizeText(cellValue);

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

  // Sheet "Selected" = shortlisted candidate → Selected Kanban column, NOT Offer
  if (/\b(selected|shortlisted|cleared|approved)\b/i.test(normalized)
      && !/\b(not selected|unselected|deselected|rejected)\b/i.test(normalized)) {
    return {
      mainStage: 'selected',
      subStage: null,
      confidence: 0.95,
      matchMethod: 'exact',
      originalValue: cellValue,
      legacyStage: 'Selected',
    };
  }

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

  return null;
}

/**
 * Infer stage from free-text remarks (Book1-style trackers).
 * @param {string} remarks
 * @returns {Object|null}
 */
function detectStageFromRemarks(remarks) {
  if (!remarks || typeof remarks !== 'string') return null;

  const remarksNorm = remarks.trim().toLowerCase();
  if (!remarksNorm) return null;

  if (REJECT_REMARK_KEYWORDS.some(kw => remarksNorm.includes(kw))) {
    return {
      mainStage: 'rejected',
      subStage: 'rejected',
      legacyStage: 'Rejected',
      confidence: 0.65,
      matchMethod: 'remarks-keyword',
      originalValue: remarks,
    };
  }

  if (remarksNorm.includes('on hold') && !remarksNorm.includes('reject')) {
    return {
      mainStage: 'rejected',
      subStage: 'on-hold',
      legacyStage: 'On Hold',
      confidence: 0.65,
      matchMethod: 'remarks-keyword',
      originalValue: remarks,
    };
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
 * Get legacy stage name from main_stage and sub_stage.
 * Mirrors the database function get_legacy_stage_name().
 *
 * NEW STAGES:
 *  selected              → 'Selected'
 *  follow-up/no-response → 'Follow Up'
 */
function getLegacyStage(mainStage, subStage) {
  if (mainStage === 'rejected') {
    switch (subStage) {
      case 'rejected':              return 'Rejected';
      case 'on-hold':               return 'On Hold';
      case 'profile-not-matched':   return 'Profile Not Matched';
      case 'last-minute-back-out':  return 'Last Minute Back Out';
      default:                      return 'Rejected';
    }
  }

  if (mainStage === 'interview') {
    // All interview sub-stages map to 'Interview' for legacy compatibility
    return 'Interview';
  }

  if (mainStage === 'follow-up') {
    // follow-up/no-response still maps to 'Follow Up' in legacy column
    return 'Follow Up';
  }

  switch (mainStage) {
    case 'applied':   return 'Applied';
    case 'follow-up': return 'Follow Up';
    case 'screening': return 'Screening';
    case 'interview': return 'Interview';
    case 'offer':     return 'Offer';
    case 'hired':     return 'Hired';
    case 'selected':  return 'Selected';
    default:          return 'Applied';
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
    'selected': 'Selected',
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
  detectStageFromText,
  detectStageFromRemarks,
  getLegacyStage,
  mapInteractionStatusToStage,
  normalizeText,
  STAGE_ALIASES,
  COLOR_HINTS
};
