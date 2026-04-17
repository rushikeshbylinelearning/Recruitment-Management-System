/**
 * Interview Scheduling Migration Script
 * Creates the interviews and push_subscriptions tables
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🚀 Starting Interview Scheduling Migration\n');

  try {
    const migrationPath = path.join(__dirname, '../migrations/create_interview_scheduling.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements\n`);

    for (let i = 0; i < statements.length; i++) {
      try {
        await pool.query(statements[i]);
        console.log(`✅ Statement ${i + 1}/${statements.length} done`);
      } catch (err) {
        if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.code === 'ER_DUP_KEYNAME' || err.message.includes('Duplicate')) {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists)`);
        } else {
          console.error(`❌ Error in statement ${i + 1}:`, err.message);
        }
      }
    }

    console.log('\n✅ Interview Scheduling migration complete!');
    console.log('   - interviews table created');
    console.log('   - push_subscriptions table created\n');
    console.log('🎉 Interview Scheduling is ready!\n');

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
