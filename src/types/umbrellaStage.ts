/**
 * Umbrella Stage Type Definitions
 * 
 * Defines the hierarchical stage architecture where main stages
 * can contain nested sub-stages for better organization.
 */

export interface SubStage {
  id: string;
  name: string;
  description?: string;
  escalationRule?: 'none' | 'promote-to-parent' | 'move-to-stage';
  escalationTarget?: string;
}

export interface UmbrellaStage {
  id: string;
  name: string;
  isUmbrella: boolean;
  subStages?: SubStage[];
  accentColor: string;
  autoEscalation?: boolean;
}

export interface StageConfig {
  mainStages: UmbrellaStage[];
}

/**
 * Default stage configuration
 *
 * NEW REQUIRED COLOR SYSTEM (v2) accent colors match the Excel name-cell colors:
 *   Rejected                → #FF0000
 *   Selected                → #92D050
 *   Not Relevant            → #FFC000  (profile-not-matched sub-stage)
 *   Follow up               → #00B0F0
 *   Came Down for interview → #FFFF00
 *   Didn't came down        → #7030A0  (no-show sub-stage)
 *   didn't respond          → #7F7F7F  (no-response sub-stage)
 */
export const DEFAULT_STAGE_CONFIG: StageConfig = {
  mainStages: [
    {
      id: 'applied',
      name: 'Applied',
      isUmbrella: false,
      accentColor: '#dc2626',
    },
    {
      id: 'follow-up',
      name: 'Follow Up',
      isUmbrella: true,
      accentColor: '#00B0F0',   // NEW: Bright Blue
      subStages: [
        {
          id: 'no-response',
          name: "Didn't Respond",
          description: 'Candidate did not respond',
          escalationRule: 'none',
        },
      ],
    },
    {
      id: 'screening',
      name: 'Screening',
      isUmbrella: false,
      accentColor: '#f59e0b',
    },
    {
      id: 'interview',
      name: 'Interview',
      isUmbrella: true,
      accentColor: '#f97316',
      autoEscalation: true,
      subStages: [
        { 
          id: 'follow-up-interview', 
          name: 'Follow Up', 
          description: 'Follow up for interview',
          escalationRule: 'none',
        },
        { 
          id: 'came-down', 
          name: 'Came Down', 
          description: 'Candidate attended interview',
          escalationRule: 'none',
        },
        { 
          id: 'no-show', 
          name: "Didn't Come Down", 
          description: "Candidate didn't attend",
          escalationRule: 'none',
        },
        { 
          id: 'selected-interview', 
          name: 'Selected', 
          description: 'Selected after interview',
          escalationRule: 'move-to-stage',
          escalationTarget: 'offer',
        },
        { 
          id: 'rejected-interview', 
          name: 'Rejected', 
          description: 'Rejected after interview',
          escalationRule: 'move-to-stage',
          escalationTarget: 'rejected',
        },
      ],
    },
    {
      id: 'selected',
      name: 'Selected',
      isUmbrella: false,
      accentColor: '#92D050',   // NEW: Light Green
    },
    {
      id: 'offer',
      name: 'Offer',
      isUmbrella: false,
      accentColor: '#8b5cf6',
    },
    {
      id: 'hired',
      name: 'Hired',
      isUmbrella: false,
      accentColor: '#10b981',
    },
    {
      id: 'rejected',
      name: 'Rejected',
      isUmbrella: true,
      accentColor: '#FF0000',   // NEW: Bright Red
      subStages: [
        {
          id: 'rejected',
          name: 'Rejected',
          description: 'Standard rejection',
        },
        {
          id: 'profile-not-matched',
          name: 'Not Relevant',
          description: 'Profile not relevant / skills mismatch',
        },
        {
          id: 'on-hold',
          name: 'On Hold',
          description: 'Temporarily paused',
        },
        {
          id: 'last-minute-back-out',
          name: 'Last Minute Back Out',
          description: 'Candidate withdrew',
        },
      ],
    },
  ],
};

/**
 * Maps legacy stage names to new umbrella stage structure
 */
export const STAGE_MAPPING: Record<string, { mainStage: string; subStage?: string }> = {
  'Applied':                { mainStage: 'applied' },
  'Follow Up':              { mainStage: 'follow-up' },
  'Screening':              { mainStage: 'screening' },
  'Interview':              { mainStage: 'interview', subStage: 'came-down' },
  'Selected':               { mainStage: 'selected' },
  'Offer':                  { mainStage: 'offer' },
  'Hired':                  { mainStage: 'hired' },
  'Rejected':               { mainStage: 'rejected', subStage: 'rejected' },
  'On Hold':                { mainStage: 'rejected', subStage: 'on-hold' },
  'Profile Not Matched':    { mainStage: 'rejected', subStage: 'profile-not-matched' },
  'Last Minute Back Out':   { mainStage: 'rejected', subStage: 'last-minute-back-out' },
};

/**
 * Reverse mapping: from umbrella structure to legacy stage name
 */
export const REVERSE_STAGE_MAPPING: Record<string, Record<string, string>> = {
  'interview': {
    'follow-up-interview': 'Interview',
    'came-down':           'Interview',
    'no-show':             'Interview',
    'selected-interview':  'Interview',
    'rejected-interview':  'Interview',
  },
  'follow-up': {
    'no-response': 'Follow Up',
  },
  'rejected': {
    'rejected':             'Rejected',
    'on-hold':              'On Hold',
    'profile-not-matched':  'Profile Not Matched',
    'last-minute-back-out': 'Last Minute Back Out',
  },
};

/**
 * Get the display name for a stage combination
 */
export function getStageDisplayName(mainStage: string, subStage?: string): string {
  if (subStage && REVERSE_STAGE_MAPPING[mainStage]?.[subStage]) {
    return REVERSE_STAGE_MAPPING[mainStage][subStage];
  }
  
  const config = DEFAULT_STAGE_CONFIG.mainStages.find(s => s.id === mainStage);
  return config?.name || mainStage;
}

/**
 * Parse legacy stage name into umbrella structure
 */
export function parseLegacyStage(legacyStage: string): { mainStage: string; subStage?: string } {
  return STAGE_MAPPING[legacyStage] || { mainStage: 'applied' };
}

/** Resolve umbrella sub-stage id for grouping / drag-drop (uses DB field when present). */
export function getCandidateSubStageId(
  candidate: { stage?: string; mainStage?: string | null; subStage?: string | null },
  umbrellaStageId: string
): string {
  if (candidate.subStage) {
    return candidate.subStage;
  }

  if (umbrellaStageId === 'interview') {
    const parsed = STAGE_MAPPING[candidate.stage || ''];
    if (parsed?.mainStage === 'interview' && parsed.subStage) {
      return parsed.subStage;
    }
    return 'came-down';
  }

  if (umbrellaStageId === 'rejected') {
    const parsed = STAGE_MAPPING[candidate.stage || ''];
    if (parsed?.subStage) {
      return parsed.subStage;
    }
    return 'rejected';
  }

  if (umbrellaStageId === 'follow-up') {
    return 'no-response';
  }

  return '';
}

/** Legacy stage name when moving to a rejected-umbrella sub-stage. */
export function getLegacyStageForRejectedSubStage(subStageId: string): string {
  return REVERSE_STAGE_MAPPING.rejected[subStageId] || 'Rejected';
}
