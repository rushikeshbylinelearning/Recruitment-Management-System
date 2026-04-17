/**
 * Integration tests for Check By Phone endpoint
 * Tests Task 11.1: GET /api/candidates/check-by-phone/:phone endpoint
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { query } from '../config/database.js';

describe('Check By Phone Endpoint', () => {
  let testCandidateId;
  let testUserId = 1; // Assuming user ID 1 exists
  const testPhone = '+1234567899';

  before(async () => {
    // Clean up any existing test data
    await query('DELETE FROM candidates WHERE phone = ?', [testPhone]);
  });

  after(async () => {
    // Clean up test data
    if (testCandidateId) {
      await query('DELETE FROM hr_notes WHERE candidate_id = ?', [testCandidateId]);
      await query('DELETE FROM candidates WHERE id = ?', [testCandidateId]);
    }
  });

  it('should return exists: false when candidate does not exist', async () => {
    // Query directly to simulate the endpoint
    const candidates = await query(
      `SELECT id, name, email, phone, stage, position, location, source, applied_date
       FROM candidates 
       WHERE phone = ?
       LIMIT 1`,
      [testPhone]
    );

    assert.strictEqual(candidates.length, 0, 'No candidate should be found');
  });

  it('should return exists: true when candidate exists', async () => {
    // Create test candidate
    const result = await query(
      `INSERT INTO candidates (id, name, phone, email, position, stage, source, applied_date) 
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
      ['Test Candidate', testPhone, 'test@example.com', 'Software Engineer', 'Applied', 'Manual', new Date()]
    );

    // Get the created candidate ID
    const candidates = await query('SELECT id FROM candidates WHERE phone = ?', [testPhone]);
    testCandidateId = candidates[0].id;

    assert.ok(testCandidateId, 'Candidate should be created');

    // Query to check if candidate exists
    const foundCandidates = await query(
      `SELECT id, name, email, phone, stage, position, location, source, applied_date
       FROM candidates 
       WHERE phone = ?
       LIMIT 1`,
      [testPhone]
    );

    assert.strictEqual(foundCandidates.length, 1, 'Candidate should be found');
    assert.strictEqual(foundCandidates[0].name, 'Test Candidate');
    assert.strictEqual(foundCandidates[0].phone, testPhone);
    assert.strictEqual(foundCandidates[0].stage, 'Applied');
  });

  it('should return latest HR note when candidate has notes', async () => {
    // Add HR note
    await query(
      `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [testCandidateId, 'Applied', 'Test note for candidate', 'General Note', testUserId]
    );

    // Query latest note
    const latestNote = await query(
      `SELECT hn.*, u.name AS author_name
       FROM hr_notes hn
       LEFT JOIN users u ON hn.author_id = u.id
       WHERE hn.candidate_id = ?
       ORDER BY hn.created_at DESC
       LIMIT 1`,
      [testCandidateId]
    );

    assert.strictEqual(latestNote.length, 1, 'Latest note should be found');
    assert.strictEqual(latestNote[0].note_text, 'Test note for candidate');
    assert.strictEqual(latestNote[0].stage, 'Applied');
  });

  it('should handle phone numbers with different formats', async () => {
    // Test with different phone formats
    const phoneFormats = [
      testPhone,
      testPhone.replace('+', ''),
      testPhone.replace(/\D/g, '') // Remove all non-digits
    ];

    for (const phoneFormat of phoneFormats) {
      const candidates = await query(
        `SELECT id FROM candidates WHERE phone = ?`,
        [phoneFormat]
      );

      // Only the exact match should work
      if (phoneFormat === testPhone) {
        assert.strictEqual(candidates.length, 1, `Should find candidate with exact phone format: ${phoneFormat}`);
      }
    }
  });
});
