import raw from '../../shared/jobCardCategoryMapping.json';

function canonicalizeRoleTypos(s: string): string {
  return s
    .replace(/\bwritters\b/g, 'writers')
    .replace(/\bwritter\b/g, 'writer');
}

/**
 * Normalize role/position strings for category matching (case, spacing, hyphens, typos).
 * Mirrors `backend/services/jobCardCategoryAggregation.js`.
 */
export function normalizeRole(role: string | null | undefined): string {
  if (role == null || typeof role !== 'string') return '';
  const base = role
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/-/g, ' ')
    .trim();
  return canonicalizeRoleTypos(base);
}

/** Canonical dashboard card title → internal category id */
export const FIXED_CARD_TITLE_TO_CATEGORY_KEY = raw.fixedCardTitleToCategoryKey as Record<string, string>;

/** Category id → role aliases (exact match after normalization) */
export const JOB_CATEGORY_MAPPING = raw.categories as Record<string, string[]>;
