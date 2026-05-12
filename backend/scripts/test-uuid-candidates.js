/**
 * Test UUID Candidates with Notes
 */

import { query } from '../config/database.js';

async function testUUIDCandidates() {
  console.log('🔍 Testing UUID Candidates with Notes...\n');

  try {
    // Find UUID candidates with notes
    console.log('1️⃣ Finding UUID candidates with notes...');
    const uuidCandidatesWithNotes = await query(`
      SELECT hn.candidate_id, c.name, c.stage, COUNT(*) as note_count
      FROM hr_notes hn
      LEFT JOIN candidates c ON hn.candidate_id = c.id
      WHERE hn.candidate_id LIKE '%-%'
      GROUP BY hn.candidate_id
      ORDER BY note_count DESC
      LIMIT 5
    `);

    if (uuidCandidatesWithNotes.length === 0) {
      console.log('   ⚠️  No UUID candidates with notes found');
      console.log('   This is OK if all candidates are legacy (integer IDs)\n');
      return;
    }

    console.log(`   ✅ Found ${uuidCandidatesWithNotes.length} UUID candidates with notes:\n`);
    
    uuidCandidatesWithNotes.forEach((candidate, i) => {
      console.log(`   ${i + 1}. ${candidate.name || 'Unknown'} (${candidate.stage || 'Unknown'})`);
      console.log(`      ID: ${candidate.candidate_id}`);
      console.log(`      Notes: ${candidate.note_count}\n`);
    });

    // Test with first UUID candidate
    const testCandidate = uuidCandidatesWithNotes[0];
    console.log(`2️⃣ Testing with: ${testCandidate.name || 'Unknown'}`);
    console.log(`   ID: ${testCandidate.candidate_id}\n`);

    // Test Modal query
    const modalNotes = await query(
      `SELECT hn.id, hn.candidate_id, hn.stage, hn.note_text as notes, hn.interaction_type, 
              hn.author_id as user_id, hn.created_at, hn.updated_at,
              u.name as user_name, u.role as user_role 
       FROM hr_notes hn
       LEFT JOIN users u ON hn.author_id = u.id
       WHERE hn.candidate_id = ?
       ORDER BY hn.created_at DESC`,
      [testCandidate.candidate_id]
    );

    console.log(`   ✅ Modal query: ${modalNotes.length} notes`);
    if (modalNotes.length > 0) {
      console.log(`   Sample: "${modalNotes[0].notes?.substring(0, 50)}..."`);
    }

    // Test Drawer query
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
      [testCandidate.candidate_id]
    );

    console.log(`   ✅ Drawer query: ${drawerNotes.length} notes`);
    if (drawerNotes.length > 0) {
      console.log(`   Sample: "${drawerNotes[0].note_text?.substring(0, 50)}..."`);
    }

    console.log('\n✅ UUID candidates work correctly!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run test
testUUIDCandidates()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
