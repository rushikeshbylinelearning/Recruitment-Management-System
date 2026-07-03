import raw from '../../shared/jobCardCategoryMapping.json';

/**
 * Normalize role/position strings for category matching (case, spacing, hyphens).
 * Mirrors `backend/services/jobCardCategoryAggregation.js`.
 */
export function normalizeRole(role: string | null | undefined): string {
  if (role == null || typeof role !== 'string') return '';
  return role
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/-/g, ' ')
    .trim();
}

/** Canonical dashboard card title → internal category id */
export const FIXED_CARD_TITLE_TO_CATEGORY_KEY = raw.fixedCardTitleToCategoryKey as Record<string, string>;

/** Category id → role aliases (exact match after normalization) */
export const JOB_CATEGORY_MAPPING = raw.categories as Record<string, string[]>;
