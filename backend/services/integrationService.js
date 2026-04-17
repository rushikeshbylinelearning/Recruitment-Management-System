/**
 * Integration Service
 * 
 * Handles the core logic for linking interactions to candidates, creating candidates 
 * from interactions, and migrating notes between systems. Uses the stageMappingService 
 * to determine the appropriate stage when creating candidates.
 * 
 * Requirements: Log Interaction Flow, Add to Pipeline Logic
 */

import { query, transaction } from '../config/database.js';
import { mapInteractionStatusToStage } from './stageMappingService.js';

/**
 * Find candidate by phone number
 * @param {string} phone - Phone number to search
 * @returns {Promise<Object|null>} Candidate object or null if not found
 */
async function findCandidateByPhone(phone) {
  if (!phone) {
    return null;
  }

  try {
    const results = await query(
      'SELECT * FROM candidates WHERE phone = ? LIMIT 1',
      [phone]
    );
    
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('[IntegrationService] Error finding candidate by phone:', error);
    throw error;
  }
}

/**
 * Find candidate by email address
 * @param {string} email - Email address to search
 * @returns {Promise<Object|null>} Candidate object or null if not found
 */
async function findCandidateByEmail(email) {
  if (!email) {
    return null;
  }

  try {
    const results = await query(
      'SELECT * FROM candidates WHERE email = ? LIMIT 1',
      [email]
    );
    
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('[IntegrationService] Error finding candidate by email:', error);
    throw error;
  }
}

/**
 * Check for duplicate candidates by phone or email
 * @param {string} phone - Phone number to check
 * @param {string} email - Email address to check (optional)
 * @returns {Promise<Object|null>} Existing candidate if found, null otherwise
 */
