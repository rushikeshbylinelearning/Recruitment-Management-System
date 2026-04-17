/**
 * Migration Script: Interaction-Candidate Pipeline Integration
 * 
 * This script runs the migration to integrate the Interaction Memory system
 * with the main Candidates pipeline.
 * 
 * Features:
 * - Creates hr_notes table for stage-wise interaction history
 * - Adds candidate_id FK to interaction_candidates table
 * - Adds indexes for phone/email lookups in candidates table
 * - Supports rollback functionality
 * 
 * Usage:
 *   node backend/scripts/run-interaction-pipeline-integration.js
 *   node backend/scripts/run-interaction-pipeline-integration.js --rollback
 */

import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hr_workflow_db',
  multipleStatements: true
};

/**
 * Run the forward migration
 */
async function runMigration(connection) {
  console.log('Starting Interaction-Candidate Pipeline Integration migration...');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/006_interaction_candidate_pipeline_integration.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Extract only the forward migration part (before ROLLBACK section)
    const forwardMigration = migrationSQL.split('-- ROLLBACK MIGRATION')[0];
    
    // Execute the migration
    await connection.query(forwardMigration);
    
    console.log('✓ Migration completed successfully!');
    console.log('\nChanges applied:');
    console.log('  1. Created hr_notes table');
    console.log('  2. Added candidate_id column to interaction_candidates table');
    console.log('  3. Added indexes for phone/email lookups in candidates table');
    
    return true;
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    throw error;
  }
}

/**
 * Run the rollback migration
 */
async function runRollback(connection) {
  console.log('Starting rollback of Interaction-Candidate Pipeline Integration...');
  
  try {
    // Rollback SQL commands
    const rollbackSQL = `
      -- Remove candidate_id column and index from interaction_candidates
      ALTER TABLE interaction_candidates DROP INDEX idx_candidate_id;
      ALTER TABLE interaction_candidates DROP COLUMN candidate_id;
      
      -- Drop hr_notes table
      DROP TABLE IF EXISTS hr_notes;
    `;
    
    await connection.query(rollbackSQL);
    
    console.log('✓ Rollback completed successfully!');
    console.log('\nChanges reverted:');
    console.log('  1. Dropped hr_notes table');
    console.log('  2. Removed candidate_id column from interaction_candidates table');
    console.log('  3. Removed foreign key constraint');
    
    return true;
  } catch (error) {
    console.error('✗ Rollback failed:', error.message);
    throw error;
  }
}

/**
 * Verify the migration
 */
async function verifyMigration(connection) {
  console.log('\nVerifying migration...');
  
  try {
    // Check if hr_notes table exists
    const [hrNotesTables] = await connection.query(
      "SHOW TABLES LIKE 'hr_notes'"
    );
    
    if (hrNotesTables.length === 0) {
      throw new Error('hr_notes table was not created');
    }
    console.log('✓ hr_notes table exists');
    
    // Check hr_notes table structure
    const [hrNotesColumns] = await connection.query(
      "DESCRIBE hr_notes"
    );
    const requiredColumns = ['id', 'candidate_id', 'stage', 'note_text', 'interaction_type', 'author_id', 'created_at'];
    const columnNames = hrNotesColumns.map(col => col.Field);
    
    for (const col of requiredColumns) {
      if (!columnNames.includes(col)) {
        throw new Error(`hr_notes table missing column: ${col}`);
      }
    }
    console.log('✓ hr_notes table has all required columns');
    
    // Check if candidate_id column exists in interaction_candidates
    const [interactionColumns] = await connection.query(
      "DESCRIBE interaction_candidates"
    );
    const hasCandidate = interactionColumns.some(col => col.Field === 'candidate_id');
    
    if (!hasCandidate) {
      throw new Error('candidate_id column not found in interaction_candidates table');
    }
    console.log('✓ interaction_candidates table has candidate_id column');
    
    // Check indexes on candidates table
    const [candidatesIndexes] = await connection.query(
      "SHOW INDEX FROM candidates WHERE Key_name IN ('idx_phone', 'idx_email')"
    );
    
    const hasPhoneIndex = candidatesIndexes.some(idx => idx.Key_name === 'idx_phone');
    const hasEmailIndex = candidatesIndexes.some(idx => idx.Key_name === 'idx_email');
    
    if (!hasPhoneIndex) {
      console.log('⚠ Warning: idx_phone index not found on candidates table');
    } else {
      console.log('✓ candidates table has idx_phone index');
    }
    
    if (!hasEmailIndex) {
      console.log('⚠ Warning: idx_email index not found on candidates table');
    } else {
      console.log('✓ candidates table has idx_email index');
    }
    
    console.log('\n✓ Migration verification completed successfully!');
    return true;
  } catch (error) {
    console.error('✗ Verification failed:', error.message);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  const isRollback = process.argv.includes('--rollback');
  let connection;
  
  try {
    // Create database connection
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Connected to database\n');
    
    if (isRollback) {
      await runRollback(connection);
    } else {
      await runMigration(connection);
      await verifyMigration(connection);
    }
    
    console.log('\n✓ All operations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed.');
    }
  }
}

// Run the script
main();
