import { Candidate as ApiCandidate } from '../services/api';

function parseSortTime(value?: string | null): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Newest on top for kanban columns.
 * Priority: stageUpdatedAt (last stage/sub-stage move) → createdAt → appliedDate.
 */
export function compareCandidatesNewestFirst(a: ApiCandidate, b: ApiCandidate): number {
  const stageA = parseSortTime(a.stageUpdatedAt);
  const stageB = parseSortTime(b.stageUpdatedAt);
  if (stageB !== stageA) return stageB - stageA;

  const createdA = parseSortTime(a.createdAt);
  const createdB = parseSortTime(b.createdAt);
  if (createdB !== createdA) return createdB - createdA;

  return parseSortTime(b.appliedDate) - parseSortTime(a.appliedDate);
}

export function sortCandidatesNewestFirst<T extends ApiCandidate>(list: T[]): T[] {
  return [...list].sort(compareCandidatesNewestFirst);
}

/** Stamp a candidate as just moved (optimistic kanban reorder). */
export function withStageSortTimestamp<T extends ApiCandidate>(candidate: T): T {
  return { ...candidate, stageUpdatedAt: new Date().toISOString() };
}
