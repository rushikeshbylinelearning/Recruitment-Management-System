/**
 * Migration Runner for Intelligent Candidate Import System
 * Executes database schema modifications for UUID conversion and import logging
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

const MIGRATION_FILES = [
  '001_convert_candidates_to_uuid.sql',
  '002_create_import_logs_table.sql',
  '003_create_import_failed_rows_table.sql',
  '004_create_field_mappings_table.sql'
];

/**
 * Execute a single SQL migration file
 */
async function executeMigration(filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  
  console.log(`\n📄 Reading migration: ${filename}`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Migration file not found: ${filePath}`);
  }
  
  const sql = fs.readFileSync(filePath, 'utf8');
  
  // Remove comments and split SQL file into individual statements
  const cleanedSql = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');
  
  const statements = cleanedSql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
  
  console.log(`   Found ${statements.length} SQL statements`);
  
  const connection = await pool.getConnection();
  
  try {
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`   Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        await connection.query(statement);
        console.log(`   ✅ Statement ${i + 1} executed successfully`);
      } catch (error) {
        // Check if error is about index already existing (safe to ignore)
        if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
          console.log(`   ⚠️  Index already exists, skipping...`);
        } else {
          throw error;
        }
      }
    }
    
    console.log(`✅ Migration ${filename} completed successfully`);
  } finally {
    connection.release();
  }
}

/**
 * Main migration execution
 */
async function runMigrations() {
  console.log('🚀 Starting Intelligent Candidate Import System Migrations\n');
  console.log('=' .repeat(60));
  
  try {
    // Test database connection
    const connection = await pool.getConnection();
    console.log('✅ Database connection established');
    connection.release();
    
    // Execute each migration in order
    for (const filename of MIGRATION_FILES) {
      await executeMigration(filename);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 All migrations completed successfully!');
    console.log('\nDatabase schema changes:');
    console.log('  ✓ Candidates table converted to UUID primary key');
    console.log('  ✓ Indexes added for email, phone, name, applied_date');
    console.log('  ✓ import_logs table created');
    console.log('  ✓ import_failed_rows table created');
    console.log('  ✓ field_mappings table created');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run migrations
runMigrations();