async function checkForDuplicateCandidate(phone, email) {
  try {
    // Check by phone first (phone is required)
    if (phone) {
      const candidateByPhone = await findCandidateByPhone(phone);
      if (candidateByPhone) {
        return {
          candidate: candidateByPhone,
          matchedBy: 'phone'
        };
      }
    }
    
    // Check by email if provided
    if (email) {
      const candidateByEmail = await findCandidateByEmail(email);
      if (candidateByEmail) {
        return {
          candidate: candidateByEmail,
          matchedBy: 'email'
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('[IntegrationService] Error checking for duplicate candidate:', error);
    throw error;
  }
}

/**
 * Create candidate in main pipeline from interaction data
 * @param {Object} interactionData - Interaction candidate data
 * @param {string} interactionData.name - Candidate name (optional, will use placeholder if missing)
 * @param {string} interactionData.phone - Candidate phone (optional if email provided)
 * @param {string} interactionData.email - Candidate email (optional if phone provided)
 * @param {string} interactionData.source - Candidate source
 * @param {string} interactionStatus - Current interaction status for stage mapping
 * @param {boolean} skipDuplicateCheck - Skip duplicate check (default: false)
 * @returns {Promise<string>} UUID of created candidate
 * @throws {Error} If duplicate candidate found or if both phone and email are missing
 */
async function createCandidateFromInteraction(interactionData, interactionStatus = null, skipDuplicateCheck = false) {
  try {
    // Normalize empty strings to null for phone and email
    const cleanPhone = interactionData.phone && interactionData.phone.trim() ? interactionData.phone.trim() : null;
    const cleanEmail = interactionData.email && interactionData.email.trim() ? interactionData.email.trim() : null;
    
    // Validate that at least one contact method exists
    if (!cleanPhone && !cleanEmail) {
      const error = new Error('At least one contact method (phone or email) is required');
      error.code = 'MISSING_CONTACT_INFO';
      throw error;
    }
    
    // Check for duplicates before creating
    if (!skipDuplicateCheck) {
      const duplicate = await checkForDuplicateCandidate(cleanPhone, cleanEmail);
      if (duplicate) {
        const error = new Error(`Candidate already exists with the same ${duplicate.matchedBy}`);
        error.code = 'DUPLICATE_CANDIDATE';
        error.matchedBy = duplicate.matchedBy;
        error.existingCandidate = duplicate.candidate;
        throw error;
      }
    }
    
    // Handle missing name with placeholder
    const candidateName = interactionData.name && interactionData.name.trim() 
      ? interactionData.name.trim() 
      : (cleanPhone ? `Contact ${cleanPhone}` : `Contact ${cleanEmail}`);
    
    // Map interaction status to candidate stage
    const stage = mapInteractionStatusToStage(interactionStatus);
    
    // Generate UUID for candidate
    const candidateId = await query('SELECT UUID() as uuid');
    const uuid = candidateId[0].uuid;
    
    // Create candidate record with minimal required fields
    const result = await query(
      `INSERT INTO candidates 
       (id, name, email, phone, position, stage, source, applied_date, score, assigned_to) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 0, 1)`,
      [
        uuid,
        candidateName,
        cleanEmail,
        cleanPhone,
        'General', // Default position
        stage,
        interactionData.source || 'Manual',
      ]
    );
    
    console.log('[IntegrationService] Created candidate from interaction:', uuid);
    return uuid;
  } catch (error) {
    console.error('[IntegrationService] Error creating candidate from interaction:', error);
    throw error;
  }
}

/**
 * Link interaction to candidate by updating interaction_candidates table
 * @param {number} interactionId - ID of interaction_candidates record
 * @param {string} candidateId - UUID of candidate in main pipeline
 * @returns {Promise<void>}
 */
async function linkInteractionToCandidate(interactionId, candidateId) {
  try {
    await query(
      'UPDATE interaction_candidates SET candidate_id = ? WHERE id = ?',
      [candidateId, interactionId]
    );
    
    console.log('[IntegrationService] Linked interaction', interactionId, 'to candidate', candidateId);
  } catch (error) {
    console.error('[IntegrationService] Error linking interaction to candidate:', error);
    throw error;
  }
}

/**
 * Migrate interaction notes to HR notes for a candidate
 * Copies all interaction_notes for an interaction to hr_notes table
 * @param {number} interactionId - ID of interaction_candidates record
 * @param {string} candidateId - UUID of candidate in main pipeline
 * @returns {Promise<number>} Number of notes migrated
 */
async function migrateInteractionNotesToHRNotes(interactionId, candidateId) {
  try {
    // Get all interaction notes for this interaction candidate
    const notes = await query(
      `SELECT note, status, created_by, created_at 
       FROM interaction_notes 
       WHERE candidate_id = ? 
       ORDER BY created_at ASC`,
      [interactionId]
    );
    
    if (notes.length === 0) {
      console.log('[IntegrationService] No notes to migrate for interaction', interactionId);
      return 0;
    }
    
    // Get current stage of candidate for HR notes
    const candidate = await query(
      'SELECT stage FROM candidates WHERE id = ? LIMIT 1',
      [candidateId]
    );
    
    if (candidate.length === 0) {
      throw new Error(`Candidate ${candidateId} not found`);
    }
    
    const currentStage = candidate[0].stage;
    
    // Insert each note as an HR note
    let migratedCount = 0;
    for (const note of notes) {
      // Map interaction status to interaction_type
      let interactionType = 'General Note';
      if (note.status === 'Interested' || note.status === 'Follow-up') {
        interactionType = 'Phone Call';
      }
      
      const existingNote = await query(
        `SELECT id FROM hr_notes
         WHERE candidate_id = ?
           AND stage = ?
           AND note_text = ?
           AND interaction_type = ?
           AND author_id = ?
           AND created_at = ?
         LIMIT 1`,
        [
          candidateId,
          currentStage,
          note.note,
          interactionType,
          note.created_by,
          note.created_at
        ]
      );

      if (existingNote.length === 0) {
        await query(
          `INSERT INTO hr_notes 
           (candidate_id, stage, note_text, interaction_type, author_id, created_at) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            candidateId,
            currentStage,
            note.note,
            interactionType,
            note.created_by,
            note.created_at
          ]
        );
        
        migratedCount++;
      }
    }
    
    console.log('[IntegrationService] Migrated', migratedCount, 'notes from interaction', interactionId, 'to candidate', candidateId);
    return migratedCount;
  } catch (error) {
    console.error('[IntegrationService] Error migrating interaction notes to HR notes:', error);
    throw error;
  }
}

export {
  findCandidateByPhone,
  findCandidateByEmail,
  checkForDuplicateCandidate,
  createCandidateFromInteraction,
  linkInteractionToCandidate,
  migrateInteractionNotesToHRNotes
};
