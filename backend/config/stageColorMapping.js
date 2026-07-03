/**
 * Stage Color Mapping Configuration
 *
 * ENTERPRISE-GRADE COLOR-DRIVEN WORKFLOW SYSTEM
 *
 * This is the SINGLE SOURCE OF TRUTH for all stage-to-color mappings.
 *
 * WORKFLOW RULE:
 * - Recruiters color the CANDIDATE NAME CELL in Excel
 * - System detects the color from NAME column ONLY
 * - System maps candidate to correct main_stage and sub_stage
 * - Candidate appears in correct Kanban workflow position
 *
 * ============================================================
 * NEW REQUIRED COLOR SYSTEM (v2) — DO NOT CHANGE THESE COLORS
 * ============================================================
 *
 *  Rejected                → #FF0000  (Bright Red)
 *  Selected                → #92D050  (Light Green)
 *  Not Relevant            → #FFC000  (Gold Yellow)   → profile-not-matched
 *  Follow up               → #00B0F0  (Bright Blue)
 *  Came Down for interview → #FFFF00  (Bright Yellow)
 *  Didn't came down        → #7030A0  (Purple)        → no-show
 *  didn't respond          → #7F7F7F  (Gray)          → no-response
 */

/**
 * STAGE COLOR MAPPING
 *
 * Structure:
 * {
 *   stageId: {
 *     label: "Display Name",
 *     color: "#HEXCODE",           // PRIMARY unique color (Excel name-cell color)
 *     mainStage: "main-stage-id",
 *     subStage: "sub-stage-id" | null,
 *     legacyStage: "Legacy Name",
 *     description: "Stage description",
 *     toleranceShades: ["#HEX"]   // Near-shades for tolerance matching
 *   }
 * }
 */
export const STAGE_COLOR_MAP = {

  // ============================================================
  // 7 REQUIRED WORKFLOW STAGES
  // ============================================================

  /**
   * Rejected → Bright Red #FF0000
   * main_stage = rejected | sub_stage = rejected
   */
  'rejected': {
    label: 'Rejected',
    color: '#FF0000',
    mainStage: 'rejected',
    subStage: 'rejected',
    legacyStage: 'Rejected',
    description: 'Candidate rejected',
    toleranceShades: ['#EE0000', '#CC0000', '#FF1111', '#FF2222'],
  },

  /**
   * Selected → Light Green #92D050
   * main_stage = selected | sub_stage = null
   */
  'selected': {
    label: 'Selected',
    color: '#92D050',
    mainStage: 'selected',
    subStage: null,
    legacyStage: 'Selected',
    description: 'Candidate selected / offer stage',
    toleranceShades: ['#8DC44A', '#9AD855', '#85C040', '#A0D860'],
  },

  /**
   * Not Relevant → Gold Yellow #FFC000
   * main_stage = rejected | sub_stage = profile-not-matched
   */
  'profile-not-matched': {
    label: 'Not Relevant',
    color: '#FFC000',
    mainStage: 'rejected',
    subStage: 'profile-not-matched',
    legacyStage: 'Profile Not Matched',
    description: 'Candidate profile does not match / not relevant',
    toleranceShades: ['#FFB800', '#FFCA00', '#F0B400', '#FFD000'],
  },

  /**
   * Follow up → Bright Blue #00B0F0
   * main_stage = follow-up | sub_stage = null
   */
  'follow-up': {
    label: 'Follow Up',
    color: '#00B0F0',
    mainStage: 'follow-up',
    subStage: null,
    legacyStage: 'Follow Up',
    description: 'Candidate requires follow-up contact',
    toleranceShades: ['#00A8E8', '#00B8F8', '#00A0E0', '#10B8F0'],
  },

  /**
   * Came Down for interview → Bright Yellow #FFFF00
   * main_stage = interview | sub_stage = came-down
   */
  'came-down': {
    label: 'Came Down for Interview',
    color: '#FFFF00',
    mainStage: 'interview',
    subStage: 'came-down',
    legacyStage: 'Interview',
    description: 'Candidate attended interview',
    toleranceShades: ['#F8F800', '#FFFF11', '#EEEE00', '#FFFF22'],
  },

  /**
   * Didn't came down for the interview → Purple #7030A0
   * main_stage = interview | sub_stage = no-show
   */
  'no-show': {
    label: "Didn't Come Down for Interview",
    color: '#7030A0',
    mainStage: 'interview',
    subStage: 'no-show',
    legacyStage: 'Interview',
    description: 'Candidate did not attend interview',
    toleranceShades: ['#6828A0', '#7838A8', '#6020A0', '#8040B0'],
  },

  /**
   * didn't respond → Gray #7F7F7F
   * main_stage = follow-up | sub_stage = no-response
   */
  'no-response': {
    label: "Didn't Respond",
    color: '#7F7F7F',
    mainStage: 'follow-up',
    subStage: 'no-response',
    legacyStage: 'Follow Up',
    description: 'Candidate did not respond',
    toleranceShades: ['#787878', '#888888', '#707070', '#909090'],
  },

  // ============================================================
  // ADDITIONAL STAGES (non-color-coded, text-matched only)
  // These do not have Excel color assignments but are valid
  // workflow stages reachable via text matching.
  // ============================================================

  'applied': {
    label: 'Applied',
    color: '#4472C4',
    mainStage: 'applied',
    subStage: null,
    legacyStage: 'Applied',
    description: 'Candidate has submitted application',
    toleranceShades: [],
  },

  'screening': {
    label: 'Screening',
    color: '#ED7D31',
    mainStage: 'screening',
    subStage: null,
    legacyStage: 'Screening',
    description: 'Candidate is being screened',
    toleranceShades: [],
  },

  'offer': {
    label: 'Offer',
    color: '#FF00FF',
    mainStage: 'offer',
    subStage: null,
    legacyStage: 'Offer',
    description: 'Offer extended to candidate',
    toleranceShades: [],
  },

  'hired': {
    label: 'Hired',
    color: '#00B050',
    mainStage: 'hired',
    subStage: null,
    legacyStage: 'Hired',
    description: 'Candidate has been hired',
    toleranceShades: [],
  },

  'on-hold': {
    label: 'On Hold',
    color: '#FF6600',
    mainStage: 'rejected',
    subStage: 'on-hold',
    legacyStage: 'On Hold',
    description: 'Candidate application on hold',
    toleranceShades: [],
  },

  'last-minute-back-out': {
    label: 'Last Minute Back Out',
    color: '#C00000',
    mainStage: 'rejected',
    subStage: 'last-minute-back-out',
    legacyStage: 'Last Minute Back Out',
    description: 'Candidate withdrew at last minute',
    toleranceShades: [],
  },

  'follow-up-interview': {
    label: 'Follow Up (Interview)',
    color: '#0070C0',
    mainStage: 'interview',
    subStage: 'follow-up-interview',
    legacyStage: 'Interview',
    description: 'Following up for interview scheduling',
    toleranceShades: [],
  },

  'selected-interview': {
    label: 'Selected (Interview)',
    color: '#00B0A0',
    mainStage: 'interview',
    subStage: 'selected-interview',
    legacyStage: 'Interview',
    description: 'Candidate passed interview',
    toleranceShades: [],
  },

  'rejected-interview': {
    label: 'Rejected (Interview)',
    color: '#FF0080',
    mainStage: 'interview',
    subStage: 'rejected-interview',
    legacyStage: 'Interview',
    description: 'Candidate failed interview',
    toleranceShades: [],
  },
};

