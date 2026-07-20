/**
 * Row Color Resolver
 *
 * Unified stage detection from Excel rows supporting:
 *  - Candidate Name cell color (official template)
 *  - Row-level coloring (Book1.xlsx and legacy trackers)
 *  - Stage/Status text
 *  - Remarks keyword inference
 */

import {
  detectStageByColor,
  normalizeColor,
} from './colorDetectionEngine.js';
import { detectStageFromRemarks, detectStageFromText } from './stageMappingService.js';

/** Header variants for the candidate name column */
export const NAME_COLUMN_HEADERS = [
  'Name', 'Candidate Name', 'Full Name', 'Candidate',
  'name', 'candidate name', 'full name', 'candidate',
  'CANDIDATE NAME', 'NAME', 'Candidate name',
];

/** Colors treated as "no fill" — ignored during row scans */
const NEUTRAL_COLORS = new Set([
  '#FFFFFF', '#FFF', '#000000', '#000',
  '#F2F2F2', '#FFFFFF00',
]);

/**
 * Extract fill color from a candidate name column.
 * @param {Object} cellColors - Map of header → hex color
 * @returns {string|null}
 */
export function extractNameCellColor(cellColors) {
  if (!cellColors || typeof cellColors !== 'object') return null;

  for (const header of NAME_COLUMN_HEADERS) {
    if (cellColors[header]) {
      const normalized = normalizeColor(cellColors[header]);
      if (normalized && !NEUTRAL_COLORS.has(normalized)) {
        return normalized;
      }
    }
  }
  return null;
}

/**
 * Collect unique non-neutral fill colors from all cells in a row.
 * @param {Object} cellColors - Map of header → hex color
 * @returns {string[]}
 */
export function extractRowColors(cellColors) {
  if (!cellColors || typeof cellColors !== 'object') return [];

  const seen = new Set();
  const colors = [];

  for (const hex of Object.values(cellColors)) {
    const normalized = normalizeColor(hex);
    if (!normalized || NEUTRAL_COLORS.has(normalized) || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    colors.push(normalized);
  }

  return colors;
}

/**
 * Try to match a list of colors to workflow stages; return the best match.
 * @param {string[]} colors
 * @returns {Object|null}
 */
export function detectBestStageFromColors(colors) {
  if (!colors || colors.length === 0) return null;

  let best = null;

  for (const color of colors) {
    const match = detectStageByColor(color, { tolerance: 35 });
    if (!match) continue;

    if (!best || match.confidence > best.confidence) {
      best = {
        mainStage: match.mainStage,
        subStage: match.subStage || null,
        legacyStage: match.legacyStage,
        confidence: match.confidence,
        matchMethod: match.matchMethod,
        detectedColor: match.detectedColor,
        originalColor: color,
      };
    }
  }

  return best;
}

/**
 * Resolve candidate workflow stage from all available row signals.
 *
 * Priority:
 *  1. Stage/Status text (high confidence)
 *  2. Candidate Name cell color
 *  3. Any row-level cell color
 *  4. Stage/Status text (lower confidence)
 *  5. Remarks keyword rules (Book1-style)
 *  6. Fallback → Applied
 *
 * @param {Object} options
 * @param {string} [options.stageText]
 * @param {Object} [options.cellColors]
 * @param {string[]} [options.rowColors]
 * @param {string} [options.remarks]
 * @param {boolean} [options.allowFuzzyMatch=true]
 * @returns {Object} StageMappingResult with colorSource
 */
export function resolveStageFromRow(options = {}) {
  const {
    stageText = '',
    cellColors = {},
    rowColors,
    remarks = '',
    allowFuzzyMatch = true,
  } = options;

  const nameCellColor = extractNameCellColor(cellColors);
  const allRowColors = (rowColors && rowColors.length > 0)
    ? rowColors.map(c => normalizeColor(c)).filter(Boolean)
    : extractRowColors(cellColors);

  // 1. Name cell color (official template — name cell is authoritative)
  if (nameCellColor) {
    const nameMatch = detectStageByColor(nameCellColor, { tolerance: 35 });
    if (nameMatch) {
      return {
        mainStage: nameMatch.mainStage,
        subStage: nameMatch.subStage || null,
        legacyStage: nameMatch.legacyStage,
        confidence: nameMatch.confidence,
        matchMethod: nameMatch.matchMethod,
        originalValue: stageText,
        detectedColor: nameMatch.detectedColor,
        colorSource: 'name',
      };
    }
  }

  // 2. Row-level colors BEFORE text (Book1.xlsx: row color overrides Status column)
  const rowOnlyColors = allRowColors.filter(c => c !== nameCellColor);
  const colorsToScan = rowOnlyColors.length > 0 ? rowOnlyColors : allRowColors;
  const rowMatch = detectBestStageFromColors(colorsToScan);
  if (rowMatch) {
    return {
      ...rowMatch,
      originalValue: stageText,
      colorSource: 'row',
    };
  }

  // 3. Strong text match
  if (stageText && stageText.trim()) {
    const textResult = detectStageFromText(stageText, { allowFuzzyMatch, confidenceThreshold: 0.7 });
    if (textResult && textResult.confidence >= 0.7 && textResult.matchMethod !== 'fallback') {
      return { ...textResult, colorSource: 'text' };
    }
  }

  // 4. Weaker text match
  if (stageText && stageText.trim()) {
    const textResult = detectStageFromText(stageText, { allowFuzzyMatch, confidenceThreshold: 0.4 });
    if (textResult && textResult.confidence >= 0.4 && textResult.matchMethod !== 'fallback') {
      return { ...textResult, colorSource: 'text' };
    }
  }

  // 5. Remarks keyword inference
  const remarksResult = detectStageFromRemarks(remarks);
  if (remarksResult) {
    return {
      ...remarksResult,
      originalValue: stageText,
      colorSource: 'remarks',
    };
  }

  // 6. Fallback
  return {
    mainStage: 'applied',
    subStage: null,
    legacyStage: 'Applied',
    confidence: 0.3,
    matchMethod: 'fallback',
    originalValue: stageText,
    colorSource: 'fallback',
  };
}

export default {
  NAME_COLUMN_HEADERS,
  extractNameCellColor,
  extractRowColors,
  detectBestStageFromColors,
  resolveStageFromRow,
};
