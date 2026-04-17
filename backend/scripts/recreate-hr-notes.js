import { query, testConnection, closePool } from '../config/database.js';

async function recreateHrNotes() {
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Cannot connect to database.');
    process.exit(1);
  }

  console.log('🔧 Recreating hr_notes table...\n');

  // Drop the corrupted table
  try {
    await query('DROP TABLE IF EXISTS hr_notes');
    console.log('✅ Dropped corrupted table');
  } catch (err) {
    console.log('⚠️  Could not drop table:', err.message);
  }

  // Recreate the table
  try {
    await query(`
      CREATE TABLE hr_notes (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        candidate_id    VARCHAR(36)  NOT NULL COMMENT 'FK to candidates table (UUID)',
        stage           ENUM('Applied','Screening','Interview','Offer','Hired','On Hold','Rejected','No Show - Interview','No Show - Onboarding') NOT NULL COMMENT 'Stage when note was created',
        note_text       TEXT         NOT NULL COMMENT 'Note content',
        interaction_type ENUM('Phone Call','Email','Interview','Stage Change','General Note','System Event') DEFAULT 'General Note' COMMENT 'Type of interaction',
        author_id       INT          NOT NULL COMMENT 'User who created the note',
        created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_candidate_id (candidate_id),
        INDEX idx_stage (stage),
        INDEX idx_created_at (created_at),
        INDEX idx_author_id (author_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Stage-wise interaction history for candidates in main pipeline'
    `);
    console.log('✅ hr_notes table created');
  } catch (err) {
    console.error('❌ Failed to create table:', err.message);
  }

  // Verify
  try {
    const result = await query('SELECT COUNT(*) as count FROM hr_notes');
    console.log(`\n✅ hr_notes: Working (${result[0].count} rows)`);
  } catch (err) {
    console.error(`\n❌ hr_notes: ${err.message}`);
  }

  await closePool();
  process.exit(0);
}

recreateHrNotes();
