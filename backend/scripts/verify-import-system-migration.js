/**
 * Verification Script for Intelligent Candidate Import System Migration
 * Checks all database schema changes were applied correctly
 */

import pool from '../config/database.js';

async function verify() {
  console.log('🔍 Verifying Intelligent Candidate Import System Migration\n');
  console.log('=' .repeat(60));
  
  const connection = await pool.getConnection();
  let allPassed = true;
  
  try {
    // Test 1: Verify candidates table has UUID primary key
    console.log('\n✓ Test 1: Candidates table UUID primary key');
    const [idColumn] = await connection.query(
      "SELECT DATA_TYPE, COLUMN_KEY FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'candidates' AND COLUMN_NAME = 'id'"
    );
    
    if (idColumn[0]?.DATA_TYPE === 'varchar' && idColumn[0]?.COLUMN_KEY === 'PRI') {
      console.log('  ✅ PASS: ID column is VARCHAR primary key');
    } else {
      console.log('  ❌ FAIL: ID column is not VARCHAR primary key');
      allPassed = false;
    }
    
    // Test 2: Verify no unique constraint on name
    console.log('\n✓ Test 2: Name field allows duplicates');
    const [nameIndex] = await connection.query(
      "SELECT NON_UNIQUE FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_NAME = 'candidates' AND COLUMN_NAME = 'name' AND INDEX_NAME = 'name'"
    );
    
    if (nameIndex.length === 0 || nameIndex[0]?.NON_UNIQUE === 1) {
      console.log('  ✅ PASS: Name field allows duplicates');
    } else {
      console.log('  ❌ FAIL: Name field has unique constraint');
      allPassed = false;
    }
    
    // Test 3: Verify required indexes exist
    console.log('\n✓ Test 3: Required indexes on candidates table');
    const requiredIndexes = ['idx_email', 'idx_phone', 'idx_name', 'idx_applied_date'];
    
    for (const indexName of requiredIndexes) {
      const [index] = await connection.query(
        `SHOW INDEX FROM candidates WHERE Key_name = '${indexName}'`
      );
      
      if (index.length > 0) {
        console.log(`  ✅ PASS: Index ${indexName} exists`);
      } else {
        console.log(`  ❌ FAIL: Index ${indexName} missing`);
        allPassed = false;
      }
    }
    
    // Test 4: Verify email and phone allow NULL
    console.log('\n✓ Test 4: Email and phone allow NULL values');
    const [emailColumn] = await connection.query(
      "SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'candidates' AND COLUMN_NAME = 'email'"
    );
    const [phoneColumn] = await connection.query(
      "SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'candidates' AND COLUMN_NAME = 'phone'"
    );
    
    if (emailColumn[0]?.IS_NULLABLE === 'YES') {
      console.log('  ✅ PASS: Email allows NULL');
    } else {
      console.log('  ❌ FAIL: Email does not allow NULL');
      allPassed = false;
    }
    
    if (phoneColumn[0]?.IS_NULLABLE === 'YES') {
      console.log('  ✅ PASS: Phone allows NULL');
    } else {
      console.log('  ❌ FAIL: Phone does not allow NULL');
      allPassed = false;
    }
    
    // Test 5: Verify import_logs table exists
    console.log('\n✓ Test 5: import_logs table');
    const [importLogs] = await connection.query(
      "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'import_logs'"
    );
    
    if (importLogs[0]?.count === 1) {
      console.log('  ✅ PASS: import_logs table exists');
      
      // Check required columns
      const [columns] = await connection.query("DESCRIBE import_logs");
      const requiredColumns = ['id', 'user_id', 'filename', 'total_rows', 'success_count', 'failure_count', 'processing_time', 'uploaded_at'];
      const existingColumns = columns.map(col => col.Field);
      
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
      if (missingColumns.length === 0) {
        console.log('  ✅ PASS: All required columns present');
      } else {
        console.log(`  ❌ FAIL: Missing columns: ${missingColumns.join(', ')}`);
        allPassed = false;
      }
    } else {
      console.log('  ❌ FAIL: import_logs table does not exist');
      allPassed = false;
    }
    
    // Test 6: Verify import_failed_rows table exists
    console.log('\n✓ Test 6: import_failed_rows table');
    const [importFailedRows] = await connection.query(
      "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'import_failed_rows'"
    );
    
    if (importFailedRows[0]?.count === 1) {
      console.log('  ✅ PASS: import_failed_rows table exists');
      
      // Check foreign key
      const [fk] = await connection.query(
        "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = 'import_failed_rows' AND REFERENCED_TABLE_NAME = 'import_logs'"
      );
      
      if (fk.length > 0) {
        console.log('  ✅ PASS: Foreign key to import_logs exists');
      } else {
        console.log('  ❌ FAIL: Foreign key to import_logs missing');
        allPassed = false;
      }
    } else {
      console.log('  ❌ FAIL: import_failed_rows table does not exist');
      allPassed = false;
    }
    
    // Test 7: Verify field_mappings table exists
    console.log('\n✓ Test 7: field_mappings table');
    const [fieldMappings] = await connection.query(
      "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'field_mappings'"
    );
    
    if (fieldMappings[0]?.count === 1) {
      console.log('  ✅ PASS: field_mappings table exists');
      
      // Check unique constraint
      const [uniqueConstraint] = await connection.query(
        "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_NAME = 'field_mappings' AND INDEX_NAME = 'unique_user_mapping'"
      );
      
      if (uniqueConstraint.length > 0) {
        console.log('  ✅ PASS: Unique constraint on (user_id, source_column, target_field) exists');
      } else {
        console.log('  ❌ FAIL: Unique constraint missing');
        allPassed = false;
      }
    } else {
      console.log('  ❌ FAIL: field_mappings table does not exist');
      allPassed = false;
    }
    
    // Test 8: Verify no leftover columns
    console.log('\n✓ Test 8: No leftover migration columns');
    const [leftoverColumns] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'candidates' AND COLUMN_NAME = 'new_id'"
    );
    
    if (leftoverColumns.length === 0) {
      console.log('  ✅ PASS: No leftover columns found');
    } else {
      console.log('  ❌ FAIL: Leftover column "new_id" still exists');
      allPassed = false;
    }
    
    // Test 9: Verify existing data integrity
    console.log('\n✓ Test 9: Existing data integrity');
    const [candidateCount] = await connection.query("SELECT COUNT(*) as count FROM candidates");
    const [sampleUUIDs] = await connection.query("SELECT id FROM candidates LIMIT 5");
    
    console.log(`  ℹ️  Total candidates: ${candidateCount[0]?.count}`);
    
    let validUUIDs = true;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    for (const row of sampleUUIDs) {
      if (!uuidRegex.test(row.id)) {
        console.log(`  ❌ FAIL: Invalid UUID format: ${row.id}`);
        validUUIDs = false;
        allPassed = false;
      }
    }
    
    if (validUUIDs) {
      console.log('  ✅ PASS: All sampled IDs are valid UUIDs');
    }
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    if (allPassed) {
      console.log('🎉 All verification tests PASSED!');
      console.log('\nMigration Status: ✅ SUCCESS');
      console.log('\nThe Intelligent Candidate Import System database schema');
      console.log('has been successfully migrated and verified.');
    } else {
      console.log('⚠️  Some verification tests FAILED!');
      console.log('\nMigration Status: ❌ INCOMPLETE');
      console.log('\nPlease review the failed tests above and re-run the migration.');
    }
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error('\nError details:', error);
    allPassed = false;
  } finally {
    connection.release();
    await pool.end();
    console.log('\n✅ Database connection closed\n');
  }
  
  process.exit(allPassed ? 0 : 1);
}

verify();
