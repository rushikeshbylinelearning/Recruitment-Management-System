/**
 * Stage Mapping Service
 * 
 * Intelligent stage detection and mapping for bulk candidate import
 * Supports hierarchical umbrella stage architecture with micro stages
 */

import { DEFAULT_STAGE_CONFIG } from '../types/umbrellaStage';

export interface StageMappingResult {
  mainStage: string;
  subStage?: string;
  confidence: number;
  matchMethod: 'exact' | 'fuzzy' | 'alias' | 'color' | 'fallback';
  originalValue: string;
  legacyStage: string; // For backward compatibility
}

export interface StageDetectionOptions {
  cellValue: string;
  cellColor?: string; // Hex color from Excel
  fontColor?: string;
  allowFuzzyMatch?: boolean;
  confidenceThreshold?: number;
}

/**
 * Comprehensive stage mapping configuration
 * Maps Excel values (including typos and variations) to umbrella stages
 */
const STAGE_ALIASES: Record<string, { mainStage: string; subStage?: string; legacyStage: string }> = {
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

/**
 * Color-based stage hints
 *
 * NEW REQUIRED COLOR SYSTEM (v2) — mirrors backend stageColorMapping.js.
 * These are the ONLY colors used for Excel name-cell color detection.
 *
 *  Rejected                → #FF0000  (Bright Red)
 *  Selected                → #92D050  (Light Green)
 *  Not Relevant            → #FFC000  (Gold Yellow)  → profile-not-matched
 *  Follow up               → #00B0F0  (Bright Blue)
 *  Came Down for interview → #FFFF00  (Bright Yellow)
 *  Didn't came down        → #7030A0  (Purple)       → no-show
 *  didn't respond          → #7F7F7F  (Gray)         → no-response
 */
const COLOR_HINTS: Record<string, string[]> = {
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
function normalizeText(text: string): string {
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
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

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
function calculateSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;
  
  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLength;
}

/**
 * Check if color matches stage hint
 */
function matchColorHint(color: string | undefined, stageId: string): boolean {
  if (!color) return false;
  
  const normalizedColor = color.toUpperCase();
  const hints = COLOR_HINTS[stageId] || [];
  
  return hints.some(hint => {
    // Exact match
    if (normalizedColor === hint) return true;
    
    // Close match (within RGB tolerance)
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
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Main stage detection function
 */
export function detectStage(options: StageDetectionOptions): StageMappingResult {
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
      subStage: mapping.subStage,
      confidence: 1.0,
      matchMethod: 'exact',
      originalValue: cellValue,
      legacyStage: mapping.legacyStage,
    };
  }

  // 2. Fuzzy match with aliases
  if (allowFuzzyMatch) {
    let bestMatch: { alias: string; similarity: number; mapping: typeof STAGE_ALIASES[string] } | null = null;

    for (const [alias, mapping] of Object.entries(STAGE_ALIASES)) {
      const similarity = calculateSimilarity(normalized, alias);
      
      if (similarity >= confidenceThreshold && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { alias, similarity, mapping };
      }
    }

    if (bestMatch) {
      return {
        mainStage: bestMatch.mapping.mainStage,
        subStage: bestMatch.mapping.subStage,
        confidence: bestMatch.similarity,
        matchMethod: 'fuzzy',
        originalValue: cellValue,
        legacyStage: bestMatch.mapping.legacyStage,
      };
    }
  }

  // 3. Color-based hint (if text match failed)
  if (cellColor || fontColor) {
    for (const [stageId, colors] of Object.entries(COLOR_HINTS)) {
      if (matchColorHint(cellColor, stageId) || matchColorHint(fontColor, stageId)) {
        // Find the mapping for this stageId — check both mainStage and subStage keys
        const defaultMapping = Object.values(STAGE_ALIASES).find(m =>
          m.mainStage === stageId || m.subStage === stageId
        );

        if (defaultMapping) {
          return {
            mainStage: defaultMapping.mainStage,
            subStage: defaultMapping.subStage,
            confidence: 0.9,   // High confidence — exact color match
            matchMethod: 'color',
            originalValue: cellValue,
            legacyStage: defaultMapping.legacyStage,
          };
        }

        // Handle stageIds that are main stages without a sub-stage alias
        // e.g. 'selected', 'follow-up'
        const directMapping: Record<string, { mainStage: string; subStage?: string; legacyStage: string }> = {
          'selected':            { mainStage: 'selected',  legacyStage: 'Selected' },
          'follow-up':           { mainStage: 'follow-up', legacyStage: 'Follow Up' },
          'rejected':            { mainStage: 'rejected',  subStage: 'rejected',            legacyStage: 'Rejected' },
          'profile-not-matched': { mainStage: 'rejected',  subStage: 'profile-not-matched', legacyStage: 'Profile Not Matched' },
          'came-down':           { mainStage: 'interview', subStage: 'came-down',            legacyStage: 'Interview' },
          'no-show':             { mainStage: 'interview', subStage: 'no-show',              legacyStage: 'Interview' },
          'no-response':         { mainStage: 'follow-up', subStage: 'no-response',          legacyStage: 'Follow Up' },
        };

        if (directMapping[stageId]) {
          const m = directMapping[stageId];
          return {
            mainStage: m.mainStage,
            subStage: m.subStage,
            confidence: 0.9,
            matchMethod: 'color',
            originalValue: cellValue,
            legacyStage: m.legacyStage,
          };
        }
      }
    }
  }

  // 4. Fallback to Applied
  return {
    mainStage: 'applied',
    subStage: undefined,
    confidence: 0.3,
    matchMethod: 'fallback',
    originalValue: cellValue,
    legacyStage: 'Applied',
  };
}

/**
 * Batch detect stages from multiple rows
 */
export function detectStagesBatch(
  rows: Array<{ cellValue: string; cellColor?: string; fontColor?: string }>
): StageMappingResult[] {
  return rows.map(row => detectStage(row));
}

/**
 * Get stage statistics from detection results
 */
export function getStageStatistics(results: StageMappingResult[]): {
  totalCandidates: number;
  byMainStage: Record<string, number>;
  bySubStage: Record<string, number>;
  byConfidence: { high: number; medium: number; low: number };
  byMethod: Record<string, number>;
  unmapped: number;
} {
  const stats = {
    totalCandidates: results.length,
    byMainStage: {} as Record<string, number>,
    bySubStage: {} as Record<string, number>,
    byConfidence: { high: 0, medium: 0, low: 0 },
    byMethod: {} as Record<string, number>,
    unmapped: 0,
  };

  results.forEach(result => {
    // Count by main stage
    stats.byMainStage[result.mainStage] = (stats.byMainStage[result.mainStage] || 0) + 1;

    // Count by sub stage
    if (result.subStage) {
      const key = `${result.mainStage}/${result.subStage}`;
      stats.bySubStage[key] = (stats.bySubStage[key] || 0) + 1;
    }

    // Count by confidence
    if (result.confidence >= 0.9) stats.byConfidence.high++;
    else if (result.confidence >= 0.7) stats.byConfidence.medium++;
    else stats.byConfidence.low++;

    // Count by method
    stats.byMethod[result.matchMethod] = (stats.byMethod[result.matchMethod] || 0) + 1;

    // Count unmapped (fallback)
    if (result.matchMethod === 'fallback') stats.unmapped++;
  });

  return stats;
}

/**
 * Validate stage mapping result
 */
export function validateStageMapping(result: StageMappingResult): {
  isValid: boolean;
  warnings: string[];
  suggestions: string[];
} {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check confidence
  if (result.confidence < 0.7) {
    warnings.push(`Low confidence match (${Math.round(result.confidence * 100)}%)`);
    suggestions.push('Consider reviewing this mapping manually');
  }

  // Check fallback
  if (result.matchMethod === 'fallback') {
    warnings.push('Stage could not be detected, defaulted to "Applied"');
    suggestions.push('Update the Excel cell with a recognized stage name');
  }

  // Check fuzzy match
  if (result.matchMethod === 'fuzzy') {
    warnings.push('Fuzzy match used - possible typo in original value');
    suggestions.push(`Did you mean: "${result.legacyStage}"?`);
  }

  // Check color-only match
  if (result.matchMethod === 'color') {
    warnings.push('Matched by color only - text was not recognized');
    suggestions.push('Add proper stage text to the cell for better accuracy');
  }

  return {
    isValid: result.confidence >= 0.5,
    warnings,
    suggestions,
  };
}

/**
 * Get all available stages for dropdown/selection
 */
export function getAllAvailableStages(): Array<{
  mainStage: string;
  subStage?: string;
  displayName: string;
  legacyStage: string;
  isUmbrella: boolean;
}> {
  const stages: Array<{
    mainStage: string;
    subStage?: string;
    displayName: string;
    legacyStage: string;
    isUmbrella: boolean;
  }> = [];

  DEFAULT_STAGE_CONFIG.mainStages.forEach(stage => {
    if (stage.isUmbrella && stage.subStages) {
      // Add umbrella stage itself
      stages.push({
        mainStage: stage.id,
        displayName: stage.name,
        legacyStage: stage.name,
        isUmbrella: true,
      });

      // Add sub-stages
      stage.subStages.forEach(subStage => {
        const legacyName = Object.entries(STAGE_ALIASES).find(
          ([_, mapping]) => 
            mapping.mainStage === stage.id && mapping.subStage === subStage.id
        )?.[1].legacyStage || subStage.name;

        stages.push({
          mainStage: stage.id,
          subStage: subStage.id,
          displayName: `${stage.name} → ${subStage.name}`,
          legacyStage: legacyName,
          isUmbrella: false,
        });
      });
    } else {
      // Regular stage
      stages.push({
        mainStage: stage.id,
        displayName: stage.name,
        legacyStage: stage.name,
        isUmbrella: false,
      });
    }
  });

  return stages;
}
