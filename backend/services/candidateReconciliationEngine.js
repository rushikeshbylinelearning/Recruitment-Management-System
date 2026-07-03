/**
 * Intelligent field-level reconciliation for candidate merges.
 */

import { normalizeEmail, normalizePhone } from '../utils/contactNormalizer.js';

export const MERGE_STRATEGIES = {
  AUTO_SAFE: 'AUTO_SAFE',
  LATEST_WINS: 'LATEST_WINS',
  PRIMARY_WINS: 'PRIMARY_WINS',
  HR_REVIEW_REQUIRED: 'HR_REVIEW_REQUIRED',
};

export const RESOLUTION_ACTIONS = {
  KEEP_PRIMARY: 'KEEP_PRIMARY',
  KEEP_DUPLICATE: 'KEEP_DUPLICATE',
  MERGE_BOTH: 'MERGE_BOTH',
  MANUAL: 'MANUAL',
};

const PROFILE_FIELDS = [
  { key: 'phone', label: 'Phone', type: 'scalar' },
  { key: 'name', label: 'Name', type: 'scalar' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'salary_expected', label: 'Expected CTC', type: 'scalar' },
  { key: 'current_ctc', label: 'Current CTC', type: 'scalar' },
  { key: 'experience', label: 'Experience', type: 'scalar' },
  { key: 'location', label: 'Location', type: 'scalar' },
  { key: 'notice_period', label: 'Notice Period', type: 'scalar' },
  { key: 'work_preference', label: 'Work Preference', type: 'scalar' },
  { key: 'expertise', label: 'Expertise / Skills', type: 'skills' },
  { key: 'linkedin_url', label: 'LinkedIn', type: 'scalar' },
  { key: 'resume_file_id', label: 'Resume', type: 'resume' },
  { key: 'position', label: 'Position', type: 'position' },
];

