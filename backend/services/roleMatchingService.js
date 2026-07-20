/**
 * Role Matching Service
 *
 * Intelligent role/position matching engine for auto job segregation.
 * Supports exact match, fuzzy match (fuzzball), skill-based fallback,
 * and admin-configurable manual mapping config.
 *
 * Matching priority:
 *  1. Manual mapping config (admin-defined aliases)
 *  2. Exact match (case-insensitive)
 *  3. Fuzzy match via fuzzball token_set_ratio (≥ FUZZY_THRESHOLD)
 *  4. Skill-based fallback (if role is missing/unmatched)
 */

import * as fuzzball from 'fuzzball';
import db from '../config/database.js';

// Minimum fuzzy score (0-100) to accept a match
const FUZZY_THRESHOLD = 65;

// Minimum skill overlap count to accept a skill-based match
const SKILL_MATCH_MIN = 2;

// ─── Admin-configurable manual mapping ───────────────────────────────────────
// Keys are lowercase aliases; values are canonical job title substrings.
// Admins can extend this via the DB table `role_alias_mappings` (optional).
const DEFAULT_MANUAL_MAPPINGS = {
  'hr':                   'HR Executive',
  'hr exec':              'HR Executive',
  'hr executive':         'HR Executive',
  'fsd':                  'Full Stack Developer',
  'full stack dev':       'Full Stack Developer',
  'full stack developer': 'Full Stack Developer',
  'it support':           'Senior IT',
  'senior it':            'Senior IT',
  'digital marketing':    'Digital Marketing Executive',
  'dm exec':              'Digital Marketing Executive',
  'graphic design':       'Graphic Designer',
  'animator':             'Animator',
  'project manager':      'Project Manager/Coordinator',
  'pm':                   'Project Manager/Coordinator',
  'coordinator':          'Project Manager/Coordinator',
  'linkedin sales':       'LinkedIn Profile Sales',
  'linkedin profile sales': 'LinkedIn Profile Sales',
  'linkedin it':          'Linkedin Profiles IT',
  'linkedin id':          'LinkedIn Profiles ID',
  'instructional content writter': 'Instructional Content Writer',
  'instructional content writer':  'Instructional Content Writer',
  'instructional designer':        'Instructional Designer',
  'content writter':               'Content Writer',
  // Book1.xlsx / tracker abbreviations
  'id':                            'Instructional Designer',
  'bde':                           'Business Development Executive',
  'content':                       'Content Writer',
  'dm':                            'Digital Marketing Executive',
  'gd':                            'Graphic Designer',
  'pc':                            'Project Manager/Coordinator',
  'icw':                           'Instructional Content Writer',
  'intern':                        'Intern',
  'eld':                           'E-Learning Developer',
  'senior fsd':                    'Full Stack Developer',
  'fsc':                           'Full Stack Developer',
  'ui/ux':                         'Graphic Designer',
  'visualizer':                    'Visualizer',
  'markering':                     'Marketing Executive',
  'marketing executive':           'Marketing Executive',
  'sales and marketing':           'Sales and Marketing',
  'intern sales and marketing':    'Intern & Fresher Sales/Marketing',
};

// Skill → job title keyword mapping for skill-based fallback
const SKILL_JOB_MAP = [
  { skills: ['react', 'node', 'nodejs', 'javascript', 'typescript', 'vue', 'angular', 'express', 'mongodb', 'next.js', 'nextjs'], job: 'Full Stack Developer' },
  { skills: ['python', 'django', 'flask', 'fastapi', 'machine learning', 'ml', 'ai', 'data science', 'pandas', 'numpy'], job: 'Full Stack Developer' },
  { skills: ['java', 'spring', 'spring boot', 'hibernate', 'maven'], job: 'Full Stack Developer' },
  { skills: ['hr', 'recruitment', 'talent acquisition', 'payroll', 'onboarding', 'hris', 'hrms'], job: 'HR Executive' },
  { skills: ['seo', 'sem', 'google ads', 'facebook ads', 'social media', 'content marketing', 'email marketing', 'digital marketing'], job: 'Digital Marketing Executive' },
  { skills: ['photoshop', 'illustrator', 'figma', 'canva', 'graphic design', 'ui design', 'ux design', 'adobe'], job: 'Graphic Designer' },
  { skills: ['after effects', 'premiere pro', '3d animation', 'blender', 'maya', 'animation', '2d animation', 'motion graphics'], job: 'Animator' },
  { skills: ['project management', 'agile', 'scrum', 'jira', 'confluence', 'pmp', 'prince2', 'coordination'], job: 'Project Manager/Coordinator' },
  { skills: ['networking', 'windows server', 'linux', 'active directory', 'it support', 'helpdesk', 'hardware', 'troubleshooting'], job: 'Senior IT' },
  { skills: ['linkedin', 'lead generation', 'b2b sales', 'crm', 'salesforce', 'cold calling', 'business development'], job: 'LinkedIn Profile Sales' },
];

