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
  'salary_expected',
  'salary_offered',
  'salary_negotiable',
  'joining_time',
  'notice_period',
  'immediate_joiner',
  'work_preference',
  'current_ctc',
  'ctc_frequency'
];

// Synonym dictionary for common field variations
const FIELD_SYNONYMS = {
  name: ['full_name', 'candidate_name', 'applicant_name', 'full name', 'candidate name', 'applicant name', 'name of candidate'],
  email: ['email_address', 'e-mail', 'mail', 'email id', 'e-mail address', 'email address', 'contact email'],
  phone: ['phone_number', 'mobile', 'contact', 'telephone', 'cell', 'mobile number', 'contact number', 'phone no', 'mobile no', 'tel'],
  position: ['role', 'job_title', 'title', 'designation', 'job role', 'job position', 'position applied'],
  experience: ['years_of_experience', 'exp', 'work_experience', 'total_experience', 'yoe', 'years of experience', 'work exp', 'total exp'],
  location: ['city', 'address', 'current_location', 'residence', 'current location', 'location city'],
  source: ['referral_source', 'application_source', 'how_did_you_hear', 'source of application', 'referred by'],
  skills: ['technical_skills', 'skill_set', 'competencies', 'technical skills', 'skill set', 'key skills'],
  salary_expected: ['expected_salary', 'expected ctc', 'salary expectation', 'expected compensation'],
  salary_offered: ['offered_salary', 'offered ctc', 'salary offer', 'compensation offered'],
  salary_negotiable: ['negotiable', 'salary negotiable', 'is negotiable'],
  joining_time: ['joining_date', 'available from', 'can join', 'joining availability', 'when can you join'],
  notice_period: ['notice', 'notice period days', 'current notice period'],
  immediate_joiner: ['immediate', 'can join immediately', 'immediate availability'],
  work_preference: ['work_mode', 'preferred work mode', 'work location preference', 'remote preference'],
  current_ctc: ['current_salary', 'current compensation', 'present ctc', 'current package'],
  ctc_frequency: ['salary_frequency', 'ctc type', 'salary type', 'monthly or annual'],
  resume: ['cv', 'resume file', 'curriculum vitae', 'resume link'],
  notes: ['comments', 'remarks', 'additional notes', 'other information']
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
