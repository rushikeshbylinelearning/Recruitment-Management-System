/**
 * Integration Test: Task 13.1 - Ensure new candidates appear in Applied stage
 * 
 * This test verifies that:
 * 1. Candidates created from interactions appear in the correct stage (Applied)
 * 2. Stage changes work properly via the database
 * 3. Candidates can be retrieved and grouped by stage correctly
 */

import { query } from '../config/database.js';

describe('Task 13.1: Candidates from Interactions - Stage Integration', () => {
  let testCandidateIds = [];
  let testInteractionIds = [];
  const testUserId = 1; // Assuming user ID 1 exists

  beforeAll(async () => {
    // Clean up any existing test data
    await query('DELETE FROM candidates WHERE phone IN (?, ?, ?, ?, ?, ?, ?, ?)', [
      '555-0001', '555-0002', '555-0003', '555-0004', '555-0005', '555-0006', '555-0007', '555-0008'
    ]);
    await query('DELETE FROM interaction_candidates WHERE phone IN (?, ?, ?, ?, ?, ?, ?, ?)', [
      '555-0001', '555-0002', '555-0003', '555-0004', '555-0005', '555-0006', '555-0007', '555-0008'
    ]);
  });

  afterAll(async () => {
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

  test('should create candidate in Applied stage when status is "Interested"', async () => {
    // Create an interaction candidate with "Interested" status
    const interactionResult = await query(
      `INSERT INTO interaction_candidates (name, phone, email, status, source, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      ['John Doe', '555-0001', 'john@example.com', 'Interested', 'Phone Call', testUserId]
    );

    const interactionId = interactionResult.insertId;
    testInteractionIds.push(interactionId);

    // Import integration service
    const { createCandidateFromInteraction, linkInteractionToCandidate } = await import('../services/integrationService.js');

    // Create candidate from interaction
    const candidateId = await createCandidateFromInteraction(
      {
        name: 'John Doe',
        phone: '555-0001',
        email: 'john@example.com',
        source: 'Interaction'
      },
      'Interested'
    );

    testCandidateIds.push(candidateId);

    // Link interaction to candidate
    await linkInteractionToCandidate(interactionId, candidateId);

    // Verify candidate is in Applied stage
    const candidates = await query(
      'SELECT * FROM candidates WHERE id = ?',
      [candidateId]
    );

    expect(candidates.length).toBe(1);
    expect(candidates[0].stage).toBe('Applied');
    expect(candidates[0].name).toBe('John Doe');
    expect(candidates[0].phone).toBe('555-0001');
    expect(candidates[0].source).toBe('Interaction');
  });

  test('should create candidate in Applied stage when status is "No Response"', async () => {
    // Create an interaction candidate with "No Response" status
    const interactionResult = await query(
      `INSERT INTO interaction_candidates (name, phone, email, status, source, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      ['Jane Smith', '555-0002', 'jane@example.com', 'No Response', 'Email', testUserId]
    );

    const interactionId = interactionResult.insertId;
    testInteractionIds.push(interactionId);

    // Import integration service
    const { createCandidateFromInteraction, linkInteractionToCandidate } = await import('../services/integrationService.js');

    // Create candidate from interaction
    const candidateId = await createCandidateFromInteraction(
      {
        name: 'Jane Smith',
        phone: '555-0002',
        email: 'jane@example.com',
        source: 'Interaction'
      },
      'No Response'
    );

    testCandidateIds.push(candidateId);

    // Link interaction to candidate
    await linkInteractionToCandidate(interactionId, candidateId);

    // Verify candidate is in Applied stage
    const candidates = await query(
      'SELECT * FROM candidates WHERE id = ?',
      [candidateId]
    );

    expect(candidates.length).toBe(1);
    expect(candidates[0].stage).toBe('Applied');
  });

  test('should create candidate in Applied stage when status is "Follow-up"', async () => {
    // Create an interaction candidate with "Follow-up" status
    const interactionResult = await query(
      `INSERT INTO interaction_candidates (name, phone, email, status, source, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      ['Bob Wilson', '555-0003', 'bob@example.com', 'Follow-up', 'LinkedIn', testUserId]
    );

    const interactionId = interactionResult.insertId;
    testInteractionIds.push(interactionId);

    // Import integration service
    const { createCandidateFromInteraction, linkInteractionToCandidate } = await import('../services/integrationService.js');

    // Create candidate from interaction
    const candidateId = await createCandidateFromInteraction(
      {
        name: 'Bob Wilson',
        phone: '555-0003',
        email: 'bob@example.com',
        source: 'Interaction'
      },
      'Follow-up'
    );

    testCandidateIds.push(candidateId);

    // Link interaction to candidate
    await linkInteractionToCandidate(interactionId, candidateId);

    // Verify candidate is in Applied stage
    const candidates = await query(
      'SELECT * FROM candidates WHERE id = ?',
      [candidateId]
    );

    expect(candidates.length).toBe(1);
    expect(candidates[0].stage).toBe('Applied');
  });

  test('should retrieve candidates grouped by stage including Applied', async () => {
    // Create multiple candidates in different stages
    const candidate1 = await query(
      `INSERT INTO candidates (name, email, phone, position, stage, source, applied_date)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      ['Alice Johnson', 'alice@example.com', '555-0004', 'Developer', 'Applied', 'Interaction']
    );
    testCandidateIds.push(candidate1.insertId);

    const candidate2 = await query(
      `INSERT INTO candidates (name, email, phone, position, stage, source, applied_date)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      ['Carol Davis', 'carol@example.com', '555-0005', 'Designer', 'Applied', 'Interaction']
    );
    testCandidateIds.push(candidate2.insertId);

    const candidate3 = await query(
      `INSERT INTO candidates (name, email, phone, position, stage, source, applied_date)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      ['David Lee', 'david@example.com', '555-0006', 'Manager', 'Screening', 'LinkedIn']
    );
    testCandidateIds.push(candidate3.insertId);

    // Get all candidates
    const allCandidates = await query('SELECT * FROM candidates WHERE phone IN (?, ?, ?)', [
      '555-0004', '555-0005', '555-0006'
    ]);

    // Filter candidates by stage
    const appliedCandidates = allCandidates.filter(c => c.stage === 'Applied');
    const screeningCandidates = allCandidates.filter(c => c.stage === 'Screening');

    // Verify Applied stage has 2 candidates
    expect(appliedCandidates.length).toBe(2);

    // Verify Screening stage has 1 candidate
    expect(screeningCandidates.length).toBe(1);
  });

  test('should update candidate stage from Applied to Screening', async () => {
    // Create a candidate in Applied stage
    const candidateResult = await query(
      `INSERT INTO candidates (name, email, phone, position, stage, source, applied_date)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      ['Emma Thompson', 'emma@example.com', '555-0007', 'UX Designer', 'Applied', 'Interaction']
    );

    const candidateId = candidateResult.insertId;
    testCandidateIds.push(candidateId);

    // Update stage to Screening
    await query(
      'UPDATE candidates SET stage = ? WHERE id = ?',
      ['Screening', candidateId]
    );

    // Create HR note for stage change
    await query(
      `INSERT INTO hr_notes (candidate_id, note_text, note_type, stage, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [candidateId, 'Stage changed from Applied to Screening', 'stage_change', 'Screening', testUserId]
    );

    // Verify stage was updated
    const candidates = await query(
      'SELECT * FROM candidates WHERE id = ?',
      [candidateId]
    );

    expect(candidates.length).toBe(1);
    expect(candidates[0].stage).toBe('Screening');

    // Verify HR note was created for stage change
    const hrNotes = await query(
      'SELECT * FROM hr_notes WHERE candidate_id = ? AND note_type = ?',
      [candidateId, 'stage_change']
    );

    expect(hrNotes.length).toBeGreaterThan(0);
  });

  test('should handle existing candidate when adding from interaction', async () => {
    // Create a candidate directly
    const candidateResult = await query(
      `INSERT INTO candidates (name, email, phone, position, stage, source, applied_date)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      ['Frank Miller', 'frank@example.com', '555-0008', 'Engineer', 'Applied', 'Direct']
    );

    const candidateId = candidateResult.insertId;
    testCandidateIds.push(candidateId);

    // Create an interaction with the same phone number
    const interactionResult = await query(
      `INSERT INTO interaction_candidates (name, phone, email, status, source, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      ['Frank Miller', '555-0008', 'frank@example.com', 'Interested', 'Phone Call', testUserId]
    );

    const interactionId = interactionResult.insertId;
    testInteractionIds.push(interactionId);

    // Import integration service
    const { findCandidateByPhone, linkInteractionToCandidate } = await import('../services/integrationService.js');

    // Find existing candidate
    const existingCandidate = await findCandidateByPhone('555-0008');
    expect(existingCandidate).toBeTruthy();
    expect(existingCandidate.id).toBe(candidateId);

    // Link interaction to existing candidate
    await linkInteractionToCandidate(interactionId, candidateId);

    // Verify interaction is linked to existing candidate
    const interactions = await query(
      'SELECT * FROM interaction_candidates WHERE id = ?',
      [interactionId]
    );

    expect(interactions.length).toBe(1);
    expect(interactions[0].candidate_id).toBe(candidateId);
  });
});

/**
 * Test Summary:
 * 
 * This test suite verifies Task 13.1 requirements at the database/service level:
 * ✓ Candidates created from interactions with "Interested" status appear in Applied stage
 * ✓ Candidates created from interactions with "No Response" status appear in Applied stage
 * ✓ Candidates created from interactions with "Follow-up" status appear in Applied stage
 * ✓ Candidates can be retrieved and grouped by stage
 * ✓ Stage changes work properly (simulating drag-and-drop via database updates)
 * ✓ Existing candidates are properly linked when adding from interactions
 * 
 * These tests verify the backend integration that supports the Kanban board
 * functionality described in Task 13.1.
 */
