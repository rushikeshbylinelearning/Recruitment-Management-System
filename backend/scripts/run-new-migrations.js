/**
 * Runs the new assignment workflow migration files against the database.
 * Safe to run multiple times — uses IF NOT EXISTS / IF EXISTS guards.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, testConnection, closePool } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION_FILES = [
  'create_candidate_assignments.sql',
  'create_candidate_assignment_files.sql',
  'create_candidate_notes.sql',
  'add_is_active_to_assignments.sql',
];

async function runMigrations() {
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Cannot connect to database.');
    process.exit(1);
  }

  for (const file of MIGRATION_FILES) {
    const filePath = path.join(__dirname, '../migrations', file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Migration file not found: ${file}`);
      continue;
    }

    const sql = fs.readFileSync(filePath, 'utf8').trim();
    console.log(`\n▶ Running: ${file}`);

    try {
      await query(sql);
      console.log(`✅ Done: ${file}`);
    } catch (err) {
      if (
        err.code === 'ER_TABLE_EXISTS_ERROR' ||
        err.code === 'ER_DUP_KEYNAME' ||
        (err.sqlMessage && err.sqlMessage.includes('Duplicate column'))
      ) {
        console.log(`⚠️  Skipped (already applied): ${file}`);
      } else {
        console.error(`❌ Failed: ${file} — ${err.message}`);
        process.exit(1);
      }
    }
  }

  console.log('\n🎉 All new migrations applied successfully.');
  await closePool();
  process.exit(0);
}

runMigrations();
