/**
 * Stage Mapping Service
 * 
 * Maps interaction statuses from the Interaction Memory system to candidate stages
 * in the main pipeline. This enables automatic stage assignment when creating
 * candidates from interactions.
 * 
 * Requirements: Stage Mapping Logic
 */

/**
 * Map interaction status to candidate pipeline stage
 * 
 * Mapping Rules:
 * - Interested, No Response, Follow-up → Applied
 * - Shortlisted → Screening
 * - Interview → Interview
 * - Selected → Offer
 * - Joined → Hired
 * - Rejected → On Hold
 * 
 * @param {string} interactionStatus - Status from interaction_notes or interaction_pipeline
 * @returns {string} Candidate stage for main pipeline
 */
function mapInteractionStatusToStage(interactionStatus) {
  if (!interactionStatus) {
    return 'Applied'; // Default stage for null/undefined status
  }

  const normalizedStatus = interactionStatus.trim();

  // Map interaction statuses to candidate stages
  switch (normalizedStatus) {
    case 'Interested':
    case 'No Response':
    case 'Follow-up':
      return 'Applied';

    case 'Shortlisted':
      return 'Screening';

    case 'Interview':
      return 'Interview';

    case 'Selected':
      return 'Offer';

    case 'Joined':
      return 'Hired';

    case 'Rejected':
      return 'On Hold';

    default:
      // For any unmapped status, default to Applied
      return 'Applied';
  }
}

export {
  mapInteractionStatusToStage
};
