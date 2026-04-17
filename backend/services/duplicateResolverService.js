/**
 * Duplicate Resolver Service
 * 
 * Identifies and handles duplicate candidates based on email/phone uniqueness.
 * Allows duplicate names but enforces uniqueness on contact information.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 12.2
 */

import db from '../config/database.js';

/**
 * Check if a candidate is unique based on email/phone
 * @param {Object} candidate - Normalized candidate data
 * @param {Array} existingCandidates - Array of existing candidates from database
 * @returns {boolean} True if unique, false if duplicate
 */
function isUnique(candidate, existingCandidates) {
  const { email, phone } = candidate;

  // If no email and no phone, allow import (will get unique System_ID)
  if (!email && !phone) {
    return true;
  }

  // Check for duplicates in existing candidates
  for (const existing of existingCandidates) {
    // Email-based uniqueness check
    if (email && existing.email && email.toLowerCase() === existing.email.toLowerCase()) {
      return false;
    }

    // Phone-based uniqueness check
    if (phone && existing.phone && phone === existing.phone) {
      return false;
    }
  }

  return true;
}

/**
 * Detect duplicates within file and against database
 * @param {Array} rows - Array of normalized candidate rows
 * @returns {Promise<Object>} DuplicateAnalysis with uniqueCandidates, duplicatesInFile, duplicatesInDatabase
 */
async function detectDuplicates(rows) {
  const uniqueCandidates = [];
  const duplicatesInFile = [];
  const duplicatesInDatabase = [];

  // Extract all emails and phones from rows for batch query
  const emails = rows
    .map(r => r.normalized.email)
    .filter(e => e);
  
  const phones = rows
    .map(r => r.normalized.phone)
    .filter(p => p);

  // Query database for existing candidates with matching email or phone
  let existingCandidates = [];
  if (emails.length > 0 || phones.length > 0) {
    existingCandidates = await queryExistingCandidates(emails, phones);
  }

  // Track seen emails and phones within the file
  const seenEmails = new Map(); // email -> row indices
  const seenPhones = new Map(); // phone -> row indices

  // Process each row
  rows.forEach((row, index) => {
    const { email, phone, name } = row.normalized;
    let isDuplicateInFile = false;
    let isDuplicateInDatabase = false;

    // Check for duplicates within the file
    if (email) {
      const emailLower = email.toLowerCase();
      if (seenEmails.has(emailLower)) {
        isDuplicateInFile = true;
        const existingIndices = seenEmails.get(emailLower);
        
        // Check if this duplicate group already exists
        let group = duplicatesInFile.find(g => 
          g.rows.includes(existingIndices[0])
        );
        
        if (group) {
          group.rows.push(index);
        } else {
          duplicatesInFile.push({
            rows: [...existingIndices, index],
            matchCriteria: 'email',
            value: email
          });
        }
        
        existingIndices.push(index);
      } else {
        seenEmails.set(emailLower, [index]);
      }
    }

    if (phone) {
      if (seenPhones.has(phone)) {
        isDuplicateInFile = true;
        const existingIndices = seenPhones.get(phone);
        
        // Check if this duplicate group already exists
        let group = duplicatesInFile.find(g => 
          g.rows.includes(existingIndices[0])
        );
        
        if (!group) {
          duplicatesInFile.push({
            rows: [...existingIndices, index],
            matchCriteria: 'phone',
            value: phone
          });
        } else if (!group.rows.includes(index)) {
          group.rows.push(index);
        }
        
        existingIndices.push(index);
      } else {
        seenPhones.set(phone, [index]);
      }
    }

    // Check for duplicates against database
    if (!isUnique(row.normalized, existingCandidates)) {
      isDuplicateInDatabase = true;
      
      // Find which existing candidate matches
      const matchingCandidate = existingCandidates.find(existing => {
        if (email && existing.email && email.toLowerCase() === existing.email.toLowerCase()) {
          return true;
        }
        if (phone && existing.phone && phone === existing.phone) {
          return true;
        }
        return false;
      });

      if (matchingCandidate) {
        const matchCriteria = 
          email && matchingCandidate.email && email.toLowerCase() === matchingCandidate.email.toLowerCase()
            ? 'email'
            : 'phone';

        duplicatesInDatabase.push({
          uploadRow: index,
          existingCandidateId: matchingCandidate.id,
          existingCandidateName: matchingCandidate.name,
          matchCriteria,
          value: matchCriteria === 'email' ? email : phone
        });
      }
    }

    // Add to unique candidates if not a duplicate
    if (!isDuplicateInFile && !isDuplicateInDatabase) {
      uniqueCandidates.push(row);
    }
  });

  return {
    uniqueCandidates,
    duplicatesInFile,
    duplicatesInDatabase
  };
}

/**
 * Query database for existing candidates with matching email or phone
 * @param {Array} emails - Array of email addresses
 * @param {Array} phones - Array of phone numbers
 * @returns {Promise<Array>} Array of existing candidates
 */
async function queryExistingCandidates(emails, phones) {
  if (emails.length === 0 && phones.length === 0) {
    return [];
  }

  try {
    let query = 'SELECT id, name, email, phone FROM candidates WHERE ';
    const conditions = [];
    const params = [];

    if (emails.length > 0) {
      conditions.push(`email IN (${emails.map(() => '?').join(',')})`);
      params.push(...emails);
    }

    if (phones.length > 0) {
      conditions.push(`phone IN (${phones.map(() => '?').join(',')})`);
      params.push(...phones);
    }

    query += conditions.join(' OR ');

    const [rows] = await db.query(query, params);
    return rows;
  } catch (error) {
    console.error('Error querying existing candidates:', error);
    throw error;
  }
}

export {
  isUnique,
  detectDuplicates,
  queryExistingCandidates
};
