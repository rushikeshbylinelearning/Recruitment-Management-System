/**
 * Rollback script for UUID migration
 * Restores the candidates table to use INT AUTO_INCREMENT primary key
 */

import pool from '../config/database.js';

async function rollback() {
  console.log('🔄 Rolling back UUID migration...\n');
  
  const connection = await pool.getConnection();
  
  try {
    // Check if new_id column exists
    const [columns] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'candidates' AND COLUMN_NAME = 'new_id'"
    );
    
    if (columns.length > 0) {
      console.log('✅ Found new_id column, removing it...');
      await connection.query('ALTER TABLE candidates DROP COLUMN new_id');
      console.log('✅ Rollback complete');
    } else {
      console.log('⚠️  new_id column not found, nothing to rollback');
    }
    
  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

rollback();