function isEmpty(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

function normScalar(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function valuesEqual(a, b) {
  return normScalar(a).toLowerCase() === normScalar(b).toLowerCase();
}

function parseSkills(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    /* plain text */
  }
  return String(value)
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function unionSkills(a, b) {
  const set = new Set([...parseSkills(a), ...parseSkills(b)].map((s) => s.toLowerCase()));
  const display = [...parseSkills(a), ...parseSkills(b)].filter(
    (s, i, arr) => arr.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i
  );
  return display;
}

function pickLatest(primary, duplicate, fieldKey) {
  const pTime = new Date(primary.updated_at || primary.created_at || 0).getTime();
  const dTime = new Date(duplicate.updated_at || duplicate.created_at || 0).getTime();
  if (dTime > pTime) return duplicate[fieldKey];
  return primary[fieldKey];
}

function suggestScalar(fieldKey, primary, duplicate, strategy) {
  const pVal = primary[fieldKey];
  const dVal = duplicate[fieldKey];

  if (isEmpty(pVal) && !isEmpty(dVal)) {
    return {
      suggestedValue: dVal,
      strategy: 'AUTO_SAFE',
      confidence: 0.95,
      reason: 'Primary empty — duplicate has value',
      requiresReview: false,
    };
  }
  if (!isEmpty(pVal) && isEmpty(dVal)) {
    return {
      suggestedValue: pVal,
      strategy: 'PRIMARY_WINS',
      confidence: 0.9,
      reason: 'Duplicate empty — keep primary',
      requiresReview: false,
    };
  }
  if (valuesEqual(pVal, dVal)) {
    return {
      suggestedValue: pVal,
      strategy: 'AUTO_SAFE',
      confidence: 1,
      reason: 'Values match',
      requiresReview: false,
    };
  }

  if (fieldKey === 'email') {
    return {
      suggestedValue: pVal,
      strategy: 'PRIMARY_WINS',
      confidence: 0.88,
      reason: 'Keep verified primary email; alias duplicate',
      requiresReview: strategy === MERGE_STRATEGIES.HR_REVIEW_REQUIRED,
      emailAlias: dVal,
    };
  }

  if (fieldKey === 'phone') {
    const dTime = new Date(duplicate.updated_at || 0).getTime();
    const pTime = new Date(primary.updated_at || 0).getTime();
    const useDup = dTime >= pTime;
    return {
      suggestedValue: useDup ? dVal : pVal,
      strategy: 'LATEST_WINS',
      confidence: 0.85,
      reason: useDup ? 'Newer profile has updated phone' : 'Primary is newer',
      requiresReview: strategy === MERGE_STRATEGIES.HR_REVIEW_REQUIRED,
    };
  }

  if (['salary_expected', 'current_ctc', 'location', 'notice_period', 'experience'].includes(fieldKey)) {
    const latest = pickLatest(primary, duplicate, fieldKey);
    return {
      suggestedValue: latest,
      strategy: 'LATEST_WINS',
      confidence: 0.82,
      reason: 'Latest submission value',
      requiresReview: strategy === MERGE_STRATEGIES.HR_REVIEW_REQUIRED,
    };
  }

  if (fieldKey === 'linkedin_url' && !isEmpty(dVal)) {
    return {
      suggestedValue: isEmpty(pVal) ? dVal : pVal,
      strategy: isEmpty(pVal) ? 'AUTO_SAFE' : 'PRIMARY_WINS',
      confidence: isEmpty(pVal) ? 0.9 : 0.7,
      reason: isEmpty(pVal) ? 'Duplicate has LinkedIn' : 'Keep primary LinkedIn',
      requiresReview: !isEmpty(pVal) && !valuesEqual(pVal, dVal),
    };
  }

  if (strategy === MERGE_STRATEGIES.PRIMARY_WINS) {
    return {
      suggestedValue: pVal,
      strategy: 'PRIMARY_WINS',
      confidence: 0.75,
      reason: 'Primary wins strategy',
      requiresReview: false,
    };
  }

  if (strategy === MERGE_STRATEGIES.LATEST_WINS) {
    return {
      suggestedValue: pickLatest(primary, duplicate, fieldKey),
      strategy: 'LATEST_WINS',
      confidence: 0.8,
      reason: 'Latest wins strategy',
      requiresReview: false,
    };
  }

  return {
    suggestedValue: pickLatest(primary, duplicate, fieldKey),
    strategy: 'LATEST_WINS',
    confidence: 0.72,
    reason: 'Values differ — review recommended',
    requiresReview: true,
  };
}

function suggestResume(primary, duplicate) {
  const pMeta = primary._resumeMeta || {};
  const dMeta = duplicate._resumeMeta || {};
  const pTime = pMeta.uploaded_at ? new Date(pMeta.uploaded_at).getTime() : 0;
  const dTime = dMeta.uploaded_at ? new Date(dMeta.uploaded_at).getTime() : 0;
  const pId = primary.resume_file_id;
  const dId = duplicate.resume_file_id;

  if (!pId && dId) {
    return {
      suggestedValue: dId,
      strategy: 'AUTO_SAFE',
      confidence: 0.95,
      reason: 'Only duplicate has resume',
      requiresReview: false,
      primaryResumeId: dId,
    };
  }
  if (pId && !dId) {
    return {
      suggestedValue: pId,
      strategy: 'PRIMARY_WINS',
      confidence: 0.9,
      reason: 'Only primary has resume',
      requiresReview: false,
      primaryResumeId: pId,
    };
  }
  if (!pId && !dId) {
    return {
      suggestedValue: null,
      strategy: 'AUTO_SAFE',
      confidence: 1,
      reason: 'No resumes',
      requiresReview: false,
      primaryResumeId: null,
    };
  }

  const useDup = dTime > pTime;
  return {
    suggestedValue: useDup ? dId : pId,
    strategy: 'LATEST_WINS',
    confidence: dTime === pTime ? 0.7 : 0.92,
    reason: useDup ? 'Newer resume upload on duplicate' : 'Newer resume on primary',
    requiresReview: pId !== dId && Math.abs(dTime - pTime) < 86400000,
    primaryResumeId: useDup ? dId : pId,
    preserveBoth: true,
  };
}

export function buildMergePreview(primary, duplicate, strategy = MERGE_STRATEGIES.HR_REVIEW_REQUIRED) {
  const conflicts = [];
  const autoResolved = [];
  const fieldResolutions = {};

  for (const { key, label, type } of PROFILE_FIELDS) {
    if (type === 'position') continue;

    if (type === 'skills') {
      const pSkills = parseSkills(primary.expertise || primary.skills);
      const dSkills = parseSkills(duplicate.expertise || duplicate.skills);
      const merged = unionSkills(primary.expertise, duplicate.expertise);
      const same =
        pSkills.length === dSkills.length &&
        pSkills.every((s) => dSkills.some((d) => d.toLowerCase() === s.toLowerCase()));

      const resolution = {
        field: key,
        label,
        primaryValue: primary.expertise || primary.skills || '',
        duplicateValue: duplicate.expertise || duplicate.skills || '',
        suggestedValue: merged.join(', '),
        strategy: 'MERGE_BOTH',
        confidence: 0.9,
        reason: 'Union of unique skills',
        requiresReview: !same && strategy === MERGE_STRATEGIES.HR_REVIEW_REQUIRED,
        suggestedAction: RESOLUTION_ACTIONS.MERGE_BOTH,
      };
      fieldResolutions[key] = resolution;
      if (resolution.requiresReview) conflicts.push(resolution);
      else autoResolved.push(resolution);
      continue;
    }

    if (type === 'resume') {
      const resolution = {
        field: key,
        label,
        primaryValue: primary._resumeMeta?.original_filename || (primary.resume_file_id ? `File #${primary.resume_file_id}` : ''),
        duplicateValue: duplicate._resumeMeta?.original_filename || (duplicate.resume_file_id ? `File #${duplicate.resume_file_id}` : ''),
        primaryResumeFileId: primary.resume_file_id || null,
        duplicateResumeFileId: duplicate.resume_file_id || null,
        ...suggestResume(primary, duplicate),
        suggestedAction: RESOLUTION_ACTIONS.KEEP_DUPLICATE,
      };
      if (resolution.primaryResumeId === primary.resume_file_id) {
        resolution.suggestedAction = RESOLUTION_ACTIONS.KEEP_PRIMARY;
      }
      fieldResolutions[key] = resolution;
      if (resolution.requiresReview) conflicts.push(resolution);
      else autoResolved.push(resolution);
      continue;
    }

    const suggestion = suggestScalar(key, primary, duplicate, strategy);
    const resolution = {
      field: key,
      label,
      primaryValue: primary[key] ?? '',
      duplicateValue: duplicate[key] ?? '',
      suggestedValue: suggestion.suggestedValue,
      strategy: suggestion.strategy,
      confidence: suggestion.confidence,
      reason: suggestion.reason,
      requiresReview: suggestion.requiresReview,
      emailAlias: suggestion.emailAlias,
      suggestedAction: suggestion.requiresReview
        ? null
        : valuesEqual(suggestion.suggestedValue, primary[key])
          ? RESOLUTION_ACTIONS.KEEP_PRIMARY
          : RESOLUTION_ACTIONS.KEEP_DUPLICATE,
    };

    fieldResolutions[key] = resolution;
    if (resolution.requiresReview && !valuesEqual(primary[key], duplicate[key])) {
      conflicts.push(resolution);
    } else if (!valuesEqual(primary[key], duplicate[key]) || !isEmpty(duplicate[key])) {
      autoResolved.push(resolution);
    }
  }

  const positions = {
    primary: normScalar(primary.position),
    duplicate: normScalar(duplicate.position),
    merged: [
      ...new Set(
        [primary.position, duplicate.position].map(normScalar).filter(Boolean)
      ),
    ],
    strategy: 'MERGE_BOTH',
    requiresReview: false,
  };

  if (
    positions.primary &&
    positions.duplicate &&
    !valuesEqual(positions.primary, positions.duplicate)
  ) {
    positions.requiresReview = strategy === MERGE_STRATEGIES.HR_REVIEW_REQUIRED;
    conflicts.push({
      field: 'position',
      label: 'Position',
      primaryValue: positions.primary,
      duplicateValue: positions.duplicate,
      suggestedValue: positions.merged.join(' · '),
      strategy: 'MERGE_BOTH',
      confidence: 1,
      reason: 'Multiple job interests — keep both',
      requiresReview: positions.requiresReview,
      suggestedAction: RESOLUTION_ACTIONS.MERGE_BOTH,
    });
  }

  return {
    strategy,
    fieldResolutions,
    conflicts,
    autoResolved,
    positions,
    summary: {
      conflictCount: conflicts.length,
      autoResolvedCount: autoResolved.length,
      requiresReview: conflicts.some((c) => c.requiresReview),
    },
  };
}

export function resolveFieldValue(resolution, decisions = {}) {
  const decision = decisions[resolution.field];
  const action = decision?.action || resolution.suggestedAction;

  if (resolution.field === 'position') {
    return { type: 'positions', value: resolution.suggestedValue };
  }

  if (resolution.field === 'expertise' || resolution.field === 'skills') {
    if (action === RESOLUTION_ACTIONS.KEEP_PRIMARY) {
      return { type: 'scalar', value: resolution.primaryValue, field: 'expertise' };
    }
    if (action === RESOLUTION_ACTIONS.KEEP_DUPLICATE) {
      return { type: 'scalar', value: resolution.duplicateValue, field: 'expertise' };
    }
    if (action === RESOLUTION_ACTIONS.MERGE_BOTH) {
      return { type: 'scalar', value: resolution.suggestedValue, field: 'expertise' };
    }
  }

  if (resolution.field === 'resume_file_id') {
    if (action === RESOLUTION_ACTIONS.KEEP_PRIMARY) {
      return {
        type: 'resume',
        value: resolution.primaryResumeFileId ?? resolution.primaryResumeId ?? null,
      };
    }
    if (action === RESOLUTION_ACTIONS.KEEP_DUPLICATE) {
      return {
        type: 'resume',
        value: resolution.duplicateResumeFileId ?? resolution.suggestedValue ?? null,
      };
    }
    return { type: 'resume', value: resolution.primaryResumeId ?? resolution.suggestedValue };
  }

  if (action === RESOLUTION_ACTIONS.KEEP_PRIMARY) {
    return { type: 'scalar', value: resolution.primaryValue, field: resolution.field };
  }
  if (action === RESOLUTION_ACTIONS.KEEP_DUPLICATE) {
    return { type: 'scalar', value: resolution.duplicateValue, field: resolution.field };
  }
  if (action === RESOLUTION_ACTIONS.MANUAL && decision?.manualValue !== undefined) {
    return { type: 'scalar', value: decision.manualValue, field: resolution.field };
  }

  return { type: 'scalar', value: resolution.suggestedValue, field: resolution.field };
}

export function buildProfileSnapshot(row, extras = {}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    position: row.position,
    stage: row.stage,
    source: row.source,
    experience: row.experience,
    salary_expected: row.salary_expected,
    current_ctc: row.current_ctc,
    location: row.location,
    notice_period: row.notice_period,
    work_preference: row.work_preference,
    expertise: row.expertise,
    skills: row.skills,
    resume_file_id: row.resume_file_id,
    linkedin_url: extras.linkedin_url || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    _resumeMeta: extras.resumeMeta || null,
    _applications: extras.applications || [],
  };
}

/**
 * Auto decisions for batch merge (uses engine suggestions).
 */
export function buildAutoDecisionsFromPreview(preview) {
  const decisions = {};
  for (const [key, resolution] of Object.entries(preview.fieldResolutions || {})) {
    if (key === 'position') continue;
    let action = resolution.suggestedAction;
    if (!action) {
      action = resolution.requiresReview
        ? RESOLUTION_ACTIONS.KEEP_DUPLICATE
        : RESOLUTION_ACTIONS.KEEP_PRIMARY;
    }
    decisions[key] = { action };
  }
  if (preview.positions?.merged?.length) {
    decisions.position = {
      action: RESOLUTION_ACTIONS.MERGE_BOTH,
      positions: preview.positions.merged,
    };
  }
  return decisions;
}

export { PROFILE_FIELDS, parseSkills, unionSkills, isEmpty, normScalar };
