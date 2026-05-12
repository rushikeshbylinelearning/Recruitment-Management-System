/**
 * Stage Color Mapping Configuration
 * 
 * ENTERPRISE-GRADE COLOR-DRIVEN WORKFLOW SYSTEM
 * 
 * This is the SINGLE SOURCE OF TRUTH for all stage-to-color mappings.
 * Every stage (main and micro) has a UNIQUE color identifier.
 * 
 * WORKFLOW RULE:
 * - Recruiters color the CANDIDATE NAME CELL in Excel
 * - System detects the color from NAME column ONLY
 * - System maps candidate to correct main_stage and sub_stage
 * - Candidate appears in correct Kanban workflow position
 * 
 * COLOR REQUIREMENTS:
 * - Every stage has ONE unique primary color
 * - No duplicate colors across stages
 * - Colors are visually distinct
 * - Colors work in Excel and web UI
 * - Colors remain recognizable in light/dark mode
 */

/**
 * STAGE COLOR MAPPING
 * 
 * Structure:
 * {
 *   stageId: {
 *     label: "Display Name",
 *     color: "#HEXCODE",      // PRIMARY unique color
 *     mainStage: "main-stage-id",
 *     subStage: "sub-stage-id" | null,
 *     legacyStage: "Legacy Name",
 *     description: "Stage description",
 *     toleranceShades: ["#HEX1", "#HEX2"]  // Similar shades for tolerance matching
 *   }
 * }
 */
export const STAGE_COLOR_MAP = {
  // ========================================
  // MAIN STAGES (7)
  // ========================================
  
  'applied': {
    label: 'Applied',
    color: '#2563EB',  // Royal Blue
    mainStage: 'applied',
    subStage: null,
    legacyStage: 'Applied',
    description: 'Candidate has submitted application',
    toleranceShades: ['#1E40AF', '#3B82F6', '#1D4ED8']  // Blue variations
  },
  
  'follow-up': {
    label: 'Follow Up',
    color: '#F59E0B',  // Amber
    mainStage: 'follow-up',
    subStage: null,
    legacyStage: 'Follow Up',
    description: 'Candidate requires follow-up contact',
    toleranceShades: ['#D97706', '#F59E0B', '#FBBF24']  // Amber variations
  },
  
  'screening': {
    label: 'Screening',
    color: '#06B6D4',  // Cyan
    mainStage: 'screening',
    subStage: null,
    legacyStage: 'Screening',
    description: 'Candidate is being screened',
    toleranceShades: ['#0891B2', '#06B6D4', '#22D3EE']  // Cyan variations
  },
  
  'interview': {
    label: 'Interview',
    color: '#8B5CF6',  // Violet (main umbrella)
    mainStage: 'interview',
    subStage: 'came-down',  // Default sub-stage
    legacyStage: 'Interview',
    description: 'Candidate in interview process (default: attended)',
    toleranceShades: ['#7C3AED', '#8B5CF6', '#A78BFA']  // Violet variations
  },
  
  'offer': {
    label: 'Offer',
    color: '#EC4899',  // Pink
    mainStage: 'offer',
    subStage: null,
    legacyStage: 'Offer',
    description: 'Offer extended to candidate',
    toleranceShades: ['#DB2777', '#EC4899', '#F472B6']  // Pink variations
  },
  
  'hired': {
    label: 'Hired',
    color: '#10B981',  // Emerald Green
    mainStage: 'hired',
    subStage: null,
    legacyStage: 'Hired',
    description: 'Candidate has been hired',
    toleranceShades: ['#059669', '#10B981', '#34D399']  // Green variations
  },
  
  'rejected': {
    label: 'Rejected',
    color: '#DC2626',  // Crimson (main umbrella) - CHANGED from #EF4444
    mainStage: 'rejected',
    subStage: 'rejected',  // Default sub-stage
    legacyStage: 'Rejected',
    description: 'Candidate rejected (default: standard rejection)',
    toleranceShades: ['#B91C1C', '#DC2626', '#E11D48']  // Crimson variations
  },
  
  // ========================================
  // INTERVIEW MICRO-STAGES (5)
  // ========================================
  
  'follow-up-interview': {
    label: 'Follow Up (Interview)',
    color: '#A78BFA',  // Light Violet
    mainStage: 'interview',
    subStage: 'follow-up-interview',
    legacyStage: 'Interview',
    description: 'Following up for interview scheduling',
    toleranceShades: ['#9F7AEA', '#A78BFA', '#C4B5FD']  // Light violet variations
  },
  
  'came-down': {
    label: 'Came Down',
    color: '#4F46E5',  // Deep Indigo
    mainStage: 'interview',
    subStage: 'came-down',
    legacyStage: 'Interview',
    description: 'Candidate attended interview',
    toleranceShades: ['#4338CA', '#4F46E5', '#6366F1']  // Indigo variations
  },
  
  'no-show': {
    label: "Didn't Come",
    color: '#FB923C',  // Light Orange - CHANGED from #F97316 for better distinction
    mainStage: 'interview',
    subStage: 'no-show',
    legacyStage: 'Interview',
    description: 'Candidate did not attend interview',
    toleranceShades: ['#F97316', '#FB923C', '#FDBA74']  // Light orange variations
  },
  
  'selected-interview': {
    label: 'Selected (Interview)',
    color: '#22C55E',  // Green
    mainStage: 'interview',
    subStage: 'selected-interview',
    legacyStage: 'Interview',
    description: 'Candidate passed interview',
    toleranceShades: ['#16A34A', '#22C55E', '#4ADE80']  // Green variations
  },
  
  'rejected-interview': {
    label: 'Rejected (Interview)',
    color: '#BE123C',  // Deep Rose - CHANGED from #DC2626 for better distinction
    mainStage: 'interview',
    subStage: 'rejected-interview',
    legacyStage: 'Interview',
    description: 'Candidate failed interview',
    toleranceShades: ['#9F1239', '#BE123C', '#E11D48']  // Deep rose variations
  },
  
  // ========================================
  // REJECTED MICRO-STAGES (4)
  // ========================================
  
  'on-hold': {
    label: 'On Hold',
    color: '#EAB308',  // Yellow
    mainStage: 'rejected',
    subStage: 'on-hold',
    legacyStage: 'On Hold',
    description: 'Candidate application on hold',
    toleranceShades: ['#CA8A04', '#EAB308', '#FDE047']  // Yellow variations
  },
  
  'profile-not-matched': {
    label: 'Profile Not Matched',
    color: '#64748B',  // Slate Gray
    mainStage: 'rejected',
    subStage: 'profile-not-matched',
    legacyStage: 'Profile Not Matched',
    description: 'Candidate profile does not match requirements',
    toleranceShades: ['#475569', '#64748B', '#94A3B8']  // Gray variations
  },
  
  'last-minute-back-out': {
    label: 'Last Minute Back Out',
    color: '#EA580C',  // Dark Orange
    mainStage: 'rejected',
    subStage: 'last-minute-back-out',
    legacyStage: 'Last Minute Back Out',
    description: 'Candidate withdrew at last minute',
    toleranceShades: ['#C2410C', '#EA580C', '#F97316']  // Dark orange variations
  },
  
  'rejected-final': {
    label: 'Rejected',
    color: '#B91C1C',  // Dark Red
    mainStage: 'rejected',
    subStage: 'rejected',
    legacyStage: 'Rejected',
    description: 'Candidate rejected (standard)',
    toleranceShades: ['#991B1B', '#B91C1C', '#DC2626']  // Dark red variations
  }
};

