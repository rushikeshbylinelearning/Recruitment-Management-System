/**
 * Field Mapper Service
 * 
 * Intelligently maps uploaded column names to system schema fields using
 * fuzzy matching and synonym dictionary. Part of the Intelligent Candidate
 * Import System.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import * as fuzzball from 'fuzzball';

// Confidence threshold for automatic field mapping (70%)
const CONFIDENCE_THRESHOLD = 0.70;

// System schema fields
const SYSTEM_FIELDS = [
  'name',
  'email',
  'phone',
  'position',
  'experience',
  'location',
  'source',
  'resume',
  'notes',
  'skills',
  'expertise',
  'salary_expected',
  'salary_offered',
  'salary_negotiable',
  'joining_time',
  'notice_period',
  'immediate_joiner',
  'willing_alternate_saturday',
  'work_preference',
  'current_ctc',
  'ctc_frequency',
  'in_house_assignment',
  'assignment_location',
  'resume_location',
  'stage'  // Stage/workflow detection for bulk import
];

// Synonym dictionary for common field variations
const FIELD_SYNONYMS = {
  name: [
    'full_name', 'candidate_name', 'applicant_name',
    'full name', 'candidate name', 'applicant name', 'name of candidate',
    'candidate_full_name', 'person name', 'employee name'
  ],
  email: [
    'email_address', 'e-mail', 'mail', 'email id', 'e-mail address',
    'email address', 'contact email', 'emailid', 'email-id'
  ],
  phone: [
    'phone_number', 'mobile', 'contact', 'telephone', 'cell',
    'mobile number', 'contact number', 'phone no', 'mobile no', 'tel',
    'phone number', 'contact no', 'mob no', 'mob', 'ph no', 'ph',
    'phone no.', 'mobile no.', 'contact no.'
  ],
  position: [
    'role', 'job_title', 'title', 'designation', 'job role',
    'job position', 'position applied', 'applied for', 'post',
    'job title', 'current designation', 'profile'
  ],
  experience: [
    'years_of_experience', 'exp', 'work_experience', 'total_experience',
    'yoe', 'years of experience', 'work exp', 'total exp',
    'experience (years)', 'total experience', 'experience in years',
    'years exp', 'exp (yrs)', 'experience(yrs)'
  ],
  location: [
    'city', 'address', 'current_location', 'residence', 'current location',
    'location city', 'current city', 'hometown', 'place', 'residing city',
    'present location', 'base location'
  ],
  source: [
    'referral_source', 'application_source', 'how_did_you_hear',
    'source of application', 'referred by', 'lead source',
    'candidate source', 'sourced from', 'sourced via'
  ],
  skills: [
    'technical_skills', 'skill_set', 'competencies', 'technical skills',
    'skill set', 'key skills', 'core skills', 'expertise',
    'technologies', 'tech stack', 'primary skills', 'secondary skills',
    'skill', 'skillset'
  ],
  salary_expected: [
    'expected_salary', 'expected ctc', 'salary expectation',
    'expected compensation', 'expected salary', 'expected_ctc',
    'ctc expected', 'salary expected', 'expected package',
    'expected cost to company', 'ectc'
  ],
  salary_offered: [
    'offered_salary', 'offered ctc', 'salary offer',
    'compensation offered', 'offered salary', 'offered_ctc',
    'ctc offered', 'offer salary', 'offered package'
  ],
  salary_negotiable: [
    'negotiable', 'salary negotiable', 'is negotiable',
    'ctc negotiable', 'is salary negotiable'
  ],
  joining_time: [
    'joining_date', 'available from', 'can join', 'joining availability',
    'when can you join', 'joining date', 'date of joining', 'doj',
    'available to join', 'joining', 'start date', 'available date'
  ],
  notice_period: [
    'notice', 'notice period days', 'current notice period',
    'notice period', 'notice_period', 'serving notice',
    'notice period (days)', 'notice period (weeks)', 'np'
  ],
  immediate_joiner: [
    'immediate', 'can join immediately', 'immediate availability',
    'immediate joiner', 'immediate joining', 'willing to join immediately',
    'willing to work on alternate saturday', 'alternate saturday',
    'alt saturday', 'work on saturday'
  ],
  work_preference: [
    'work_mode', 'preferred work mode', 'work location preference',
    'remote preference', 'work preference', 'work mode',
    'wfh preference', 'onsite/remote', 'work type', 'preferred mode',
    'work from home', 'remote/onsite', 'work arrangement'
  ],
  current_ctc: [
    'current_salary', 'current compensation', 'present ctc',
    'current package', 'current ctc', 'ctc', 'current salary',
    'present salary', 'current cost to company', 'cctc',
    'current_package', 'present package'
  ],
  ctc_frequency: [
    'salary_frequency', 'ctc type', 'salary type', 'monthly or annual',
    'ctc frequency', 'salary frequency', 'pay frequency',
    'compensation frequency', 'monthly/annual', 'annual/monthly'
  ],
  resume: [
    'cv', 'resume file', 'curriculum vitae', 'resume link',
    'resume location', 'resume location/link', 'resume url',
    'cv link', 'resume path', 'resume/cv', 'attachment',
    'resume location / link', 'resume_link', 'cv url'
  ],
  notes: [
    'comments', 'remarks', 'additional notes', 'other information',
    'hr remarks', 'hr notes', 'hr comment', 'recruiter notes',
    'recruiter remarks', 'feedback', 'interviewer remarks',
    'additional comments', 'general remarks', 'note'
  ],
  expertise: [
    'expertise', 'domain', 'specialization', 'area of expertise',
    'functional area', 'domain expertise', 'core expertise',
    'primary expertise', 'subject matter expertise'
  ],
  willing_alternate_saturday: [
    'willing to work on alternate saturday', 'alternate saturday',
    'alt saturday', 'work on saturday', 'saturday availability',
    'willing alternate saturday', 'alternate sat', 'sat availability',
    'willing to work on saturdays', 'saturday working'
  ],
  in_house_assignment: [
    'in house assignment', 'in-house assignment', 'inhouse assignment',
    'assignment status', 'in house assignment status',
    'internal assignment', 'assignment'
  ],
  assignment_location: [
    'assignment location', 'assignment location/link',
    'assignment location / link', 'in office assignment',
    'office assignment', 'assignment link', 'assignment url',
    'in-office assignment', 'inoffice assignment'
  ],
  resume_location: [
    'resume location', 'resume location/link', 'resume location / link',
    'resume url', 'resume link', 'cv link', 'resume path',
    'cv url', 'resume file link', 'resume/cv link'
  ],
  stage: [
    'status', 'candidate stage', 'workflow', 'workflow stage',
    'candidate status', 'application status', 'current stage',
    'hiring stage', 'recruitment stage', 'pipeline stage'
  ]
};

class FieldMapperService {
  /**
   * Calculate confidence score between source column and target field
   * Uses Levenshtein distance via fuzzball library
   * 
   * @param {string} sourceColumn - Column name from uploaded file
   * @param {string} targetField - System schema field name
   * @returns {number} - Confidence score between 0.0 and 1.0
   */
  calculateConfidence(sourceColumn, targetField) {
    if (!sourceColumn || !targetField) {
      return 0.0;
    }

    // Normalize strings: lowercase and trim
    const normalizedSource = sourceColumn.toLowerCase().trim();
    const normalizedTarget = targetField.toLowerCase().trim();

    // Exact match returns 1.0
    if (normalizedSource === normalizedTarget) {
      return 1.0;
    }

    // Use fuzzball's ratio method (returns 0-100)
    // This uses Levenshtein distance: similarity = 1 - (distance / maxLength)
    const similarity = fuzzball.ratio(normalizedSource, normalizedTarget);
    
    // Convert to 0.0-1.0 scale
    return similarity / 100;
  }

  /**
   * Get synonyms for a target field
   * 
   * @param {string} targetField - System schema field name
   * @returns {string[]} - Array of synonym strings
   */
  getSynonyms(targetField) {
    return FIELD_SYNONYMS[targetField] || [];
  }

  /**
   * Map uploaded column headers to system schema fields
   * Uses fuzzy matching and synonym dictionary
   * 
   * @param {string[]} headers - Column headers from uploaded file
   * @param {Object[]} savedMappings - Optional saved mappings from previous uploads
   * @returns {Object} - FieldMappingResult with mappings, unmappedColumns, conflicts
   */
  mapFields(headers, savedMappings = []) {
    const mappings = [];
    const unmappedColumns = [];
    const conflicts = {};
    const usedTargetFields = new Set();

    // Process each header
    headers.forEach(header => {
      const normalizedHeader = header.toLowerCase().trim();
      let bestMatch = null;
      let bestConfidence = 0;
      let matchMethod = 'fuzzy';

      // Check saved mappings first
      const savedMapping = savedMappings.find(
        m => m.sourceColumn.toLowerCase().trim() === normalizedHeader
      );
      
      if (savedMapping) {
        bestMatch = savedMapping.targetField;
        bestConfidence = 1.0;
        matchMethod = 'manual';
      } else {
        // Try to find best match among system fields
        SYSTEM_FIELDS.forEach(targetField => {
          // Check for exact match
          if (normalizedHeader === targetField.toLowerCase()) {
            if (1.0 > bestConfidence) {
              bestMatch = targetField;
              bestConfidence = 1.0;
              matchMethod = 'exact';
            }
            return;
          }

          // Check synonyms
          const synonyms = this.getSynonyms(targetField);
          const synonymMatch = synonyms.find(
            syn => syn.toLowerCase().trim() === normalizedHeader
          );
          
          if (synonymMatch) {
            if (1.0 > bestConfidence) {
              bestMatch = targetField;
              bestConfidence = 1.0;
              matchMethod = 'synonym';
            }
            return;
          }

          // Calculate fuzzy match confidence
          const confidence = this.calculateConfidence(header, targetField);
          if (confidence > bestConfidence) {
            bestMatch = targetField;
            bestConfidence = confidence;
            matchMethod = 'fuzzy';
          }
        });
      }

      // Determine if mapping is acceptable
      if (bestMatch && bestConfidence >= CONFIDENCE_THRESHOLD) {
        // Check for conflicts (multiple columns mapping to same field)
        if (usedTargetFields.has(bestMatch)) {
          // Conflict detected
          if (!conflicts[bestMatch]) {
            conflicts[bestMatch] = {
              targetField: bestMatch,
              candidates: []
            };
            
            // Add the previously mapped column to conflicts
            const previousMapping = mappings.find(m => m.targetField === bestMatch);
            if (previousMapping) {
              conflicts[bestMatch].candidates.push({
                sourceColumn: previousMapping.sourceColumn,
                confidence: previousMapping.confidence
              });
            }
          }
          
          // Add current column to conflicts
          conflicts[bestMatch].candidates.push({
            sourceColumn: header,
            confidence: bestConfidence
          });

          // Keep the highest confidence mapping
          const existingMapping = mappings.find(m => m.targetField === bestMatch);
          if (existingMapping && bestConfidence > existingMapping.confidence) {
            // Replace with higher confidence mapping
            const index = mappings.indexOf(existingMapping);
            mappings[index] = {
              sourceColumn: header,
              targetField: bestMatch,
              confidence: bestConfidence,
              method: matchMethod
            };
          }
        } else {
          // No conflict, add mapping
          mappings.push({
            sourceColumn: header,
            targetField: bestMatch,
            confidence: bestConfidence,
            method: matchMethod
          });
          usedTargetFields.add(bestMatch);
        }
      } else {
        // Below threshold or no match found
        unmappedColumns.push(header);
      }
    });

    return {
      mappings,
      unmappedColumns,
      conflicts: Object.values(conflicts)
    };
  }
}

// Export singleton instance
export default new FieldMapperService();
