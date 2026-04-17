/**
 * Integration Tests for FormSubmissionProcessor
 * Tests end-to-end submission processing with real database
 */

import formSubmissionProcessor from '../services/formSubmissionProcessor.js';
import { query, transaction } from '../config/database.js';

describe('FormSubmissionProcessor - Integration Tests', () => {
  let testFormId;
  let testJobId;

  beforeAll(async () => {
    // Create a test job
    const jobResult = await query(
      `INSERT INTO jobs (title, department, status, created_at) 
       VALUES ('Test Position', 'Engineering', 'active', NOW())`
    );
    testJobId = jobResult.insertId;

    // Create a test form
    const formResult = await query(
      `INSERT INTO forms (name, slug, is_active, access_token, job_id, created_by, created_at) 
       VALUES ('Test Form', 'test-form', 1, 'test-token-12345678', ?, 1, NOW())`,
      [testJobId]
    );
    testFormId = formResult.insertId;

    // Create test form fields
    await query(
      `INSERT INTO form_fields (form_id, label, field_key, field_type, is_required, order_index) 
       VALUES 
       (?, 'Name', 'name', 'text', 1, 1),
       (?, 'Email', 'email', 'email', 1, 2),
       (?, 'Phone', 'phone', 'tel', 1, 3),
       (?, 'Position', 'position', 'text', 1, 4)`,
      [testFormId, testFormId, testFormId, testFormId]
    );
  });

  afterAll(async () => {
    // Clean up test data
    if (testFormId) {
      await query('DELETE FROM form_submissions WHERE form_id = ?', [testFormId]);
      await query('DELETE FROM form_fields WHERE form_id = ?', [testFormId]);
      await query('DELETE FROM forms WHERE id = ?', [testFormId]);
    }
    if (testJobId) {
      await query('DELETE FROM candidates WHERE job_id = ?', [testJobId]);
      await query('DELETE FROM job_postings WHERE id = ?', [testJobId]);
    }
  });

  describe('Complete Submission Flow', () => {
    it('should process a complete submission and create candidate record', async () => {
      const submissionData = {
        name: 'Integration Test User',
        email: 'integration@test.com',
        phone: '1234567890',
        position: 'Software Engineer',
        experience: '5 years',
        expected_ctc: '15 LPA',
        notice_period: '30 days',
        current_ctc: '12 LPA'
      };

      const result = await formSubmissionProcessor.processSubmission(
        testFormId,
        submissionData,
        null,
        '127.0.0.1',
        'Test User Agent'
      );

      expect(result.success).toBe(true);
      expect(result.candidateId).toBeDefined();
      expect(result.submissionId).toBeDefined();

      // Verify candidate was created
      const candidates = await query(
        'SELECT * FROM candidates WHERE id = ?',
        [result.candidateId]
      );
      expect(candidates.length).toBe(1);
      expect(candidates[0].name).toBe('Integration Test User');
      expect(candidates[0].email).toBe('integration@test.com');
      expect(candidates[0].stage).toBe('Applied');
      expect(candidates[0].source).toBe('Form Submission');

      // Verify submission was stored
      const submissions = await query(
        'SELECT * FROM form_submissions WHERE id = ?',
        [result.submissionId]
      );
      expect(submissions.length).toBe(1);
      expect(submissions[0].status).toBe('processed');
      expect(submissions[0].candidate_id).toBe(result.candidateId);

      // Clean up
      await query('DELETE FROM candidates WHERE id = ?', [result.candidateId]);
      await query('DELETE FROM form_submissions WHERE id = ?', [result.submissionId]);
    });

    it('should handle submission with minimal required fields', async () => {
      const submissionData = {
        name: 'Minimal User',
        email: 'minimal@test.com',
        phone: '9876543210',
        position: 'Developer'
      };

      const result = await formSubmissionProcessor.processSubmission(
        testFormId,
        submissionData,
        null,
        '127.0.0.2',
        'Test Agent'
      );

      expect(result.success).toBe(true);
      expect(result.candidateId).toBeDefined();

      // Verify candidate was created with nulls for optional fields
      const candidates = await query(
        'SELECT * FROM candidates WHERE id = ?',
        [result.candidateId]
      );
      expect(candidates.length).toBe(1);
      expect(candidates[0].name).toBe('Minimal User');
      expect(candidates[0].experience).toBeNull();
      expect(candidates[0].salary_expected).toBeNull();

      // Clean up
      await query('DELETE FROM candidates WHERE id = ?', [result.candidateId]);
      await query('DELETE FROM form_submissions WHERE candidate_id = ?', [result.candidateId]);
    });

    it('should store HR remarks in notes field', async () => {
      const submissionData = {
        name: 'Remarks Test User',
        email: 'remarks@test.com',
        phone: '5555555555',
        position: 'Manager',
        hr_remarks: 'Excellent candidate with strong leadership skills'
      };

      const result = await formSubmissionProcessor.processSubmission(
        testFormId,
        submissionData,
        null,
        '127.0.0.3',
        'Test Agent'
      );

      expect(result.success).toBe(true);

      // Verify notes field contains hr_remarks
      const candidates = await query(
        'SELECT * FROM candidates WHERE id = ?',
        [result.candidateId]
      );
      expect(candidates[0].notes).toBe('Excellent candidate with strong leadership skills');

      // Clean up
      await query('DELETE FROM candidates WHERE id = ?', [result.candidateId]);
      await query('DELETE FROM form_submissions WHERE candidate_id = ?', [result.candidateId]);
    });

    it('should rollback on database error', async () => {
      const submissionData = {
        name: 'Rollback Test',
        email: 'rollback@test.com',
        phone: '1111111111',
        position: 'Tester'
      };

      // Use an invalid form ID to trigger error
      const result = await formSubmissionProcessor.processSubmission(
        99999, // Non-existent form ID
        submissionData,
        null,
        '127.0.0.4',
        'Test Agent'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Verify no partial records were created
      const candidates = await query(
        'SELECT * FROM candidates WHERE email = ?',
        ['rollback@test.com']
      );
      expect(candidates.length).toBe(0);
    });
  });

  describe('Transaction Atomicity', () => {
    it('should create both submission and candidate records atomically', async () => {
      const submissionData = {
        name: 'Atomic Test User',
        email: 'atomic@test.com',
        phone: '2222222222',
        position: 'QA Engineer'
      };

      const result = await formSubmissionProcessor.processSubmission(
        testFormId,
        submissionData,
        null,
        '127.0.0.5',
        'Test Agent'
      );

      expect(result.success).toBe(true);

      // Verify both records exist
      const submissions = await query(
        'SELECT * FROM form_submissions WHERE id = ?',
        [result.submissionId]
      );
      const candidates = await query(
        'SELECT * FROM candidates WHERE id = ?',
        [result.candidateId]
      );

      expect(submissions.length).toBe(1);
      expect(candidates.length).toBe(1);
      expect(submissions[0].candidate_id).toBe(result.candidateId);

      // Clean up
      await query('DELETE FROM candidates WHERE id = ?', [result.candidateId]);
      await query('DELETE FROM form_submissions WHERE id = ?', [result.submissionId]);
    });
  });

  describe('Field Mapping', () => {
    it('should correctly map form fields to candidate table columns', async () => {
      const submissionData = {
        name: 'Mapping Test User',
        email: 'mapping@test.com',
        phone: '3333333333',
        position: 'Data Scientist',
        experience: '7 years',
        expected_ctc: '20 LPA',
        expected_salary: '22 LPA', // Alternative field name
        notice_period: '60 days',
        current_ctc: '18 LPA',
        location: 'Bangalore',
        expertise: 'Machine Learning',
        work_preference: 'Hybrid'
      };

      const result = await formSubmissionProcessor.processSubmission(
        testFormId,
        submissionData,
        null,
        '127.0.0.6',
        'Test Agent'
      );

      expect(result.success).toBe(true);

      const candidates = await query(
        'SELECT * FROM candidates WHERE id = ?',
        [result.candidateId]
      );

      const candidate = candidates[0];
      expect(candidate.name).toBe('Mapping Test User');
      expect(candidate.email).toBe('mapping@test.com');
      expect(candidate.phone).toBe('3333333333');
      expect(candidate.position).toBe('Data Scientist');
      expect(candidate.experience).toBe('7 years');
      expect(candidate.salary_expected).toBe('20 LPA'); // expected_ctc takes precedence
      expect(candidate.notice_period).toBe('60 days');
      expect(candidate.current_ctc).toBe('18 LPA');
      expect(candidate.location).toBe('Bangalore');
      expect(candidate.expertise).toBe('Machine Learning');
      expect(candidate.work_preference).toBe('Hybrid');

      // Clean up
      await query('DELETE FROM candidates WHERE id = ?', [result.candidateId]);
      await query('DELETE FROM form_submissions WHERE id = ?', [result.submissionId]);
    });
  });

  describe('Stage and Source Assignment', () => {
    it('should always set stage to Applied and source to Form Submission', async () => {
      const submissionData = {
        name: 'Stage Test User',
        email: 'stage@test.com',
        phone: '4444444444',
        position: 'Designer'
      };

      const result = await formSubmissionProcessor.processSubmission(
        testFormId,
        submissionData,
        null,
        '127.0.0.7',
        'Test Agent'
      );

      expect(result.success).toBe(true);

      const candidates = await query(
        'SELECT * FROM candidates WHERE id = ?',
        [result.candidateId]
      );

      expect(candidates[0].stage).toBe('Applied');
      expect(candidates[0].source).toBe('Form Submission');

      // Clean up
      await query('DELETE FROM candidates WHERE id = ?', [result.candidateId]);
      await query('DELETE FROM form_submissions WHERE id = ?', [result.submissionId]);
    });
  });
});