/**
 * Load active job postings from DB.
 * When multiple jobs share the same title (duplicates), only the one with the
 * most existing candidates is returned per title. This ensures new imports
 * always route to the same job card that already holds the bulk of applicants.
 * Ties are broken by lowest id (oldest job).
 * @returns {Promise<Array<{id: number, title: string}>>}
 */
async function loadActiveJobs() {
  // For each distinct title, pick the job_id with the highest candidate count.
  // Ties broken by lowest id so the result is deterministic.
  const [jobs] = await db.query(
    `SELECT j.id, j.title
     FROM job_postings j
     LEFT JOIN candidates c ON c.job_id = j.id
     WHERE j.status = 'Active'
     GROUP BY j.id, j.title
     ORDER BY COUNT(c.id) DESC, j.id ASC`
  );

  // Deduplicate: keep only the first occurrence of each lowercase title
  const seen = new Set();
  const unique = [];
  for (const job of jobs) {
    const key = job.title.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(job);
    }
  }
  return unique;
}

/**
 * Load admin-defined role alias mappings from DB (if table exists).
 * Falls back to DEFAULT_MANUAL_MAPPINGS if table doesn't exist.
 * @returns {Promise<Object>} alias → canonical title map
 */
async function loadManualMappings() {
  try {
    const [rows] = await db.query(
      `SELECT alias, canonical_title FROM role_alias_mappings WHERE is_active = 1`
    );
    if (rows && rows.length > 0) {
      const map = { ...DEFAULT_MANUAL_MAPPINGS };
      rows.forEach(r => {
        map[r.alias.toLowerCase().trim()] = r.canonical_title;
      });
      return map;
    }
  } catch {
    // Table doesn't exist yet — use defaults
  }
  return DEFAULT_MANUAL_MAPPINGS;
}

/**
 * Normalize a raw role string:
 *  - Trim whitespace
 *  - Collapse multiple spaces
 *  - Title-case
 * @param {string} raw
 * @returns {string}
 */
