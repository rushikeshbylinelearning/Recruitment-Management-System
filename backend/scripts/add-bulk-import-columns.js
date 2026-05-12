/**
 * Migration Script: Add missing columns for bulk import feature
 * 
 * Adds columns required by bulkInsertService that are missing from production DB:
 * - salary_offered
 * - expertise
 * - work_preference
 * - current_ctc
 * - ctc_frequency
 * - in_house_assignment_status
 * - assignment_location
 * - resume_location
 * - willing_alternate_saturday
 * 
 * Safe to re-run (uses ADD COLUMN IF NOT EXISTS)
 */

import { query } from '../config/database.js';

async function addBulkImportColumns() {
  console.log('🔧 Adding missing columns for bulk import feature...\n');

  const alterations = [
    {
      name: 'salary_offered',
      sql: "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS salary_offered VARCHAR(100) NULL AFTER salary_expected"
    },
    {
      name: 'expertise',
      sql: "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS expertise VARCHAR(255) NULL AFTER skills"
    },
    {
      name: 'willing_alternate_saturday',
      sql: "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS willing_alternate_saturday TINYINT(1) DEFAULT 0 NULL AFTER immediate_joiner"
    },
    {
      name: 'work_preference',
      sql: "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS work_preference ENUM('Onsite','WFH','Hybrid') NULL AFTER willing_alternate_saturday"
    },
    {
      name: 'current_ctc',
      sql: "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS current_ctc VARCHAR(100) NULL AFTER work_preference"
    },
    {
      name: 'ctc_frequency',
      sql: "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS ctc_frequency ENUM('Monthly','Annual') NULL AFTER current_ctc"
    },
    {
      name: 'in_house_assignment_status',
      sql: "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS in_house_assignment_status ENUM('Pending','Shortlisted','Rejected') NULL AFTER ctc_frequency"
    },
    {
      name: 'assignment_location',
      sql: "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assignment_location VARCHAR(255) NULL AFTER in_house_assignment_status"
    },
    {
      name: 'resume_location',
      sql: "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_location VARCHAR(500) NULL AFTER assignment_location"
    }
  ];

  let successCount = 0;
  let skipCount = 0;

  for (const alteration of alterations) {
    try {
      await query(alteration.sql);
      console.log(`✓ Added column: ${alteration.name}`);
      successCount++;
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column')) {
        console.log(`⊘ Column already exists: ${alteration.name}`);
        skipCount++;
      } else {
        console.error(`✗ Failed to add column ${alteration.name}:`, error.message);
        throw error;
      }
    }
  }

  console.log(`\n✅ Migration complete!`);
  console.log(`   - Added: ${successCount} columns`);
  console.log(`   - Skipped (already exist): ${skipCount} columns`);
  console.log(`\n🎉 Bulk import feature should now work correctly!`);
}

addBulkImportColumns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
