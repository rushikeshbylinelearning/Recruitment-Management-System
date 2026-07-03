import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Safe fallback when mapping file is missing on disk (common if only `backend/` is deployed). */
const EMPTY_JOB_CARD_MAPPING = { fixedCardTitleToCategoryKey: {}, categories: {} };

let _cachedMapping = null;

function mappingFileCandidates() {
  return [
    // First check if mapping is in the backend directory itself (for production deployments)
    join(__dirname, 'jobCardCategoryMapping.json'),
    // Then check relative to backend directory
    join(__dirname, '../../shared/jobCardCategoryMapping.json'),
    // Check from process.cwd()
    join(process.cwd(), 'shared/jobCardCategoryMapping.json'),
    join(process.cwd(), '../shared/jobCardCategoryMapping.json'),
    // Also check in backend/config directory
    join(__dirname, '../jobCardCategoryMapping.json'),
  ];
}

/**
 * Fix common position typos before category matching (e.g. Excel "Writter").
 * @param {string} s - already lowercased
 * @returns {string}
 */
function canonicalizeRoleTypos(s) {
  return s
    .replace(/\bwritters\b/g, 'writers')
    .replace(/\bwritter\b/g, 'writer');
}

/**
 * Normalize role/position for category matching (case, spacing, hyphens, typos).
 * @param {string} role
 * @returns {string}
 */
export function normalizeRole(role) {
  if (role == null || typeof role !== 'string') return '';
  const base = role
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/-/g, ' ')
    .trim();
  return canonicalizeRoleTypos(base);
}

/**
 * Canonical display form for position (title case, typo fixes).
 * Use on import so DB stores values that match job card aliases.
 * @param {string} position
 * @returns {string}
 */
export function canonicalizePositionForStorage(position) {
  if (position == null || typeof position !== 'string') return '';
  const trimmed = position.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const lower = canonicalizeRoleTypos(trimmed.toLowerCase());
  return lower.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function loadJobCardCategoryMapping() {
  if (_cachedMapping) return _cachedMapping;
  for (const path of mappingFileCandidates()) {
    try {
      const raw = readFileSync(path, 'utf8');
      _cachedMapping = JSON.parse(raw);
      return _cachedMapping;
    } catch {
      // try next path
    }
  }
  console.warn(
    '[jobCardCategoryAggregation] jobCardCategoryMapping.json not found or invalid; tried:',
    mappingFileCandidates().join(' | '),
    '- category dashboard totals will be empty until the file is deployed beside the backend.'
  );
  _cachedMapping = EMPTY_JOB_CARD_MAPPING;
  return _cachedMapping;
}

/** @param {Array<{ position: string, cnt?: number, count?: number }>} rows */
export function mergeCountsByNormalizedPosition(rows) {
  const map = new Map();
  for (const row of rows) {
    const pos = row.position;
    const n = normalizeRole(pos);
    if (!n) continue;
    const c = Number(row.cnt ?? row.count ?? 0);
    map.set(n, (map.get(n) || 0) + c);
  }
  return map;
}

/**
 * Run one grouped query on candidates and return applicant totals per dashboard job card title.
 * @param {Function} query - DB query function from config/database.js
 * @returns {Promise<Record<string, number>>}
 */
export async function computeJobCardApplicantTotals(query) {
  let rows = [];
  try {
    rows = await query(
      `SELECT \`position\` AS position, COUNT(*) AS cnt
       FROM candidates
       WHERE \`position\` IS NOT NULL AND TRIM(\`position\`) != ''
       GROUP BY \`position\``
    );
  } catch (e) {
    console.warn(
      '[jobCardCategoryAggregation] Skipping position-based totals:',
      e.code || e.message
    );
  }
  const merged = mergeCountsByNormalizedPosition(rows);
  return computeTotalsByFixedCardTitle(loadJobCardCategoryMapping(), merged);
}

/**
 * @param {object} mapping
 * @param {Map<string, number>} mergedNormalizedCounts
 * @returns {Record<string, number>}
 */
export function computeTotalsByFixedCardTitle(mapping, mergedNormalizedCounts) {
  const { fixedCardTitleToCategoryKey, categories } = mapping;
  const out = {};
  for (const [title, catKey] of Object.entries(fixedCardTitleToCategoryKey)) {
    const aliases = categories[catKey];
    if (!aliases) {
      out[title] = 0;
      continue;
    }
    const aliasSet = new Set(aliases.map((a) => normalizeRole(a)).filter(Boolean));
    let sum = 0;
    for (const [normPos, c] of mergedNormalizedCounts) {
      if (aliasSet.has(normPos)) sum += c;
    }
    out[title] = sum;
  }
  return out;
}

export function getAllowedFixedCardTitles(mapping = loadJobCardCategoryMapping()) {
  return new Set(Object.keys(mapping.fixedCardTitleToCategoryKey || {}));
}

/**
 * @param {object} mapping
 * @param {string} fixedCardTitle
 * @returns {Set<string>} normalized role aliases for that card
 */
export function getNormalizedAliasSetForFixedCard(mapping, fixedCardTitle) {
  const catKey = mapping.fixedCardTitleToCategoryKey[fixedCardTitle];
  if (!catKey) return new Set();
  const aliases = mapping.categories[catKey];
  if (!aliases) return new Set();
  return new Set(aliases.map((a) => normalizeRole(a)).filter(Boolean));
}

/**
 * Distinct raw position strings from DB rows whose normalized form matches a fixed card.
 * @param {Array<{ position: string }>} distinctRows
 * @param {object} mapping
 * @param {string} fixedCardTitle
 * @returns {string[]}
 */
export function filterDistinctPositionsForFixedCard(distinctRows, mapping, fixedCardTitle) {
  const want = getNormalizedAliasSetForFixedCard(mapping, fixedCardTitle);
  if (want.size === 0) return [];
  const originals = [];
  const seen = new Set();
  for (const row of distinctRows) {
    const raw = (row.position || '').trim();
    if (!raw) continue;
    const n = normalizeRole(raw);
    if (!want.has(n)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    originals.push(raw);
  }
  return originals;
}