// ============================================================
// COLOR → STAGE REVERSE LOOKUP MAP
// Optimized for fast O(1) color-based lookups
// ============================================================
export const COLOR_TO_STAGE_MAP = {};

Object.entries(STAGE_COLOR_MAP).forEach(([stageId, config]) => {
  // Primary color
  COLOR_TO_STAGE_MAP[config.color.toUpperCase()] = stageId;

  // Tolerance shades
  if (config.toleranceShades) {
    config.toleranceShades.forEach(shade => {
      COLOR_TO_STAGE_MAP[shade.toUpperCase()] = stageId;
    });
  }
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get all primary colors (for validation / legend)
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
 * Get stage configuration by hex color (exact or tolerance-shade match)
 * @param {string} hexColor - e.g. "#FF0000" or "FF0000"
 * @returns {Object|null} stage config or null
 */
export function getStageByColor(hexColor) {
  if (!hexColor) return null;

  const normalized = hexColor.replace(/^#/, '').toUpperCase();
  const withHash = `#${normalized}`;

  const stageId = COLOR_TO_STAGE_MAP[withHash];
  return stageId ? STAGE_COLOR_MAP[stageId] : null;
}

/**
 * Get all main stages
 */
export function getMainStages() {
  return Object.entries(STAGE_COLOR_MAP)
    .filter(([_, config]) => config.subStage === null)
    .map(([stageId, config]) => ({ stageId, ...config }));
}

/**
 * Get micro-stages for a given main stage
 */
export function getMicroStages(mainStageId) {
  return Object.entries(STAGE_COLOR_MAP)
    .filter(([_, config]) => config.mainStage === mainStageId && config.subStage !== null)
    .map(([stageId, config]) => ({ stageId, ...config }));
}

/**
 * Validate that all primary colors are unique (throws on duplicate)
 */
export function validateColorUniqueness() {
  const colors = getAllUniqueColors();
  const seen = new Set();
  const duplicates = [];

  colors.forEach(color => {
    const upper = color.toUpperCase();
    if (seen.has(upper)) {
      duplicates.push(color);
    }
    seen.add(upper);
  });

  if (duplicates.length > 0) {
    throw new Error(`Duplicate primary colors found: ${duplicates.join(', ')}`);
  }

  return true;
}

/**
 * Export color legend for UI display
 */
export function getColorLegend() {
  return Object.entries(STAGE_COLOR_MAP).map(([stageId, config]) => ({
    stageId,
    label: config.label,
    color: config.color,
    mainStage: config.mainStage,
    subStage: config.subStage,
    description: config.description,
  }));
}

/**
 * Get the 7 required workflow colors for reference / documentation
 */
export function getRequiredWorkflowColors() {
  return [
    { stage: 'Rejected',                    color: '#FF0000', stageId: 'rejected' },
    { stage: 'Selected',                    color: '#92D050', stageId: 'selected' },
    { stage: 'Not Relevant',                color: '#FFC000', stageId: 'profile-not-matched' },
    { stage: 'Follow up',                   color: '#00B0F0', stageId: 'follow-up' },
    { stage: 'Came Down for interview',     color: '#FFFF00', stageId: 'came-down' },
    { stage: "Didn't came down",            color: '#7030A0', stageId: 'no-show' },
    { stage: "didn't respond",              color: '#7F7F7F', stageId: 'no-response' },
  ];
}

export default STAGE_COLOR_MAP;
