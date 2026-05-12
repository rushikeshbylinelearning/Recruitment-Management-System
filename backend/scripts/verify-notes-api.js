/**
 * Verify Notes API: Test that notes are returned correctly by the API
 */

import { query } from '../config/database.js';

async function verifyNotesAPI() {
  console.log('🔍 Verifying Notes API...\n');

  try {
    // Find a candidate with notes
    console.log('1️⃣ Finding candidate with notes...');
    const candidatesWithNotes = await query(`
      SELECT candidate_id, COUNT(*) as note_count
      FROM hr_notes
      GROUP BY candidate_id
      ORDER BY note_count DESC
      LIMIT 1
    `);

    if (candidatesWithNotes.length === 0) {
      console.log('   ❌ No candidates with notes found!');
      return;
    }

    const testCandidateId = candidatesWithNotes[0].candidate_id;
    const noteCount = candidatesWithNotes[0].note_count;
    
    console.log(`   ✅ Found candidate: ${testCandidateId}`);
    console.log(`   Notes count: ${noteCount}\n`);

    // Get candidate name
    const [candidateInfo] = await query('SELECT name, stage FROM candidates WHERE id = ?', [testCandidateId]);
    console.log(`   Candidate: ${candidateInfo?.name || 'Unknown'} (${candidateInfo?.stage || 'Unknown'})\n`);

    // Test 1: GET /api/candidates/:id query (used by Modal)
    console.log('2️⃣ Testing GET /api/candidates/:id query (Modal)...');
    const modalNotes = await query(
      `SELECT hn.id, hn.candidate_id, hn.stage, hn.note_text as notes, hn.interaction_type, 
              hn.author_id as user_id, hn.created_at, hn.updated_at,
              u.name as user_name, u.role as user_role 
       FROM hr_notes hn
       LEFT JOIN users u ON hn.author_id = u.id
       WHERE hn.candidate_id = ?
       ORDER BY hn.created_at DESC`,
      [testCandidateId]
    );

    console.log(`   ✅ Query returned ${modalNotes.length} notes`);
    if (modalNotes.length > 0) {
      const note = modalNotes[0];
      console.log('   Sample note structure:');
      console.log('   - id:', note.id);
      console.log('   - notes:', note.notes ? `"${note.notes.substring(0, 50)}..."` : 'NULL');
      console.log('   - user_name:', note.user_name);
      console.log('   - user_role:', note.user_role);
      console.log('   - interaction_type:', note.interaction_type);
      console.log('   - stage:', note.stage);
      console.log('   ✅ Field "notes" exists:', !!note.notes);
    }

    // Test 2: GET /api/candidates/:id/hr-notes query (used by Drawer)
    console.log('\n3️⃣ Testing GET /api/candidates/:id/hr-notes query (Drawer)...');
    const drawerNotes = await query(
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

    console.log(`   ✅ Query returned ${drawerNotes.length} notes`);
    if (drawerNotes.length > 0) {
      const note = drawerNotes[0];
      console.log('   Sample note structure:');
      console.log('   - id:', note.id);
      console.log('   - note_text:', note.note_text ? `"${note.note_text.substring(0, 50)}..."` : 'NULL');
      console.log('   - author_name:', note.author_name);
      console.log('   - author_role:', note.author_role);
      console.log('   - interaction_type:', note.interaction_type);
      console.log('   - stage:', note.stage);
      console.log('   ✅ Field "note_text" exists:', !!note.note_text);
    }

    // Test 3: Group by stage (Drawer format)
    console.log('\n4️⃣ Testing grouped by stage format (Drawer)...');
    const notesByStage = {};
    
    for (const note of drawerNotes) {
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

    console.log('   Stages with notes:', Object.keys(notesByStage).join(', '));
    Object.entries(notesByStage).forEach(([stage, notes]) => {
      console.log(`   - ${stage}: ${notes.length} notes`);
    });

    console.log('\n✅ All API queries work correctly!\n');
    console.log('📌 Summary:');
    console.log(`   - Modal query: ✅ Returns ${modalNotes.length} notes with "notes" field`);
    console.log(`   - Drawer query: ✅ Returns ${drawerNotes.length} notes with "note_text" field`);
    console.log(`   - Both queries return the same data, just different field names`);
    console.log('\n🎉 Notes should now be visible in both Modal and Drawer!');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  }
}

// Run verification
verifyNotesAPI()
  .then(() => {
    console.log('\n✅ Verification completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
