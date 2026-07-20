/** Stages stored in MySQL `candidates.stage` ENUM. */
export const DB_CANDIDATE_STAGES = new Set([
  'Applied',
  'Follow Up',
  'Screening',
  'Interview',
  'Offer',
  'Hired',
  'On Hold',
  'Rejected',
  'No Show - Interview',
  'No Show - Onboarding',
  'Last Minute Back Out',
  'Profile Not Matched',
  'Selected',
]);

export const STAGE_UI_TO_DB: Record<string, string> = {
  'Follow Up (Interview)': 'Follow Up',
  'Came Down': 'Interview',
  "Didn't Come": 'Interview',
  'Selected (Interview)': 'Selected',
  'Rejected (Interview)': 'Rejected',
  'Assignment Sent': 'Screening',
  'Assignment Submitted': 'Screening',
};

export function normalizeStageForDisplay(stage?: string | null): string {
  const raw = stage == null ? '' : String(stage).trim();
  if (!raw) return 'Applied';
  if (DB_CANDIDATE_STAGES.has(raw)) return raw;
  if (STAGE_UI_TO_DB[raw]) return STAGE_UI_TO_DB[raw];
  return 'Applied';
}

/** Interview sub-stage columns shown in the flat kanban MOVE TO menu. */
export const INTERVIEW_KANBAN_SUB_STAGES: Record<
  string,
  { subStage: string; escalateTo?: string }
> = {
  'Follow Up (Interview)': { subStage: 'follow-up-interview' },
  'Came Down': { subStage: 'came-down' },
  "Didn't Come": { subStage: 'no-show' },
  'Selected (Interview)': { subStage: 'selected-interview', escalateTo: 'Offer' },
  'Rejected (Interview)': { subStage: 'rejected-interview', escalateTo: 'Rejected' },
};

const REJECTED_SUB_STAGE_TO_COLUMN: Record<string, string> = {
  'on-hold': 'On Hold',
  'profile-not-matched': 'Profile Not Matched',
  'last-minute-back-out': 'Last Minute Back Out',
  rejected: 'Rejected',
};

export function isInterviewKanbanSubStage(stage: string): boolean {
  return Object.prototype.hasOwnProperty.call(INTERVIEW_KANBAN_SUB_STAGES, stage);
}

/** MOVE TO menu label for the candidate's current interview sub-stage, if any. */
export function getInterviewSubStageMenuLabel(candidate: {
  mainStage?: string | null;
  subStage?: string | null;
}): string | null {
  if (candidate.mainStage !== 'interview' || !candidate.subStage) return null;
  return (
    Object.entries(INTERVIEW_KANBAN_SUB_STAGES).find(
      ([, config]) => config.subStage === candidate.subStage
    )?.[0] ?? null
  );
}

/**
 * Flat kanban bucket keys that may hold interview candidates.
 * The visible board uses the Interview umbrella column only; these keys are for
 * MOVE TO labels and merging any legacy/orphaned buckets.
 */
export const INTERVIEW_KANBAN_COLUMN_KEYS = [
  'Interview',
  ...Object.keys(INTERVIEW_KANBAN_SUB_STAGES),
] as const;

/** Merge interview candidates from all related buckets (deduped by id). */
export function collectInterviewColumnCandidates(
  byStage: Record<string, { id: string }[]>
): { id: string }[] {
  const seen = new Set<string>();
  const result: { id: string }[] = [];
  for (const key of INTERVIEW_KANBAN_COLUMN_KEYS) {
    for (const c of byStage[key] || []) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        result.push(c);
      }
    }
  }
  return result;
}

/**
 * Kanban column key for grouping cards on the board.
 * Interview sub-stages map to the Interview umbrella column (not flat sub-columns).
 */
export function getKanbanColumnForCandidate(candidate: {
  stage?: string | null;
  mainStage?: string | null;
  subStage?: string | null;
}): string {
  if (candidate.mainStage === 'interview') {
    return 'Interview';
  }

  if (candidate.mainStage === 'selected') {
    return 'Selected';
  }

  if (candidate.mainStage === 'hired') {
    return 'Hired';
  }

  if (candidate.mainStage === 'rejected' && candidate.subStage) {
    return REJECTED_SUB_STAGE_TO_COLUMN[candidate.subStage] || 'Rejected';
  }

  const raw = candidate.stage == null ? '' : String(candidate.stage).trim();
  if (isInterviewKanbanSubStage(raw)) return 'Interview';
  if (raw === 'On Hold' || raw === 'Profile Not Matched' || raw === 'Last Minute Back Out') {
    return raw;
  }

  const normalized = normalizeStageForDisplay(candidate.stage);
  if (normalized === 'Interview') {
    return 'Interview';
  }
  if (normalized === 'Selected') {
    return 'Selected';
  }

  return normalized;
}

/** True when the candidate must be moved to Interview before setting an interview sub-stage. */
export function candidateNeedsInterviewStageMove(candidate: {
  stage?: string | null;
  mainStage?: string | null;
}): boolean {
  if (candidate.mainStage === 'interview') return false;
  const dbStage = normalizeStageForDisplay(candidate.stage);
  return dbStage !== 'Interview';
}

/** Stages safe to pick in add/edit form (avoids invalid ENUM writes). */
export const FORM_SELECTABLE_STAGES = [
  'Applied',
  'Follow Up',
  'Screening',
  'Interview',
  'Selected',
  'Offer',
  'Hired',
  'Rejected',
  'On Hold',
  'Profile Not Matched',
  'Last Minute Back Out',
  'No Show - Interview',
  'No Show - Onboarding',
] as const;
