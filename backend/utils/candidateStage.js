/** Stages allowed in MySQL `candidates.stage` ENUM column. */
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

/** Map UI / umbrella sub-stage labels to a valid DB enum value. */
export const STAGE_UI_TO_DB = {
  'Follow Up (Interview)': 'Follow Up',
  'Came Down': 'Interview',
  "Didn't Come": 'Interview',
  'Selected (Interview)': 'Selected',
  'Rejected (Interview)': 'Rejected',
  'Assignment Sent': 'Screening',
  'Assignment Submitted': 'Screening',
};

/**
 * Ensure stage is valid for DB insert/update and Kanban columns.
 * Invalid or empty values default to Applied.
 */
export function normalizeStageForDb(stage) {
  const raw = stage == null ? '' : String(stage).trim();
  if (!raw) return 'Applied';
  if (DB_CANDIDATE_STAGES.has(raw)) return raw;
  if (STAGE_UI_TO_DB[raw]) return STAGE_UI_TO_DB[raw];
  return 'Applied';
}

export function isDisplayableKanbanStage(stage) {
  const normalized = normalizeStageForDb(stage);
  return DB_CANDIDATE_STAGES.has(normalized);
}
