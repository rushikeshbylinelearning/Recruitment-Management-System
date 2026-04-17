/**
 * Unit tests for Task 17.2: Handle missing data gracefully
 * Tests edge cases for missing names, email/phone combinations, and interactions without candidate links
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { query } from '../config/database.js';
import { createCandidateFromInteraction } from '../services/integrationService.js';

describe('Task 17.2: Missing Data Handling', () => {
  let testCandidateIds = [];
  let testInteractionIds = [];
  const testUserId = 1;

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

  describe('Handle missing names with placeholder', () => {
    it('should create candidate with phone-based placeholder when name is missing', async () => {
      const candidateId = await createCandidateFromInteraction(
        {
          name: '',
          phone: '+1111111111',
          email: 'test1@example.com',
          source: 'Manual'
        },
        'Interested',
        true
      );

      testCandidateIds.push(candidateId);

      const candidates = await query('SELECT * FROM candidates WHERE id = ?', [candidateId]);
      assert.strictEqual(candidates.length, 1);
      assert.strictEqual(candidates[0].name, 'Contact +1111111111');
      assert.strictEqual(candidates[0].phone, '+1111111111');
    });

    it('should create candidate with email-based placeholder when name and phone are missing', async () => {
      const candidateId = await createCandidateFromInteraction(
        {
          name: null,
          phone: null,
          email: 'test2@example.com',
          source: 'Manual'
        },
        'Interested',
        true
      );

      testCandidateIds.push(candidateId);

      const candidates = await query('SELECT * FROM candidates WHERE id = ?', [candidateId]);
      assert.strictEqual(candidates.length, 1);
      assert.strictEqual(candidates[0].name, 'Contact test2@example.com');
      assert.strictEqual(candidates[0].email, 'test2@example.com');
    });

    it('should use provided name when available', async () => {
      const candidateId = await createCandidateFromInteraction(
        {
          name: 'John Doe',
          phone: '+1222222222',
          email: 'john@example.com',
          source: 'Manual'
        },
        'Interested',
        true
      );

      testCandidateIds.push(candidateId);

      const candidates = await query('SELECT * FROM candidates WHERE id = ?', [candidateId]);
      assert.strictEqual(candidates.length, 1);
      assert.strictEqual(candidates[0].name, 'John Doe');
    });

    it('should trim whitespace from name', async () => {
      const candidateId = await createCandidateFromInteraction(
        {
          name: '  Jane Smith  ',
          phone: '+1333333333',
          email: 'jane@example.com',
          source: 'Manual'
        },
        'Interested',
        true
      );

      testCandidateIds.push(candidateId);

      const candidates = await query('SELECT * FROM candidates WHERE id = ?', [candidateId]);
      assert.strictEqual(candidates.length, 1);
      assert.strictEqual(candidates[0].name, 'Jane Smith');
    });
  });

  describe('Handle missing email/phone combinations', () => {
    it('should create candidate with phone only (no email)', async () => {
      const candidateId = await createCandidateFromInteraction(
        {
          name: 'Phone Only User',
          phone: '+1444444444',
          email: null,
          source: 'Manual'
        },
        'Interested',
        true
      );

      testCandidateIds.push(candidateId);

      const candidates = await query('SELECT * FROM candidates WHERE id = ?', [candidateId]);
      assert.strictEqual(candidates.length, 1);
      assert.strictEqual(candidates[0].name, 'Phone Only User');
      assert.strictEqual(candidates[0].phone, '+1444444444');
      assert.strictEqual(candidates[0].email, null);
    });

    it('should create candidate with email only (no phone)', async () => {
      const candidateId = await createCandidateFromInteraction(
        {
          name: 'Email Only User',
          phone: null,
          email: 'emailonly@example.com',
          source: 'Manual'
        },
        'Interested',
        true
      );

      testCandidateIds.push(candidateId);

      const candidates = await query('SELECT * FROM candidates WHERE id = ?', [candidateId]);
      assert.strictEqual(candidates.length, 1);
      assert.strictEqual(candidates[0].name, 'Email Only User');
      assert.strictEqual(candidates[0].phone, null);
      assert.strictEqual(candidates[0].email, 'emailonly@example.com');
    });

    it('should throw error when both phone and email are missing', async () => {
      await assert.rejects(
        async () => {
          await createCandidateFromInteraction(
            {
              name: 'No Contact User',
              phone: null,
              email: null,
              source: 'Manual'
            },
            'Interested',
            true
          );
        },
        {
          message: 'At least one contact method (phone or email) is required',
          code: 'MISSING_CONTACT_INFO'
        }
      );
    });

    it('should throw error when both phone and email are empty strings', async () => {
      await assert.rejects(
        async () => {
          await createCandidateFromInteraction(
            {
              name: 'Empty Contact User',
              phone: '',
              email: '',
              source: 'Manual'
            },
            'Interested',
            true
          );
        },
        {
          message: 'At least one contact method (phone or email) is required',
          code: 'MISSING_CONTACT_INFO'
        }
      );
    });
  });

  describe('Allow interactions without immediate candidate link', () => {
    it('should create interaction without candidate_id', async () => {
      const result = await query(
        `INSERT INTO interaction_candidates (name, phone, email, source, candidate_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['Unlinked Contact', '+1555555555', 'unlinked@example.com', 'Manual', null, testUserId]
      );

      const interactionId = result.insertId;
      testInteractionIds.push(interactionId);

      const interactions = await query(
        'SELECT * FROM interaction_candidates WHERE id = ?',
        [interactionId]
      );

      assert.strictEqual(interactions.length, 1);
      assert.strictEqual(interactions[0].name, 'Unlinked Contact');
      assert.strictEqual(interactions[0].candidate_id, null);
    });

    it('should allow adding notes to unlinked interaction', async () => {
      const result = await query(
        `INSERT INTO interaction_candidates (name, phone, email, source, candidate_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['Another Unlinked', '+1666666666', 'another@example.com', 'Manual', null, testUserId]
      );

      const interactionId = result.insertId;
      testInteractionIds.push(interactionId);

      await query(
        `INSERT INTO interaction_notes (candidate_id, note, status, created_by)
         VALUES (?, ?, ?, ?)`,
        [interactionId, 'Test note for unlinked interaction', 'Follow-up', testUserId]
      );

      const notes = await query(
        'SELECT * FROM interaction_notes WHERE candidate_id = ?',
        [interactionId]
      );

      assert.strictEqual(notes.length, 1);
      assert.strictEqual(notes[0].note, 'Test note for unlinked interaction');
    });

    it('should allow linking interaction to candidate later', async () => {
      // Create unlinked interaction
      const interactionResult = await query(
        `INSERT INTO interaction_candidates (name, phone, email, source, candidate_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['Later Linked', '+1777777777', 'later@example.com', 'Manual', null, testUserId]
      );

      const interactionId = interactionResult.insertId;
      testInteractionIds.push(interactionId);

      // Create candidate
      const candidateId = await createCandidateFromInteraction(
        {
          name: 'Later Linked',
          phone: '+1777777777',
          email: 'later@example.com',
          source: 'Manual'
        },
        'Interested',
        true
      );

      testCandidateIds.push(candidateId);

      // Link interaction to candidate
      await query(
        'UPDATE interaction_candidates SET candidate_id = ? WHERE id = ?',
        [candidateId, interactionId]
      );

      // Verify link
      const interactions = await query(
        'SELECT * FROM interaction_candidates WHERE id = ?',
        [interactionId]
      );

      assert.strictEqual(interactions.length, 1);
      assert.strictEqual(interactions[0].candidate_id, candidateId);
    });
  });

  describe('Edge cases with whitespace and empty values', () => {
    it('should treat whitespace-only name as missing', async () => {
      const candidateId = await createCandidateFromInteraction(
        {
          name: '   ',
          phone: '+1888888888',
          email: 'whitespace@example.com',
          source: 'Manual'
        },
        'Interested',
        true
      );

      testCandidateIds.push(candidateId);

      const candidates = await query('SELECT * FROM candidates WHERE id = ?', [candidateId]);
      assert.strictEqual(candidates.length, 1);
      assert.strictEqual(candidates[0].name, 'Contact +1888888888');
    });

    it('should handle undefined name', async () => {
      const candidateId = await createCandidateFromInteraction(
        {
          name: undefined,
          phone: '+1999999999',
          email: 'undefined@example.com',
          source: 'Manual'
        },
        'Interested',
        true
      );

      testCandidateIds.push(candidateId);

      const candidates = await query('SELECT * FROM candidates WHERE id = ?', [candidateId]);
      assert.strictEqual(candidates.length, 1);
      assert.strictEqual(candidates[0].name, 'Contact +1999999999');
    });

    it('should handle missing source with default', async () => {
      const candidateId = await createCandidateFromInteraction(
        {
          name: 'No Source User',
          phone: '+1000000000',
          email: 'nosource@example.com',
          source: null
        },
        'Interested',
        true
      );

      testCandidateIds.push(candidateId);

      const candidates = await query('SELECT * FROM candidates WHERE id = ?', [candidateId]);
      assert.strictEqual(candidates.length, 1);
      assert.strictEqual(candidates[0].source, 'Manual');
    });
  });
});
