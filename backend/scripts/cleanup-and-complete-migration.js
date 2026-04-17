/**
 * Cleanup and Complete Migration Script
 * Removes leftover new_id column and creates remaining tables
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function cleanupAndComplete() {
  console.log('🧹 Cleaning up and completing migration...\n');
  
  const connection = await pool.getConnection();
  
  try {
    // Step 1: Check if new_id column exists and remove it
    const [columns] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'candidates' AND COLUMN_NAME = 'new_id'"
    );
    
    if (columns.length > 0) {
      console.log('🗑️  Removing leftover new_id column...');
      await connection.query('ALTER TABLE candidates DROP COLUMN new_id');
      console.log('✅ new_id column removed');
    } else {
      console.log('✅ No cleanup needed for candidates table');
    }
    
    // Step 2: Create import_logs table
    console.log('\n📋 Creating import_logs table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS import_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        filename VARCHAR(255) NOT NULL,
        total_rows INT NOT NULL,
        success_count INT NOT NULL,
        failure_count INT NOT NULL,
        processing_time INT NULL COMMENT 'Processing time in milliseconds',
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        INDEX idx_user_id (user_id),
        INDEX idx_uploaded_at (uploaded_at),
        INDEX idx_user_uploaded (user_id, uploaded_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci 
      COMMENT='Tracks candidate import history and statistics'
    `);
    console.log('✅ import_logs table created');
    
    // Step 3: Create import_failed_rows table
    console.log('\n📋 Creating import_failed_rows table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS import_failed_rows (
        id INT AUTO_INCREMENT PRIMARY KEY,
        import_log_id INT NOT NULL,
        row_number INT NOT NULL,
        candidate_name VARCHAR(255) NULL,
        error_message TEXT NOT NULL,
        row_data JSON NOT NULL COMMENT 'Original row data as JSON',
        
        FOREIGN KEY (import_log_id) REFERENCES import_logs(id) ON DELETE CASCADE,
        INDEX idx_import_log_id (import_log_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci 
      COMMENT='Stores failed candidate import rows with error details'
    `);
    console.log('✅ import_failed_rows table created');
    
    // Step 4: Create field_mappings table
    console.log('\n📋 Creating field_mappings table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS field_mappings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        mapping_name VARCHAR(255) NULL COMMENT 'Optional name for the mapping set',
        source_column VARCHAR(255) NOT NULL COMMENT 'Column name from uploaded file',
        target_field VARCHAR(255) NOT NULL COMMENT 'System field name',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_user_id (user_id),
        UNIQUE KEY unique_user_mapping (user_id, source_column, target_field)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci 
      COMMENT='Stores user field mapping preferences for candidate imports'
    `);
    console.log('✅ field_mappings table created');
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Migration completed successfully!');
    console.log('\nDatabase schema changes:');
    console.log('  ✓ Candidates table uses UUID primary key');
    console.log('  ✓ Indexes added for email, phone, name, applied_date');
    console.log('  ✓ import_logs table created');
    console.log('  ✓ import_failed_rows table created');
    console.log('  ✓ field_mappings table created');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
    console.log('\n✅ Database connection closed');
  }
}

cleanupAndComplete();
