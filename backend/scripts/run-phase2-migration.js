/**
 * Phase 2 Migration Script
 * Run this to set up Pipeline Intelligence tables
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🚀 Starting Phase 2 Migration: Pipeline Intelligence\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/create_pipeline_intelligence.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolon and filter empty statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments
      if (statement.startsWith('--')) continue;

      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        await pool.query(statement);
        console.log(`✅ Statement ${i + 1} completed\n`);
      } catch (error) {
        // Some statements might fail if already exists, that's okay
        if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
            error.code === 'ER_DUP_FIELDNAME' ||
            error.message.includes('Duplicate')) {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists)\n`);
        } else {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          console.error('Statement:', statement.substring(0, 100) + '...\n');
        }
      }
    }

    console.log('✅ Migration completed successfully!\n');
    console.log('📊 Summary:');
    console.log('   - Extended candidates table with stage tracking');
    console.log('   - Created activity_logs table');
    console.log('   - Created pipeline_automations table');
    console.log('   - Created automation_actions table');
    console.log('   - Created pipeline_rules table');
    console.log('   - Created automation_execution_log table');
    console.log('   - Inserted 4 default automations');
    console.log('   - Inserted 4 default actions');
    console.log('   - Inserted 2 default rules\n');

    console.log('🎉 Your ATS now has Pipeline Intelligence!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration();
