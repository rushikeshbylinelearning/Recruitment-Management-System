import { query } from '../config/database.js';

async function migrate() {
  try {
    await query(`ALTER TABLE candidates 
      ADD COLUMN IF NOT EXISTS previous_stage VARCHAR(50) AFTER stage,
      ADD COLUMN IF NOT EXISTS stage_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER previous_stage`);
    console.log('✓ Added previous_stage and stage_updated_at columns');

    await query(`ALTER TABLE candidates 
      ADD INDEX IF NOT EXISTS idx_stage (stage),
      ADD INDEX IF NOT EXISTS idx_stage_updated_at (stage_updated_at)`);
    console.log('✓ Added indexes');

    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  }
  process.exit(0);
}

migrate();
