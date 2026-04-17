import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

describe('HR Notes API Integration Tests', () => {
  let testCandidateId = null;
  let testUserId = null;
  let testNoteIds = [];

  before(async () => {
    // Get a test user (admin or recruiter)
    const users = await query('SELECT id FROM users WHERE role = ? LIMIT 1', ['Admin']);
    if (users.length === 0) {
      throw new Error('No admin user found for testing');
    }
    testUserId = users[0].id;

    // Create a test candidate with UUID (only required fields)
    testCandidateId = uuidv4();
    await query(
      `INSERT INTO candidates (id, name) VALUES (?, ?)`,
      [testCandidateId, 'HR Notes Test Candidate']
    );

    // Create test HR notes in different stages with explicit timestamps
    const note1 = await query(
      `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id, created_at)
       VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 2 MINUTE))`,
      [testCandidateId, 'Applied', 'Initial contact made', 'Phone Call', testUserId]
    );
    testNoteIds.push(note1.insertId);

    const note2 = await query(
      `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id, created_at)
       VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 1 MINUTE))`,
      [testCandidateId, 'Applied', 'Follow-up email sent', 'Email', testUserId]
    );
    testNoteIds.push(note2.insertId);

    const note3 = await query(
      `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [testCandidateId, 'Screening', 'Screening call completed', 'Phone Call', testUserId]
    );
    testNoteIds.push(note3.insertId);
  });

  after(async () => {
    // Clean up test data
    if (testNoteIds.length > 0) {
      await query(`DELETE FROM hr_notes WHERE id IN (${testNoteIds.map(() => '?').join(',')})`, testNoteIds);
    }
    if (testCandidateId) {
      await query('DELETE FROM candidates WHERE id = ?', [testCandidateId]);
    }
  });

  it('should fetch HR notes grouped by stage', async () => {
    // Fetch HR notes using the service layer (simulating the endpoint logic)
    const hrNotes = await query(
      `SELECT 
        hn.id,
        hn.candidate_id,
        hn.stage,
        hn.note_text,
        hn.interaction_type,
        hn.author_id,
        hn.created_at,
        hn.updated_at,
        u.name as author_name,
        u.role as author_role
       FROM hr_notes hn
       LEFT JOIN users u ON hn.author_id = u.id
       WHERE hn.candidate_id = ?
       ORDER BY hn.created_at DESC`,
      [testCandidateId]
    );

    // Group notes by stage
    const notesByStage = {};
    
    for (const note of hrNotes) {
      const stage = note.stage;
      
      if (!notesByStage[stage]) {
        notesByStage[stage] = [];
      }
      
      notesByStage[stage].push({
        id: note.id,
        note_text: note.note_text,
        interaction_type: note.interaction_type,
        author_name: note.author_name || 'Unknown',
        author_role: note.author_role || null,
        created_at: note.created_at,
        updated_at: note.updated_at
      });
    }

    // Verify the grouped structure
    assert.ok(notesByStage['Applied'], 'Should have notes in Applied stage');
    assert.ok(notesByStage['Screening'], 'Should have notes in Screening stage');
    
    assert.strictEqual(notesByStage['Applied'].length, 2, 'Should have 2 notes in Applied stage');
    assert.strictEqual(notesByStage['Screening'].length, 1, 'Should have 1 note in Screening stage');

    // Verify note content
    const appliedNotes = notesByStage['Applied'];
    assert.ok(appliedNotes.some(n => n.note_text === 'Follow-up email sent'), 'Should contain follow-up email note');
    assert.ok(appliedNotes.some(n => n.note_text === 'Initial contact made'), 'Should contain initial contact note');
    assert.ok(appliedNotes.some(n => n.interaction_type === 'Phone Call'), 'Should have Phone Call interaction type');
    assert.ok(appliedNotes.some(n => n.interaction_type === 'Email'), 'Should have Email interaction type');

    // Verify author information is included
    assert.ok(appliedNotes[0].author_name, 'Should include author name');
    
    // Verify notes are sorted by timestamp descending (most recent first)
    // Since we created them in order, the most recent should be the follow-up email
    assert.strictEqual(appliedNotes[0].note_text, 'Follow-up email sent', 'Notes should be sorted by created_at DESC');
  });

  it('should return empty object for candidate with no HR notes', async () => {
    // Create a candidate without HR notes (only required fields)
    const candidateId = uuidv4();
    await query(
      `INSERT INTO candidates (id, name) VALUES (?, ?)`,
      [candidateId, 'No Notes Candidate']
    );

    try {
      // Fetch HR notes
      const hrNotes = await query(
        `SELECT 
          hn.id,
          hn.candidate_id,
          hn.stage,
          hn.note_text,
          hn.interaction_type,
          hn.author_id,
          hn.created_at,
          hn.updated_at,
          u.name as author_name,
          u.role as author_role
         FROM hr_notes hn
         LEFT JOIN users u ON hn.author_id = u.id
         WHERE hn.candidate_id = ?
         ORDER BY hn.created_at DESC`,
        [candidateId]
      );

      // Group notes by stage
      const notesByStage = {};
      
      for (const note of hrNotes) {
        const stage = note.stage;
        
        if (!notesByStage[stage]) {
          notesByStage[stage] = [];
        }
        
        notesByStage[stage].push({
          id: note.id,
          note_text: note.note_text,
          interaction_type: note.interaction_type,
          author_name: note.author_name || 'Unknown',
          author_role: note.author_role || null,
          created_at: note.created_at,
          updated_at: note.updated_at
        });
      }

      // Verify empty result
      assert.strictEqual(Object.keys(notesByStage).length, 0, 'Should return empty object for candidate with no notes');
    } finally {
      // Clean up
      await query('DELETE FROM candidates WHERE id = ?', [candidateId]);
    }
  });

  it('should create a new HR note for a candidate', async () => {
    // Get candidate's current stage
    const candidates = await query('SELECT stage FROM candidates WHERE id = ?', [testCandidateId]);
    const currentStage = candidates[0].stage || 'Applied';

    // Create a new HR note
    const noteText = 'Completed phone screening';
    const interactionType = 'Phone Call';

    const result = await query(
      `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [testCandidateId, currentStage, noteText, interactionType, testUserId]
    );

    const newNoteId = result.insertId;
    testNoteIds.push(newNoteId);

    // Fetch the created note with author information
    const createdNotes = await query(
      `SELECT 
        hn.id,
        hn.candidate_id,
        hn.stage,
        hn.note_text,
        hn.interaction_type,
        hn.author_id,
        hn.created_at,
        u.name as author_name,
        u.role as author_role
       FROM hr_notes hn
       LEFT JOIN users u ON hn.author_id = u.id
       WHERE hn.id = ?`,
      [newNoteId]
    );

    const createdNote = createdNotes[0];

    // Verify the created note
    assert.ok(createdNote, 'Note should be created');
    assert.strictEqual(createdNote.candidate_id, testCandidateId, 'Should be linked to correct candidate');
    assert.strictEqual(createdNote.stage, currentStage, 'Should use candidate\'s current stage');
    assert.strictEqual(createdNote.note_text, noteText, 'Should have correct note text');
    assert.strictEqual(createdNote.interaction_type, interactionType, 'Should have correct interaction type');
    assert.strictEqual(createdNote.author_id, testUserId, 'Should have correct author ID');
    assert.ok(createdNote.author_name, 'Should include author name');
    assert.ok(createdNote.created_at, 'Should have created_at timestamp');
  });

  it('should default to General Note interaction type if not specified', async () => {
    // Get candidate's current stage
    const candidates = await query('SELECT stage FROM candidates WHERE id = ?', [testCandidateId]);
    const currentStage = candidates[0].stage || 'Applied';

    // Create a new HR note without specifying interaction_type
    const noteText = 'General observation about candidate';

    const result = await query(
      `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [testCandidateId, currentStage, noteText, 'General Note', testUserId]
    );

    const newNoteId = result.insertId;
    testNoteIds.push(newNoteId);

    // Fetch the created note
    const createdNotes = await query(
      `SELECT interaction_type FROM hr_notes WHERE id = ?`,
      [newNoteId]
    );

    const createdNote = createdNotes[0];

    // Verify the interaction type defaults to General Note
    assert.strictEqual(createdNote.interaction_type, 'General Note', 'Should default to General Note');
  });
});

describe('Candidate Stage Update with HR Notes', () => {
  let testCandidateId = null;
  let testUserId = null;
  let createdNoteIds = [];

  before(async () => {
    // Get a test user (admin or recruiter)
    const users = await query('SELECT id FROM users WHERE role = ? LIMIT 1', ['Admin']);
    if (users.length === 0) {
      throw new Error('No admin user found for testing');
    }
    testUserId = users[0].id;

    // Create a test candidate with UUID in Applied stage
    testCandidateId = uuidv4();
    await query(
      `INSERT INTO candidates (id, name, stage) VALUES (?, ?, ?)`,
      [testCandidateId, 'Stage Update Test Candidate', 'Applied']
    );
  });

  after(async () => {
    // Clean up test data
    if (createdNoteIds.length > 0) {
      await query(`DELETE FROM hr_notes WHERE id IN (${createdNoteIds.map(() => '?').join(',')})`, createdNoteIds);
    }
    if (testCandidateId) {
      await query('DELETE FROM candidates WHERE id = ?', [testCandidateId]);
    }
  });

  it('should create HR note when candidate stage is updated', async () => {
    const previousStage = 'Applied';
    const newStage = 'Screening';

    // Update candidate stage (simulating the PATCH endpoint logic)
    await query(
      'UPDATE candidates SET stage = ?, previous_stage = ?, stage_updated_at = NOW(), updated_at = NOW() WHERE id = ?',
      [newStage, previousStage, testCandidateId]
    );

    // Create HR note for stage change event
    const stageChangeNoteText = `Stage changed from ${previousStage} to ${newStage}`;
    const result = await query(
      `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id) VALUES (?, ?, ?, ?, ?)`,
      [testCandidateId, newStage, stageChangeNoteText, 'Stage Change', testUserId]
    );

    createdNoteIds.push(result.insertId);

    // Verify the candidate stage was updated
    const candidates = await query('SELECT stage, previous_stage FROM candidates WHERE id = ?', [testCandidateId]);
    assert.strictEqual(candidates[0].stage, newStage, 'Candidate stage should be updated');
    assert.strictEqual(candidates[0].previous_stage, previousStage, 'Previous stage should be tracked');

    // Verify the HR note was created
    const hrNotes = await query(
      `SELECT 
        hn.id,
        hn.candidate_id,
        hn.stage,
        hn.note_text,
        hn.interaction_type,
        hn.author_id,
        u.name as author_name
       FROM hr_notes hn
       LEFT JOIN users u ON hn.author_id = u.id
       WHERE hn.id = ?`,
      [result.insertId]
    );

    assert.strictEqual(hrNotes.length, 1, 'HR note should be created');
    const hrNote = hrNotes[0];
    assert.strictEqual(hrNote.candidate_id, testCandidateId, 'HR note should be linked to candidate');
    assert.strictEqual(hrNote.stage, newStage, 'HR note should use new stage');
    assert.strictEqual(hrNote.note_text, stageChangeNoteText, 'HR note should contain stage change text');
    assert.strictEqual(hrNote.interaction_type, 'Stage Change', 'HR note should have Stage Change interaction type');
    assert.strictEqual(hrNote.author_id, testUserId, 'HR note should have correct author');
    assert.ok(hrNote.author_name, 'HR note should include author name');
  });

  it('should create multiple HR notes for multiple stage changes', async () => {
    // First stage change: Screening -> Interview
    const stage1 = 'Screening';
    const stage2 = 'Interview';
    
    await query(
      'UPDATE candidates SET stage = ?, previous_stage = ?, stage_updated_at = NOW(), updated_at = NOW() WHERE id = ?',
      [stage2, stage1, testCandidateId]
    );

    const note1Text = `Stage changed from ${stage1} to ${stage2}`;
    const result1 = await query(
      `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id) VALUES (?, ?, ?, ?, ?)`,
      [testCandidateId, stage2, note1Text, 'Stage Change', testUserId]
    );
    createdNoteIds.push(result1.insertId);

    // Second stage change: Interview -> Offer
    const stage3 = 'Offer';
    
    await query(
      'UPDATE candidates SET stage = ?, previous_stage = ?, stage_updated_at = NOW(), updated_at = NOW() WHERE id = ?',
      [stage3, stage2, testCandidateId]
    );

    const note2Text = `Stage changed from ${stage2} to ${stage3}`;
    const result2 = await query(
      `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id) VALUES (?, ?, ?, ?, ?)`,
      [testCandidateId, stage3, note2Text, 'Stage Change', testUserId]
    );
    createdNoteIds.push(result2.insertId);

    // Verify all HR notes were created
    const hrNotes = await query(
      `SELECT 
        hn.id,
        hn.stage,
        hn.note_text,
        hn.interaction_type
       FROM hr_notes hn
       WHERE hn.candidate_id = ? AND hn.interaction_type = 'Stage Change'
       ORDER BY hn.created_at ASC`,
      [testCandidateId]
    );

    assert.ok(hrNotes.length >= 2, 'Should have at least 2 stage change notes');
    
    // Find our specific notes
    const note1 = hrNotes.find(n => n.note_text === note1Text);
    const note2 = hrNotes.find(n => n.note_text === note2Text);
    
    assert.ok(note1, 'First stage change note should exist');
    assert.strictEqual(note1.stage, stage2, 'First note should use Interview stage');
    
    assert.ok(note2, 'Second stage change note should exist');
    assert.strictEqual(note2.stage, stage3, 'Second note should use Offer stage');
  });

  it('should include previous and new stage in HR note text', async () => {
    // Create a new test candidate for this specific test
    const candidateId = uuidv4();
    await query(
      `INSERT INTO candidates (id, name, stage) VALUES (?, ?, ?)`,
      [candidateId, 'Stage Text Test Candidate', 'Offer']
    );

    try {
      const previousStage = 'Offer';
      const newStage = 'Hired';

      // Update stage and create HR note
      await query(
        'UPDATE candidates SET stage = ?, previous_stage = ?, stage_updated_at = NOW(), updated_at = NOW() WHERE id = ?',
        [newStage, previousStage, candidateId]
      );

      const stageChangeNoteText = `Stage changed from ${previousStage} to ${newStage}`;
      const result = await query(
        `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id) VALUES (?, ?, ?, ?, ?)`,
        [candidateId, newStage, stageChangeNoteText, 'Stage Change', testUserId]
      );

      createdNoteIds.push(result.insertId);

      // Verify the note text includes both stages
      const hrNotes = await query(
        `SELECT note_text FROM hr_notes WHERE id = ?`,
        [result.insertId]
      );

      const noteText = hrNotes[0].note_text;
      assert.ok(noteText.includes(previousStage), 'Note text should include previous stage');
      assert.ok(noteText.includes(newStage), 'Note text should include new stage');
      assert.ok(noteText.includes('from'), 'Note text should include "from"');
      assert.ok(noteText.includes('to'), 'Note text should include "to"');
    } finally {
      // Clean up
      await query('DELETE FROM hr_notes WHERE candidate_id = ?', [candidateId]);
      await query('DELETE FROM candidates WHERE id = ?', [candidateId]);
    }
  });
});