function normalizeRoleText(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * Find the best matching job for a given role string.
 * Returns { jobId, jobTitle, matchMethod, score } or null.
 *
 * @param {string} roleRaw - Raw role/position from Excel
 * @param {Array} jobs - Active job postings [{id, title}]
 * @param {Object} manualMappings - Alias → canonical title map
 * @returns {{ jobId: number, jobTitle: string, matchMethod: string, score: number } | null}
 */
function matchRoleToJob(roleRaw, jobs, manualMappings) {
  if (!roleRaw || !jobs || jobs.length === 0) return null;

  const roleLower = roleRaw.trim().toLowerCase();

  // 1. Manual mapping check
  const manualMatch = manualMappings[roleLower];
  if (manualMatch) {
    const manualLower = manualMatch.toLowerCase();
    const job = jobs.find(j => j.title.toLowerCase().includes(manualLower) || manualLower.includes(j.title.toLowerCase()));
    if (job) {
      return { jobId: job.id, jobTitle: job.title, matchMethod: 'manual', score: 100 };
    }
  }

  let bestJob = null;
  let bestScore = 0;
  let bestMethod = 'fuzzy';

  for (const job of jobs) {
    const jobTitleLower = job.title.toLowerCase();
    let score = 0;
    let method = 'fuzzy';

    // 2. Exact match
    if (roleLower === jobTitleLower) {
      score = 100;
      method = 'exact';
    }
    // 3a. Job title contains role (e.g. "HR" in "HR Executive")
    else if (jobTitleLower.includes(roleLower) && roleLower.length > 2) {
      score = 85;
      method = 'partial';
    }
    // 3b. Role contains job title
    else if (roleLower.includes(jobTitleLower) && jobTitleLower.length > 2) {
      score = 80;
      method = 'partial';
    }
    // 4. Fuzzy match using token_set_ratio (handles word order differences)
    else {
      const fuzzyScore = fuzzball.token_set_ratio(roleLower, jobTitleLower);
      if (fuzzyScore >= FUZZY_THRESHOLD) {
        score = fuzzyScore;
        method = 'fuzzy';
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestJob = job;
      bestMethod = method;
    }
  }

  if (bestJob && bestScore >= FUZZY_THRESHOLD) {
    return { jobId: bestJob.id, jobTitle: bestJob.title, matchMethod: bestMethod, score: bestScore };
  }

  return null;
}

/**
 * Find the best matching job based on candidate skills (fallback).
 * @param {Array<string>} skills - Candidate skills array
 * @param {Array} jobs - Active job postings
 * @returns {{ jobId: number, jobTitle: string, matchMethod: string, score: number } | null}
 */
function matchSkillsToJob(skills, jobs) {
  if (!skills || skills.length === 0 || !jobs || jobs.length === 0) return null;

  const skillsLower = skills.map(s => s.toLowerCase().trim());

  let bestJob = null;
  let bestMatchCount = 0;
  let bestKeyword = '';

  for (const mapping of SKILL_JOB_MAP) {
    const matchCount = mapping.skills.filter(s => skillsLower.some(cs => cs.includes(s) || s.includes(cs))).length;
    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestKeyword = mapping.job;
    }
  }

  if (bestMatchCount >= SKILL_MATCH_MIN && bestKeyword) {
    const keywordLower = bestKeyword.toLowerCase();
    const job = jobs.find(j =>
      j.title.toLowerCase().includes(keywordLower) ||
      keywordLower.includes(j.title.toLowerCase())
    );
    if (job) {
      return {
        jobId: job.id,
        jobTitle: job.title,
        matchMethod: 'skill_based',
        score: Math.min(50 + bestMatchCount * 5, 75)
      };
    }
  }

  return null;
}

/**
 * Build a comprehensive job lookup map for all candidates in a batch.
 * Returns per-candidate match results for reporting.
 *
 * @param {Array} candidates - Normalized candidate rows
 * @param {number|null} jobIdOverride - Explicit job_id from import options
 * @returns {Promise<{
 *   lookupMap: Map<string, number>,
 *   matchResults: Map<string, {jobId: number, jobTitle: string, matchMethod: string, score: number}>,
 *   jobs: Array
 * }>}
 */
async function buildJobSegregationMap(candidates, jobIdOverride) {
  const lookupMap = new Map();    // candidateKey → jobId
  const matchResults = new Map(); // candidateKey → match info

  const jobs = await loadActiveJobs();

  if (jobIdOverride) {
    // All candidates go to the override job — no per-candidate matching needed,
    // but we still return jobs so the segregation summary can resolve the title.
    return { lookupMap, matchResults, jobs };
  }

  if (!jobs || jobs.length === 0) {
    return { lookupMap, matchResults, jobs: [] };
  }

  const manualMappings = await loadManualMappings();

  for (let idx = 0; idx < candidates.length; idx++) {
    const candidate = candidates[idx];
    const norm = candidate.normalized || {};
    const position = (norm.position || '').trim();
    const expertise = (norm.expertise || '').trim();
    const skills = Array.isArray(norm.skills) ? norm.skills : [];

    // Use a stable, prefixed key to avoid collisions
    const candidateKey = getCandidateKey(norm, idx);

    let matchResult = null;

    // Try position first
    if (position) {
      matchResult = matchRoleToJob(position, jobs, manualMappings);
    }

    // Try expertise if position didn't match
    if (!matchResult && expertise) {
      matchResult = matchRoleToJob(expertise, jobs, manualMappings);
    }

    // Skill-based fallback
    if (!matchResult && skills.length > 0) {
      matchResult = matchSkillsToJob(skills, jobs);
    }

    if (matchResult) {
      lookupMap.set(candidateKey, matchResult.jobId);
      matchResults.set(candidateKey, matchResult);
    }
    // else: candidate goes to unassigned pool (job_id = null)
  }

  return { lookupMap, matchResults, jobs };
}

/**
 * Get a candidate's stable key (same logic as buildJobSegregationMap).
 * Uses email (most unique) → phone → name+index fallback.
 * @param {Object} normalized
 * @param {number} [index] - Row index to disambiguate name-only records
 * @returns {string}
 */
function getCandidateKey(normalized, index) {
  const email = (normalized.email || '').trim().toLowerCase();
  const phone = (normalized.phone || '').trim().toLowerCase();
  const name = (normalized.name || '').trim().toLowerCase();
  if (email) return `email:${email}`;
  if (phone) return `phone:${phone}`;
  // Fall back to name + index to avoid collisions between same-named candidates
  return `name:${name}:${index ?? Math.random()}`;
}

export {
  buildJobSegregationMap,
  matchRoleToJob,
  matchSkillsToJob,
  normalizeRoleText,
  getCandidateKey,
  loadActiveJobs,
  FUZZY_THRESHOLD,
  SKILL_MATCH_MIN,
};
