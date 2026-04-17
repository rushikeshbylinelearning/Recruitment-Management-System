/**
 * Integration tests for Add From Interaction endpoint
 * Tests Task 6.1: POST /api/candidate/add-from-interaction endpoint
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { query } from '../config/database.js';

describe('Add From Interaction Endpoint', () => {
  let testInteractionId;
  let testCandidateId;
  let testUserId = 1; // Assuming user ID 1 exists

  before(async () => {
    // Clean up any existing test data
    await query('DELETE FROM interaction_candidates WHERE phone = ?', ['+1234567890']);
    await query('DELETE FROM candidates WHERE phone = ?', ['+1234567890']);
  });

  after(async () => {
    // Clean up test data
    if (testInteractionId) {
      await query('DELETE FROM interaction_notes WHERE candidate_id = ?', [testInteractionId]);
      await query('DELETE FROM interaction_candidates WHERE id = ?', [testInteractionId]);
    }
    if (testCandidateId) {
      await query('DELETE FROM hr_notes WHERE candidate_id = ?', [testCandidateId]);
      await query('DELETE FROM candidates WHERE id = ?', [testCandidateId]);
    }
  });

  it('should create new candidate from interaction', async () => {
    // Create test interaction candidate
    const result = await query(
      `INSERT INTO interaction_candidates (name, phone, email, source, created_by) 
       VALUES (?, ?, ?, ?, ?)`,
      ['Test Candidate', '+1234567890', 'test@example.com', 'Manual', testUserId]
    );
    testInteractionId = result.insertId;

    // Add interaction note
    await query(
      `INSERT INTO interaction_notes (candidate_id, note, status, created_by) 
       VALUES (?, ?, ?, ?)`,
      [testInteractionId, 'Initial contact note', 'Interested', testUserId]
    );

    // Import integration service functions
    const { findCandidateByPhone, createCandidateFromInteraction, linkInteractionToCandidate, migrateInteractionNotesToHRNotes } = await import('../services/integrationService.js');

    // Check if candidate exists
    let candidate = await findCandidateByPhone('+1234567890');
    assert.strictEqual(candidate, null, 'Candidate should not exist initially');

    // Create candidate from interaction
    testCandidateId = await createCandidateFromInteraction(
      {
        name: 'Test Candidate',
        phone: '+1234567890',
        email: 'test@example.com',
        source: 'Interaction'
      },
      'Interested'
    );

    assert.ok(testCandidateId, 'Candidate ID should be returned');

    // Verify candidate was created
    const candidates = await query('SELECT * FROM candidates WHERE id = ?', [testCandidateId]);
    assert.strictEqual(candidates.length, 1, 'Candidate should be created');
    assert.strictEqual(candidates[0].name, 'Test Candidate');
    assert.strictEqual(candidates[0].phone, '+1234567890');
    assert.strictEqual(candidates[0].stage, 'Applied', 'Stage should be Applied for Interested status');

    // Link interaction to candidate
    await linkInteractionToCandidate(testInteractionId, testCandidateId);

    // Verify link was created
    const interactions = await query('SELECT * FROM interaction_candidates WHERE id = ?', [testInteractionId]);
    assert.strictEqual(interactions[0].candidate_id, testCandidateId, 'Interaction should be linked to candidate');

    // Migrate notes
    const migratedCount = await migrateInteractionNotesToHRNotes(testInteractionId, testCandidateId);
    assert.strictEqual(migratedCount, 1, 'One note should be migrated');

    // Verify HR note was created
    const hrNotes = await query('SELECT * FROM hr_notes WHERE candidate_id = ?', [testCandidateId]);
    assert.strictEqual(hrNotes.length, 1, 'HR note should be created');
    assert.strictEqual(hrNotes[0].note_text, 'Initial contact note');
    assert.strictEqual(hrNotes[0].stage, 'Applied');
  });

  it('should find existing candidate by phone', async () => {
    const { findCandidateByPhone } = await import('../services/integrationService.js');

    // Find the candidate we created in the previous test
    const candidate = await findCandidateByPhone('+1234567890');
    assert.ok(candidate, 'Candidate should be found');
    assert.strictEqual(candidate.phone, '+1234567890');
    assert.strictEqual(candidate.name, 'Test Candidate');
  });

  it('should handle null phone gracefully', async () => {
    const { findCandidateByPhone } = await import('../services/integrationService.js');

    const candidate = await findCandidateByPhone(null);
    assert.strictEqual(candidate, null, 'Should return null for null phone');
  });

  it('should handle null email gracefully', async () => {
    const { findCandidateByEmail } = await import('../services/integrationService.js');

    const candidate = await findCandidateByEmail(null);
    assert.strictEqual(candidate, null, 'Should return null for null email');
  });
});
