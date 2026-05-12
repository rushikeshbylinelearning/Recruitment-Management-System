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
  escalationTarget?: string; // Target stage ID for escalation
}

export interface UmbrellaStage {
  id: string;
  name: string;
  isUmbrella: boolean;
  subStages?: SubStage[];
  accentColor: string;
  autoEscalation?: boolean; // Enable automatic escalation for this umbrella
}

export interface StageConfig {
  mainStages: UmbrellaStage[];
}

/**
 * Default stage configuration
 * Defines which stages are umbrella stages and their nested sub-stages
 */
export const DEFAULT_STAGE_CONFIG: StageConfig = {
  mainStages: [
    {
      id: 'applied',
      name: 'Applied',
      isUmbrella: false,
      accentColor: '#6366f1',
    },
    {
      id: 'follow-up',
      name: 'Follow Up',
      isUmbrella: false,
      accentColor: '#06b6d4',
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
          name: 'Didn\'t Come', 
          description: 'Candidate didn\'t attend',
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
      accentColor: '#ef4444',
      subStages: [
        { id: 'rejected', name: 'Rejected', description: 'Standard rejection' },
        { id: 'on-hold', name: 'On Hold', description: 'Temporarily paused' },
        { id: 'profile-not-matched', name: 'Profile Not Matched', description: 'Skills mismatch' },
        { id: 'last-minute-back-out', name: 'Last Minute Back Out', description: 'Candidate withdrew' },
      ],
    },
  ],
};

/**
 * Maps legacy stage names to new umbrella stage structure
 */
export const STAGE_MAPPING: Record<string, { mainStage: string; subStage?: string }> = {
  'Applied': { mainStage: 'applied' },
  'Follow Up': { mainStage: 'follow-up' },
  'Screening': { mainStage: 'screening' },
  'Interview': { mainStage: 'interview', subStage: 'came-down' },
  'Offer': { mainStage: 'offer' },
  'Hired': { mainStage: 'hired' },
  'Rejected': { mainStage: 'rejected', subStage: 'rejected' },
  'On Hold': { mainStage: 'rejected', subStage: 'on-hold' },
  'Profile Not Matched': { mainStage: 'rejected', subStage: 'profile-not-matched' },
  'Last Minute Back Out': { mainStage: 'rejected', subStage: 'last-minute-back-out' },
};

/**
 * Reverse mapping: from umbrella structure to legacy stage name
 */
export const REVERSE_STAGE_MAPPING: Record<string, Record<string, string>> = {
  'interview': {
    'follow-up-interview': 'Interview',
    'came-down': 'Interview',
    'no-show': 'Interview',
    'selected-interview': 'Interview',
    'rejected-interview': 'Interview',
  },
  'rejected': {
    'rejected': 'Rejected',
    'on-hold': 'On Hold',
    'profile-not-matched': 'Profile Not Matched',
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
