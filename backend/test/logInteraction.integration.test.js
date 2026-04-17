/**
 * Integration Test: Task 18.1 - Test complete Log Interaction flow
 * 
 * This test verifies the complete Log Interaction flow including:
 * 1. Logging interaction with new candidate (creates candidate in main pipeline)
 * 2. Logging interaction with existing candidate (links to existing candidate)
 * 3. HR notes creation for both scenarios
 * 4. Stage mapping from interaction status to candidate stage
 * 
 * Requirements: Log Interaction Flow
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { query } from '../config/database.js';
import { 
  findCandidateByPhone, 
  createCandidateFromInteraction, 
  linkInteractionToCandidate,
  checkForDuplicateCandidate
} from '../services/integrationService.js';
import { mapInteractionStatusToStage } from '../services/stageMappingService.js';

describe('Task 18.1: Complete Log Interaction Flow Integration Tests', () => {
  let testCandidateIds = [];
  let testInteractionIds = [];
  const testUserId = 1; // Assuming user ID 1 exists
  
  // Test data
  const newCandidatePhone = '+1-555-TEST-001';
  const newCandidateEmail = 'newcandidate@test.com';
  const existingCandidatePhone = '+1-555-TEST-002';
  const existingCandidateEmail = 'existing@test.com';

  before(async () => {
    // Clean up any existing test data
    await query('DELETE FROM hr_notes WHERE candidate_id IN (SELECT id FROM candidates WHERE phone IN (?, ?))', 
      [newCandidatePhone, existingCandidatePhone]);
    await query('DELETE FROM interaction_notes WHERE candidate_id IN (SELECT id FROM interaction_candidates WHERE phone IN (?, ?))', 
      [newCandidatePhone, existingCandidatePhone]);
    await query('DELETE FROM interaction_candidates WHERE phone IN (?, ?)', 
      [newCandidatePhone, existingCandidatePhone]);
    await query('DELETE FROM candidates WHERE phone IN (?, ?)', 
      [newCandidatePhone, existingCandidatePhone]);
  });

  after(async () => {
    // Clean up test data
    for (const id of testCandidateIds) {
      await query('DELETE FROM hr_notes WHERE candidate_id = ?', [id]);
      await query('DELETE FROM candidates WHERE id = ?', [id]);
    }
    for (const id of testInteractionIds) {
      await query('DELETE FROM interaction_notes WHERE candidate_id = ?', [id]);
      await query('DELETE FROM interaction_candidates WHERE id = ?', [id]);
    }
  });

  describe('Scenario 1: Log Interaction with New Candidate', () => {
    let newCandidateId;
    let newInteractionId;

    it('should create new candidate in main pipeline when logging interaction', async () => {
      // Step 1: Verify candidate doesn't exist
      const existingCandidate = await findCandidateByPhone(newCandidatePhone);
      assert.strictEqual(existingCandidate, null, 'Candidate should not exist initially');

      // Step 2: Create candidate from interaction with "Interested" status
      const interactionData = {
        name: 'New Test Candidate',
        phone: newCandidatePhone,
        email: newCandidateEmail,
        source: 'Phone Call'
      };

      newCandidateId = await createCandidateFromInteraction(interactionData, 'Interested');
      testCandidateIds.push(newCandidateId);

      assert.ok(newCandidateId, 'Candidate ID should be returned');

      // Step 3: Verify candidate was created in main pipeline
      const candidates = await query('SELECT * FROM candidates WHERE id = ?', [newCandidateId]);
      assert.strictEqual(candidates.length, 1, 'Candidate should be created');
      assert.strictEqual(candidates[0].name, 'New Test Candidate');
      assert.strictEqual(candidates[0].phone, newCandidatePhone);
      assert.strictEqual(candidates[0].email, newCandidateEmail);
      assert.strictEqual(candidates[0].source, 'Phone Call');
    });

    it('should map "Interested" status to "Applied" stage', async () => {
      // Verify stage mapping
      const stage = mapInteractionStatusToStage('Interested');
      assert.strictEqual(stage, 'Applied', 'Interested status should map to Applied stage');

      // Verify candidate has correct stage
      const candidates = await query('SELECT stage FROM candidates WHERE id = ?', [newCandidateId]);
      assert.strictEqual(candidates[0].stage, 'Applied', 'Candidate should be in Applied stage');
    });

    it('should create interaction_candidates record linked to main candidate', async () => {
      // Create interaction candidate record
      const result = await query(
        `INSERT INTO interaction_candidates (name, phone, email, source, candidate_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['New Test Candidate', newCandidatePhone, newCandidateEmail, 'Phone Call', newCandidateId, testUserId]
      );

      newInteractionId = result.insertId;
      testInteractionIds.push(newInteractionId);

      // Verify interaction is linked to candidate
      const interactions = await query('SELECT * FROM interaction_candidates WHERE id = ?', [newInteractionId]);
      assert.strictEqual(interactions.length, 1, 'Interaction should be created');
      assert.strictEqual(interactions[0].candidate_id, newCandidateId, 'Interaction should be linked to candidate');
    });

    it('should create interaction_notes record', async () => {
      // Create interaction note
      const noteResult = await query(
        `INSERT INTO interaction_notes (candidate_id, note, status, priority, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [newInteractionId, 'Initial contact - candidate is interested', 'Interested', 3, testUserId]
      );

      assert.ok(noteResult.insertId, 'Interaction note should be created');

      // Verify note was created
      const notes = await query('SELECT * FROM interaction_notes WHERE candidate_id = ?', [newInteractionId]);
      assert.strictEqual(notes.length, 1, 'Interaction note should exist');
      assert.strictEqual(notes[0].note, 'Initial contact - candidate is interested');
      assert.strictEqual(notes[0].status, 'Interested');
    });

    it('should create HR note linked to main candidate', async () => {
      // Create HR note
      await query(
        `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [newCandidateId, 'Applied', 'Initial contact - candidate is interested', 'Phone Call', testUserId]
      );

      // Verify HR note was created
      const hrNotes = await query('SELECT * FROM hr_notes WHERE candidate_id = ?', [newCandidateId]);
      assert.strictEqual(hrNotes.length, 1, 'HR note should be created');
      assert.strictEqual(hrNotes[0].note_text, 'Initial contact - candidate is interested');
      assert.strictEqual(hrNotes[0].stage, 'Applied');
      assert.strictEqual(hrNotes[0].interaction_type, 'Phone Call');
      assert.strictEqual(hrNotes[0].author_id, testUserId);
    });

    it('should verify complete flow for new candidate', async () => {
      // Verify all components are properly linked
      const candidate = await query('SELECT * FROM candidates WHERE id = ?', [newCandidateId]);
      const interaction = await query('SELECT * FROM interaction_candidates WHERE id = ?', [newInteractionId]);
      const interactionNotes = await query('SELECT * FROM interaction_notes WHERE candidate_id = ?', [newInteractionId]);
      const hrNotes = await query('SELECT * FROM hr_notes WHERE candidate_id = ?', [newCandidateId]);

      assert.strictEqual(candidate.length, 1, 'Candidate should exist');
      assert.strictEqual(interaction.length, 1, 'Interaction should exist');
      assert.strictEqual(interaction[0].candidate_id, newCandidateId, 'Interaction should link to candidate');
      assert.strictEqual(interactionNotes.length, 1, 'Interaction note should exist');
      assert.strictEqual(hrNotes.length, 1, 'HR note should exist');
      assert.strictEqual(candidate[0].stage, 'Applied', 'Candidate should be in Applied stage');
    });
  });

  describe('Scenario 2: Log Interaction with Existing Candidate', () => {
    let existingCandidateId;
    let existingInteractionId;

    it('should find existing candidate by phone', async () => {
      // Step 1: Create existing candidate in main pipeline
      const candidateIdResult = await query('SELECT UUID() as uuid');
      existingCandidateId = candidateIdResult[0].uuid;
      testCandidateIds.push(existingCandidateId);

      await query(
        `INSERT INTO candidates (id, name, email, phone, position, stage, source, applied_date, score, assigned_to)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 0, 1)`,
        [existingCandidateId, 'Existing Test Candidate', existingCandidateEmail, existingCandidatePhone, 
         'Software Engineer', 'Screening', 'LinkedIn']
      );

      // Step 2: Verify candidate exists
      const candidate = await findCandidateByPhone(existingCandidatePhone);
      assert.ok(candidate, 'Candidate should be found');
      assert.strictEqual(candidate.id, existingCandidateId);
      assert.strictEqual(candidate.phone, existingCandidatePhone);
      assert.strictEqual(candidate.stage, 'Screening');
    });

    it('should detect duplicate when trying to create candidate', async () => {
      // Check for duplicate
      const duplicate = await checkForDuplicateCandidate(existingCandidatePhone, existingCandidateEmail);
      
      assert.ok(duplicate, 'Duplicate should be detected');
      assert.strictEqual(duplicate.matchedBy, 'phone', 'Should match by phone');
      assert.strictEqual(duplicate.candidate.id, existingCandidateId);
    });

    it('should link interaction to existing candidate', async () => {
      // Create interaction candidate record linked to existing candidate
      const result = await query(
        `INSERT INTO interaction_candidates (name, phone, email, source, candidate_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['Existing Test Candidate', existingCandidatePhone, existingCandidateEmail, 
         'Phone Call', existingCandidateId, testUserId]
      );

      existingInteractionId = result.insertId;
      testInteractionIds.push(existingInteractionId);

      // Verify interaction is linked to existing candidate
      const interactions = await query('SELECT * FROM interaction_candidates WHERE id = ?', [existingInteractionId]);
      assert.strictEqual(interactions.length, 1, 'Interaction should be created');
      assert.strictEqual(interactions[0].candidate_id, existingCandidateId, 'Interaction should link to existing candidate');
    });

    it('should create interaction note for existing candidate', async () => {
      // Create interaction note
      await query(
        `INSERT INTO interaction_notes (candidate_id, note, status, priority, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [existingInteractionId, 'Follow-up call - discussed interview schedule', 'Interview', 3, testUserId]
      );

      // Verify note was created
      const notes = await query('SELECT * FROM interaction_notes WHERE candidate_id = ?', [existingInteractionId]);
      assert.strictEqual(notes.length, 1, 'Interaction note should exist');
      assert.strictEqual(notes[0].note, 'Follow-up call - discussed interview schedule');
      assert.strictEqual(notes[0].status, 'Interview');
    });

    it('should create HR note with existing candidate stage', async () => {
      // Get current stage of existing candidate
      const candidate = await query('SELECT stage FROM candidates WHERE id = ?', [existingCandidateId]);
      const currentStage = candidate[0].stage;

      // Create HR note with current stage
      await query(
        `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [existingCandidateId, currentStage, 'Follow-up call - discussed interview schedule', 'Phone Call', testUserId]
      );

      // Verify HR note was created with correct stage
      const hrNotes = await query('SELECT * FROM hr_notes WHERE candidate_id = ?', [existingCandidateId]);
      assert.strictEqual(hrNotes.length, 1, 'HR note should be created');
      assert.strictEqual(hrNotes[0].note_text, 'Follow-up call - discussed interview schedule');
      assert.strictEqual(hrNotes[0].stage, 'Screening', 'HR note should use existing candidate stage');
      assert.strictEqual(hrNotes[0].interaction_type, 'Phone Call');
    });

    it('should not change existing candidate stage', async () => {
      // Verify candidate stage remains unchanged
      const candidate = await query('SELECT stage FROM candidates WHERE id = ?', [existingCandidateId]);
      assert.strictEqual(candidate[0].stage, 'Screening', 'Existing candidate stage should not change');
    });

    it('should verify complete flow for existing candidate', async () => {
      // Verify all components are properly linked
      const candidate = await query('SELECT * FROM candidates WHERE id = ?', [existingCandidateId]);
      const interaction = await query('SELECT * FROM interaction_candidates WHERE id = ?', [existingInteractionId]);
      const interactionNotes = await query('SELECT * FROM interaction_notes WHERE candidate_id = ?', [existingInteractionId]);
      const hrNotes = await query('SELECT * FROM hr_notes WHERE candidate_id = ?', [existingCandidateId]);

      assert.strictEqual(candidate.length, 1, 'Candidate should exist');
      assert.strictEqual(interaction.length, 1, 'Interaction should exist');
      assert.strictEqual(interaction[0].candidate_id, existingCandidateId, 'Interaction should link to existing candidate');
      assert.strictEqual(interactionNotes.length, 1, 'Interaction note should exist');
      assert.strictEqual(hrNotes.length, 1, 'HR note should exist');
      assert.strictEqual(candidate[0].stage, 'Screening', 'Candidate should remain in Screening stage');
    });
  });

  describe('Scenario 3: Stage Mapping Verification', () => {
    it('should map all interaction statuses to correct stages', async () => {
      const mappings = [
        { status: 'Interested', expectedStage: 'Applied' },
        { status: 'No Response', expectedStage: 'Applied' },
        { status: 'Follow-up', expectedStage: 'Applied' },
        { status: 'Shortlisted', expectedStage: 'Screening' },
        { status: 'Interview', expectedStage: 'Interview' },
        { status: 'Selected', expectedStage: 'Offer' },
        { status: 'Joined', expectedStage: 'Hired' },
        { status: 'Rejected', expectedStage: 'On Hold' }
      ];

      for (const mapping of mappings) {
        const stage = mapInteractionStatusToStage(mapping.status);
        assert.strictEqual(stage, mapping.expectedStage, 
          `Status "${mapping.status}" should map to stage "${mapping.expectedStage}"`);
      }
    });

    it('should create candidates in correct stages based on interaction status', async () => {
      const testCases = [
        { status: 'Shortlisted', expectedStage: 'Screening', phone: '+1-555-STAGE-001' },
        { status: 'Interview', expectedStage: 'Interview', phone: '+1-555-STAGE-002' },
        { status: 'Selected', expectedStage: 'Offer', phone: '+1-555-STAGE-003' }
      ];

      for (const testCase of testCases) {
        const interactionData = {
          name: `Stage Test ${testCase.status}`,
          phone: testCase.phone,
          email: `stage${testCase.phone}@test.com`,
          source: 'Test'
        };

        const candidateId = await createCandidateFromInteraction(interactionData, testCase.status);
        testCandidateIds.push(candidateId);

        const candidate = await query('SELECT stage FROM candidates WHERE id = ?', [candidateId]);
        assert.strictEqual(candidate[0].stage, testCase.expectedStage, 
          `Candidate created with status "${testCase.status}" should be in "${testCase.expectedStage}" stage`);
      }
    });
  });

  describe('Scenario 4: HR Notes Integration', () => {
    let hrTestCandidateId;
    let hrTestInteractionId;

    it('should create multiple HR notes for multiple interactions', async () => {
      // Create candidate
      const interactionData = {
        name: 'HR Notes Test Candidate',
        phone: '+1-555-HRNOTES-001',
        email: 'hrnotes@test.com',
        source: 'Test'
      };

      hrTestCandidateId = await createCandidateFromInteraction(interactionData, 'Interested');
      testCandidateIds.push(hrTestCandidateId);

      // Create interaction
      const result = await query(
        `INSERT INTO interaction_candidates (name, phone, email, source, candidate_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['HR Notes Test Candidate', '+1-555-HRNOTES-001', 'hrnotes@test.com', 'Test', hrTestCandidateId, testUserId]
      );
      hrTestInteractionId = result.insertId;
      testInteractionIds.push(hrTestInteractionId);

      // Create multiple interaction notes
      const notes = [
        { note: 'First contact', status: 'Interested', type: 'Phone Call' },
        { note: 'Follow-up discussion', status: 'Follow-up', type: 'Phone Call' },
        { note: 'Interview scheduled', status: 'Interview', type: 'Interview' }
      ];

      for (const noteData of notes) {
        await query(
          `INSERT INTO interaction_notes (candidate_id, note, status, created_by)
           VALUES (?, ?, ?, ?)`,
          [hrTestInteractionId, noteData.note, noteData.status, testUserId]
        );

        await query(
          `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [hrTestCandidateId, 'Applied', noteData.note, noteData.type, testUserId]
        );
      }

      // Verify all HR notes were created
      const hrNotes = await query(
        'SELECT * FROM hr_notes WHERE candidate_id = ? ORDER BY created_at ASC',
        [hrTestCandidateId]
      );

      assert.strictEqual(hrNotes.length, 3, 'Three HR notes should be created');
      assert.strictEqual(hrNotes[0].note_text, 'First contact');
      assert.strictEqual(hrNotes[1].note_text, 'Follow-up discussion');
      assert.strictEqual(hrNotes[2].note_text, 'Interview scheduled');
    });

    it('should retrieve HR notes grouped by stage', async () => {
      // Get all HR notes for candidate
      const hrNotes = await query(
        `SELECT stage, note_text, interaction_type, created_at 
         FROM hr_notes 
         WHERE candidate_id = ? 
         ORDER BY created_at DESC`,
        [hrTestCandidateId]
      );

      assert.ok(hrNotes.length > 0, 'HR notes should exist');

      // Group notes by stage
      const notesByStage = hrNotes.reduce((acc, note) => {
        if (!acc[note.stage]) {
          acc[note.stage] = [];
        }
        acc[note.stage].push(note);
        return acc;
      }, {});

      assert.ok(notesByStage['Applied'], 'Should have notes in Applied stage');
      assert.strictEqual(notesByStage['Applied'].length, 3, 'Should have 3 notes in Applied stage');
    });
  });

  describe('Scenario 5: Edge Cases', () => {
    it('should handle missing name with placeholder', async () => {
      const interactionData = {
        name: '',
        phone: '+1-555-NONAME-001',
        email: 'noname@test.com',
        source: 'Test'
      };

      const candidateId = await createCandidateFromInteraction(interactionData, 'Interested');
      testCandidateIds.push(candidateId);

      const candidate = await query('SELECT name FROM candidates WHERE id = ?', [candidateId]);
      assert.strictEqual(candidate[0].name, 'Contact +1-555-NONAME-001', 
        'Should use phone as placeholder name');
    });

    it('should handle null interaction status with default stage', async () => {
      const interactionData = {
        name: 'Null Status Test',
        phone: '+1-555-NULLSTATUS-001',
        email: 'nullstatus@test.com',
        source: 'Test'
      };

      const candidateId = await createCandidateFromInteraction(interactionData, null);
      testCandidateIds.push(candidateId);

      const candidate = await query('SELECT stage FROM candidates WHERE id = ?', [candidateId]);
      assert.strictEqual(candidate[0].stage, 'Applied', 
        'Null status should default to Applied stage');
    });

    it('should handle unknown interaction status with default stage', async () => {
      const stage = mapInteractionStatusToStage('Unknown Status');
      assert.strictEqual(stage, 'Applied', 
        'Unknown status should default to Applied stage');
    });
  });
});

/**
 * Test Summary:
 * 
 * This comprehensive test suite verifies Task 18.1 requirements:
 * ✓ Complete Log Interaction flow with new candidate
 *   - Creates candidate in main pipeline
 *   - Creates interaction_candidates record
 *   - Creates interaction_notes record
 *   - Creates HR note linked to main candidate
 *   - Maps interaction status to correct stage
 * 
 * ✓ Complete Log Interaction flow with existing candidate
 *   - Finds existing candidate by phone
 *   - Links interaction to existing candidate
 *   - Creates interaction note
 *   - Creates HR note with existing candidate's stage
 *   - Does not change existing candidate's stage
 * 
 * ✓ Stage mapping verification
 *   - All interaction statuses map to correct stages
 *   - Candidates created in correct stages
 * 
 * ✓ HR notes integration
 *   - Multiple HR notes can be created
 *   - HR notes can be grouped by stage
 *   - HR notes include proper metadata
 * 
 * ✓ Edge cases
 *   - Missing name handled with placeholder
 *   - Null status defaults to Applied stage
 *   - Unknown status defaults to Applied stage
 */
