/**
 * Migration Script: Add category column to tasks table
 * Run this script to add the category field to existing tasks table
 */

import { query } from './config/database.js';

async function runMigration() {
  console.log('🚀 Starting migration: Add category column to tasks table...\n');

  try {
    // Step 1: Add category column
    console.log('Step 1: Adding category column...');
    await query(`
      ALTER TABLE tasks 
      ADD COLUMN category ENUM('hr-operations', 'admin-operations', 'misc') 
      DEFAULT 'misc' 
      AFTER status
    `);
    console.log('✅ Category column added successfully\n');

    // Step 2: Update existing tasks based on keywords (HR Operations)
    console.log('Step 2: Categorizing existing tasks (HR Operations)...');
    const hrResult = await query(`
      UPDATE tasks 
      SET category = 'hr-operations'
      WHERE LOWER(CONCAT(title, ' ', COALESCE(description, ''))) REGEXP 'hr|recruit|recruiter|onboard|offer|hire|hiring|payroll|leave|policy|policies|employee|staff|interview|candidate|application|resume|cv|job posting|talent|workforce|performance review|appraisal|training|induction'
    `);
    console.log(`✅ Updated ${hrResult.affectedRows} tasks to HR Operations\n`);

    // Step 3: Update existing tasks based on keywords (Admin Operations)
    console.log('Step 3: Categorizing existing tasks (Admin Operations)...');
    const adminResult = await query(`
      UPDATE tasks 
      SET category = 'admin-operations'
      WHERE LOWER(CONCAT(title, ' ', COALESCE(description, ''))) REGEXP 'admin|report|reporting|document|documentation|compliance|legal|finance|financial|budget|accounting|invoice|expense|procurement|purchase|vendor|contract|audit|regulatory|tax|insurance'
      AND category != 'hr-operations'
    `);
    console.log(`✅ Updated ${adminResult.affectedRows} tasks to Admin Operations\n`);

    // Step 4: Show summary
    console.log('Step 4: Migration summary...');
    const summary = await query(`
      SELECT 
        category,
        COUNT(*) as count
      FROM tasks
      GROUP BY category
    `);
    
    console.log('\n📊 Task Distribution by Category:');
    console.log('─'.repeat(40));
    summary.forEach(row => {
      const label = row.category === 'hr-operations' ? 'HR Operations' :
                    row.category === 'admin-operations' ? 'Admin Operations' : 'Misc';
      console.log(`${label.padEnd(20)} : ${row.count} tasks`);
    });
    console.log('─'.repeat(40));

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart the backend server');
    console.log('   2. Clear browser cache and refresh frontend');
    console.log('   3. Test creating a new task with category selection');
    
    process.exit(0);
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️  Category column already exists. Skipping column creation.');
      console.log('✅ Migration already applied. No action needed.');
      process.exit(0);
    } else {
      console.error('❌ Migration failed:', error.message);
      console.error('\nError details:', error);
      process.exit(1);
    }
  }
}

// Run migration
runMigration();
