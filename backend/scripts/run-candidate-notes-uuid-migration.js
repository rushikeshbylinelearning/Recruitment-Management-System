import { query } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('🔄 Starting candidate_id UUID migration for all tables...');

    const migrationPath = path.join(__dirname, '../migrations/005_convert_candidate_notes_to_uuid.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolon and filter out empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        const preview = statement.substring(0, 80).replace(/\s+/g, ' ');
        console.log(`Executing: ${preview}...`);
        await query(statement);
        console.log('✓ Success');
      } catch (error) {
        // If table doesn't exist, skip it
        if (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146) {
          console.log(`⚠ Table doesn't exist, skipping...`);
        } else if (error.code === 'ER_BAD_FIELD_ERROR' || error.errno === 1054) {
          console.log(`⚠ Column doesn't exist, skipping...`);
        } else {
          throw error;
        }
      }
    }

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
