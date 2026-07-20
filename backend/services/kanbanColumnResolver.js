/**
 * Resolve the Kanban board column where an imported candidate will appear.
 * Mirrors frontend getKanbanColumnForCandidate (src/utils/candidateStage.ts).
 *
 * @param {string} mainStage
 * @param {string|null} subStage
 * @param {string} legacyStage
 * @returns {string}
 */
export function getKanbanColumnForImport(mainStage, subStage, legacyStage) {
  if (mainStage === 'interview') return 'Interview';
  if (mainStage === 'selected') return 'Selected';
  if (mainStage === 'hired') return 'Hired';
  if (mainStage === 'offer') return 'Offer';

  if (mainStage === 'rejected' && subStage) {
    const map = {
      'on-hold': 'On Hold',
      'profile-not-matched': 'Profile Not Matched',
      'last-minute-back-out': 'Last Minute Back Out',
      rejected: 'Rejected',
    };
    return map[subStage] || 'Rejected';
  }

  if (mainStage === 'follow-up') return 'Follow Up';
  if (mainStage === 'screening') return 'Screening';
  if (mainStage === 'applied') return 'Applied';

  return legacyStage || 'Applied';
}

export default { getKanbanColumnForImport };