/**
 * COLOR TO STAGE LOOKUP MAP
 * Optimized for fast color-based lookups
 */
export const COLOR_TO_STAGE_MAP = {};

// Build reverse lookup map
Object.entries(STAGE_COLOR_MAP).forEach(([stageId, config]) => {
  // Primary color
  COLOR_TO_STAGE_MAP[config.color.toUpperCase()] = stageId;
  
  // Tolerance shades
  config.toleranceShades?.forEach(shade => {
    COLOR_TO_STAGE_MAP[shade.toUpperCase()] = stageId;
  });
});

/**
 * Get all unique colors (for validation)
 */
export function getAllUniqueColors() {
  return Object.values(STAGE_COLOR_MAP).map(config => config.color);
}

/**
 * Get stage configuration by stage ID
 */
export function getStageConfig(stageId) {
  return STAGE_COLOR_MAP[stageId] || null;
}

/**
 * Get stage configuration by color
 */
export function getStageByColor(hexColor) {
  if (!hexColor) return null;
  
  // Normalize color (remove # if present, uppercase)
  const normalized = hexColor.replace('#', '').toUpperCase();
  const withHash = `#${normalized}`;
  
  const stageId = COLOR_TO_STAGE_MAP[withHash];
  return stageId ? STAGE_COLOR_MAP[stageId] : null;
}

/**
 * Get all main stages
 */
export function getMainStages() {
  return Object.entries(STAGE_COLOR_MAP)
    .filter(([_, config]) => config.subStage === null || config.subStage === config.mainStage)
    .map(([stageId, config]) => ({ stageId, ...config }));
}

/**
 * Get micro-stages for a main stage
 */
export function getMicroStages(mainStageId) {
  return Object.entries(STAGE_COLOR_MAP)
    .filter(([_, config]) => config.mainStage === mainStageId && config.subStage !== null)
    .map(([stageId, config]) => ({ stageId, ...config }));
}

/**
 * Validate color uniqueness (for testing)
 */
export function validateColorUniqueness() {
  const colors = getAllUniqueColors();
  const uniqueColors = new Set(colors.map(c => c.toUpperCase()));
  
  if (colors.length !== uniqueColors.size) {
    const duplicates = colors.filter((color, index) => 
      colors.findIndex(c => c.toUpperCase() === color.toUpperCase()) !== index
    );
    throw new Error(`Duplicate colors found: ${duplicates.join(', ')}`);
  }
  
  return true;
}

/**
 * Export color legend for UI
 */
export function getColorLegend() {
  return Object.entries(STAGE_COLOR_MAP).map(([stageId, config]) => ({
    stageId,
    label: config.label,
    color: config.color,
    mainStage: config.mainStage,
    subStage: config.subStage,
    description: config.description
  }));
}

export default STAGE_COLOR_MAP;
