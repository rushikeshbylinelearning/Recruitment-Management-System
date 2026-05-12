/**
 * Migration Script: Move notes from candidate_notes_ratings to hr_notes
 * Purpose: Fix notes sync issue between Modal and Drawer
 * 
 * This script migrates all notes from candidate_notes_ratings to hr_notes
 * to establish a single source of truth for all candidate notes.
 */

import { query } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateNotes() {
  console.log('🚀 Starting notes migration...\n');

  try {
    // Step 1: Count existing notes in both tables
    console.log('📊 Checking current state...');
    
    const [oldNotesCount] = await query(
      `SELECT COUNT(*) as count FROM candidate_notes_ratings WHERE notes IS NOT NULL AND notes != ''`
    );
    
    const [hrNotesCount] = await query(
      `SELECT COUNT(*) as count FROM hr_notes`
    );
    
    console.log(`   - candidate_notes_ratings: ${oldNotesCount.count} notes`);
    console.log(`   - hr_notes: ${hrNotesCount.count} notes\n`);

    // Step 2: Migrate notes
    console.log('🔄 Migrating notes to hr_notes table...');
    
    const result = await query(`
      INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id, created_at, updated_at)
      SELECT 
          cnr.candidate_id,
          COALESCE(c.stage, 'Applied') as stage,
          cnr.notes as note_text,
          'General Note' as interaction_type,
          cnr.user_id as author_id,
          cnr.created_at,
          cnr.updated_at
      FROM candidate_notes_ratings cnr
      LEFT JOIN candidates c ON cnr.candidate_id = c.id
      WHERE cnr.notes IS NOT NULL 
        AND cnr.notes != ''
        AND NOT EXISTS (
          SELECT 1 FROM hr_notes hn 
          WHERE hn.candidate_id = cnr.candidate_id 
            AND hn.note_text = cnr.notes 
            AND hn.author_id = cnr.user_id
            AND hn.created_at = cnr.created_at
        )
    `);

    console.log(`   ✅ Migrated ${result.affectedRows} notes\n`);

    // Step 3: Verify migration
    console.log('✅ Verifying migration...');
    
    const [newHrNotesCount] = await query(
      `SELECT COUNT(*) as count FROM hr_notes`
    );
    
    console.log(`   - hr_notes now has: ${newHrNotesCount.count} notes`);
    console.log(`   - New notes added: ${newHrNotesCount.count - hrNotesCount.count}\n`);

    // Step 4: Show sample migrated notes
    console.log('📝 Sample migrated notes:');
    const sampleNotes = await query(`
      SELECT 
        hn.id,
        hn.candidate_id,
        c.name as candidate_name,
        hn.stage,
        LEFT(hn.note_text, 50) as note_preview,
        u.name as author_name,
        hn.created_at
      FROM hr_notes hn
      LEFT JOIN candidates c ON hn.candidate_id = c.id
      LEFT JOIN users u ON hn.author_id = u.id
      WHERE hn.interaction_type = 'General Note'
      ORDER BY hn.created_at DESC
      LIMIT 5
    `);

    sampleNotes.forEach((note, i) => {
      console.log(`   ${i + 1}. ${note.candidate_name} (${note.stage})`);
      console.log(`      "${note.note_preview}${note.note_preview.length >= 50 ? '...' : ''}"`);
      console.log(`      By: ${note.author_name} on ${new Date(note.created_at).toLocaleDateString()}\n`);
    });

    console.log('✨ Migration completed successfully!\n');
    console.log('📌 Next steps:');
    console.log('   1. Test bulk upload with notes');
    console.log('   2. Verify notes appear in both Modal and Drawer');
    console.log('   3. Test adding new notes from UI');
    console.log('   4. Confirm all notes are synced\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateNotes()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
