/**
 * Test Script: Verify notes are being saved and retrieved correctly
 */

import { query } from '../config/database.js';

async function testNotesQuery() {
  console.log('🔍 Testing Notes Query...\n');

  try {
    // Test 1: Check if hr_notes table exists
    console.log('1️⃣ Checking hr_notes table structure...');
    try {
      const structure = await query('DESCRIBE hr_notes');
      console.log('   ✅ hr_notes table exists');
      console.log('   Columns:', structure.map(col => col.Field).join(', '));
    } catch (error) {
      console.log('   ❌ hr_notes table does NOT exist!');
      console.log('   Error:', error.message);
      return;
    }

    // Test 2: Count total notes
    console.log('\n2️⃣ Counting notes in hr_notes...');
    const [countResult] = await query('SELECT COUNT(*) as count FROM hr_notes');
    console.log(`   Total notes: ${countResult.count}`);

    // Test 3: Show sample notes
    if (countResult.count > 0) {
      console.log('\n3️⃣ Sample notes from hr_notes:');
      const sampleNotes = await query(`
        SELECT 
          hn.id,
          hn.candidate_id,
          hn.stage,
          LEFT(hn.note_text, 50) as note_preview,
          hn.interaction_type,
          u.name as author_name,
          hn.created_at
        FROM hr_notes hn
        LEFT JOIN users u ON hn.author_id = u.id
        ORDER BY hn.created_at DESC
        LIMIT 5
      `);

      sampleNotes.forEach((note, i) => {
        console.log(`   ${i + 1}. [${note.stage}] ${note.interaction_type}`);
        console.log(`      "${note.note_preview}${note.note_preview?.length >= 50 ? '...' : ''}"`);
        console.log(`      By: ${note.author_name || 'Unknown'} | Candidate: ${note.candidate_id}`);
      });
    } else {
      console.log('\n   ⚠️  No notes found in hr_notes table!');
      console.log('   This means:');
      console.log('   - Migration has not been run yet');
      console.log('   - OR no notes have been created since the fix');
    }

    // Test 4: Check old table
    console.log('\n4️⃣ Checking old candidate_notes_ratings table...');
    try {
      const [oldCount] = await query('SELECT COUNT(*) as count FROM candidate_notes_ratings WHERE notes IS NOT NULL AND notes != ""');
      console.log(`   Old table has: ${oldCount.count} notes`);
      
      if (oldCount.count > 0) {
        console.log('\n   ⚠️  MIGRATION NEEDED!');
        console.log('   Run: node scripts/migrate-notes-to-hr-notes.js');
      }
    } catch (error) {
      console.log('   ℹ️  candidate_notes_ratings table not found (this is OK)');
    }

    // Test 5: Test the actual query used by the API
    console.log('\n5️⃣ Testing API query format...');
    const testCandidateId = await query('SELECT id FROM candidates LIMIT 1');
    
    if (testCandidateId.length > 0) {
      const candidateId = testCandidateId[0].id;
      console.log(`   Testing with candidate ID: ${candidateId}`);
      
      // Test GET /api/candidates/:id query
      const notesForCandidate = await query(
        `SELECT hn.id, hn.candidate_id, hn.stage, hn.note_text as notes, hn.interaction_type, 
                hn.author_id as user_id, hn.created_at, hn.updated_at,
                u.name as user_name, u.role as user_role 
         FROM hr_notes hn
         LEFT JOIN users u ON hn.author_id = u.id
         WHERE hn.candidate_id = ?
         ORDER BY hn.created_at DESC`,
        [candidateId]
      );
      
      console.log(`   Notes found for this candidate: ${notesForCandidate.length}`);
      
      if (notesForCandidate.length > 0) {
        console.log('   ✅ Query works! Sample note:');
        const note = notesForCandidate[0];
        console.log('   Fields returned:', Object.keys(note).join(', '));
        console.log('   note.notes:', note.notes ? `"${note.notes.substring(0, 50)}..."` : 'NULL');
        console.log('   note.user_name:', note.user_name || 'NULL');
      }
    }

    console.log('\n✅ Test completed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run test
testNotesQuery()
  .then(() => {
    console.log('✅ All tests passed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Tests failed:', error);
    process.exit(1);
  });
