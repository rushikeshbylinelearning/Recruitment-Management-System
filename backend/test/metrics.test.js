import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

describe('Dashboard Metrics Tests', () => {
  const testCandidateIds = [];

  after(async () => {
    // Cleanup test data
    if (testCandidateIds.length > 0) {
      await query(
        `DELETE FROM hr_notes WHERE candidate_id IN (${testCandidateIds.map(() => '?').join(',')})`,
        testCandidateIds
      );
      await query(
        `DELETE FROM candidates WHERE id IN (${testCandidateIds.map(() => '?').join(',')})`,
        testCandidateIds
      );
    }
  });

  describe('Profile Not Found Metric', () => {
    it('should count candidates with missing email', async () => {
      const candidateId = uuidv4();
      testCandidateIds.push(candidateId);

      await query(
        `INSERT INTO candidates (id, name, phone, position, stage, source, applied_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [candidateId, 'Test Candidate No Email', '1234567890', 'Developer', 'Applied', 'Manual']
      );

      const result = await query(`
        SELECT COUNT(*) as count 
        FROM candidates 
        WHERE DATE(created_at) = CURDATE()
        AND (email IS NULL OR email = '')
      `);

      assert.ok(result[0].count >= 1, 'Should count candidate with missing email');
    });

    it('should count candidates with missing phone', async () => {
      const candidateId = uuidv4();
      testCandidateIds.push(candidateId);

      await query(
        `INSERT INTO candidates (id, name, email, position, stage, source, applied_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [candidateId, 'Test Candidate No Phone', 'test@example.com', 'Developer', 'Applied', 'Manual']
      );

      const result = await query(`
        SELECT COUNT(*) as count 
        FROM candidates 
        WHERE DATE(created_at) = CURDATE()
        AND (phone IS NULL OR phone = '')
      `);

      assert.ok(result[0].count >= 1, 'Should count candidate with missing phone');
    });

    it('should count candidates with both email and phone missing', async () => {
      const candidateId = uuidv4();
      testCandidateIds.push(candidateId);

      await query(
        `INSERT INTO candidates (id, name, position, stage, source, applied_date, created_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [candidateId, 'Test Candidate No Contact', 'Developer', 'Applied', 'Manual']
      );

      const result = await query(`
        SELECT COUNT(*) as count 
        FROM candidates 
        WHERE DATE(created_at) = CURDATE()
        AND (
          email IS NULL OR email = '' OR
          phone IS NULL OR phone = '' OR
          (email IS NULL OR email = '') AND (phone IS NULL OR phone = '')
        )
      `);

      assert.ok(result[0].count >= 1, 'Should count candidate with no contact info');
    });
  });

  describe('Follow Ups Metric', () => {
    it('should count candidates in On Hold stage', async () => {
      const candidateId = uuidv4();
      testCandidateIds.push(candidateId);

      await query(
        `INSERT INTO candidates (id, name, email, phone, position, stage, source, applied_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [candidateId, 'Test On Hold', 'onhold@test.com', '1111111111', 'Developer', 'On Hold', 'Manual']
      );

      const result = await query(`
        SELECT COUNT(DISTINCT c.id) as count
        FROM candidates c
        WHERE DATE(c.created_at) = CURDATE()
        AND c.stage = 'On Hold'
      `);

      assert.ok(result[0].count >= 1, 'Should count candidate in On Hold stage');
    });

    it('should count candidates in Screening stage', async () => {
      const candidateId = uuidv4();
      testCandidateIds.push(candidateId);

      await query(
        `INSERT INTO candidates (id, name, email, phone, position, stage, source, applied_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [candidateId, 'Test Screening', 'screening@test.com', '2222222222', 'Developer', 'Screening', 'Manual']
      );

      const result = await query(`
        SELECT COUNT(DISTINCT c.id) as count
        FROM candidates c
        WHERE DATE(c.created_at) = CURDATE()
        AND c.stage = 'Screening'
      `);

      assert.ok(result[0].count >= 1, 'Should count candidate in Screening stage');
    });

    it('should count candidates with follow-up notes', async () => {
      const candidateId = uuidv4();
      testCandidateIds.push(candidateId);

      await query(
        `INSERT INTO candidates (id, name, email, phone, position, stage, source, applied_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [candidateId, 'Test Follow Up Note', 'followup@test.com', '3333333333', 'Developer', 'Applied', 'Manual']
      );

      await query(
        `INSERT INTO hr_notes (candidate_id, note_text, interaction_type, stage, author_id, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [candidateId, 'Need to follow up with this candidate next week', 'General Note', 'Applied', 1]
      );

      const result = await query(`
        SELECT COUNT(DISTINCT c.id) as count
        FROM candidates c
        LEFT JOIN hr_notes hn ON c.id = hn.candidate_id
        WHERE DATE(c.created_at) = CURDATE()
        AND (hn.note_text LIKE '%follow up%' OR hn.note_text LIKE '%follow-up%')
      `);

      assert.ok(result[0].count >= 1, 'Should count candidate with follow-up note');
    });

    it('should count candidates with callback notes', async () => {
      const candidateId = uuidv4();
      testCandidateIds.push(candidateId);

      await query(
        `INSERT INTO candidates (id, name, email, phone, position, stage, source, applied_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [candidateId, 'Test Callback', 'callback@test.com', '4444444444', 'Developer', 'Applied', 'Manual']
      );

      await query(
        `INSERT INTO hr_notes (candidate_id, note_text, interaction_type, stage, author_id, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [candidateId, 'Candidate requested a callback tomorrow', 'General Note', 'Applied', 1]
      );

      const result = await query(`
        SELECT COUNT(DISTINCT c.id) as count
        FROM candidates c
        LEFT JOIN hr_notes hn ON c.id = hn.candidate_id
        WHERE DATE(c.created_at) = CURDATE()
        AND (hn.note_text LIKE '%callback%' OR hn.note_text LIKE '%call back%')
      `);

      assert.ok(result[0].count >= 1, 'Should count candidate with callback note');
    });

    it('should not double-count candidates with multiple follow-up notes', async () => {
      const candidateId = uuidv4();
      testCandidateIds.push(candidateId);

      await query(
        `INSERT INTO candidates (id, name, email, phone, position, stage, source, applied_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [candidateId, 'Test Multiple Notes', 'multiple@test.com', '5555555555', 'Developer', 'Applied', 'Manual']
      );

      await query(
        `INSERT INTO hr_notes (candidate_id, note_text, interaction_type, stage, author_id, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [candidateId, 'First follow up note', 'General Note', 'Applied', 1]
      );

      await query(
        `INSERT INTO hr_notes (candidate_id, note_text, interaction_type, stage, author_id, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [candidateId, 'Second follow up note', 'General Note', 'Applied', 1]
      );

      const result = await query(`
        SELECT COUNT(DISTINCT c.id) as count
        FROM candidates c
        LEFT JOIN hr_notes hn ON c.id = hn.candidate_id
        WHERE c.id = ?
        AND (hn.note_text LIKE '%follow up%')
      `, [candidateId]);

      assert.strictEqual(result[0].count, 1, 'Should count candidate only once despite multiple notes');
    });
  });

  describe('Combined Metrics Query', () => {
    it('should return all metrics for today', async () => {
      const result = await query(`
        SELECT 
          (SELECT COUNT(*) FROM candidates WHERE DATE(created_at) = CURDATE()) as total,
          (SELECT COUNT(*) FROM candidates 
           WHERE DATE(created_at) = CURDATE()
           AND (email IS NULL OR email = '' OR phone IS NULL OR phone = '')) as profileNotFound,
          (SELECT COUNT(DISTINCT c.id) FROM candidates c
           LEFT JOIN hr_notes hn ON c.id = hn.candidate_id
           WHERE DATE(c.created_at) = CURDATE()
           AND (c.stage = 'On Hold' OR 
                hn.note_text LIKE '%follow up%' OR hn.note_text LIKE '%callback%')) as followUps
      `);

      assert.ok(result.length === 1, 'Should return one row');
      assert.ok(typeof result[0].total === 'number', 'Total should be a number');
      assert.ok(typeof result[0].profileNotFound === 'number', 'Profile not found should be a number');
      assert.ok(typeof result[0].followUps === 'number', 'Follow ups should be a number');
    });
  });
});
