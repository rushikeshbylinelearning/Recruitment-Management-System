/**
 * Diagnostic script to identify form submission errors
 * Run this to check database tables and identify issues
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hr_workflow_db',
};

async function diagnose() {
  let connection;
  
  try {
    console.log('🔍 Connecting to database...');
    console.log(`Database: ${dbConfig.database}`);
    console.log(`Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`User: ${dbConfig.user}\n`);
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected\n');

    // Check if forms table exists
    console.log('1. Checking forms table...');
    const [forms] = await connection.execute(
      "SELECT * FROM forms WHERE slug = 'default-application'"
    );
    
    if (forms.length === 0) {
      console.log('❌ No form found with slug "default-application"');
      console.log('   Available forms:');
      const [allForms] = await connection.execute('SELECT id, name, slug, is_active FROM forms');
      allForms.forEach(f => console.log(`   - ${f.slug} (${f.name}) - Active: ${f.is_active}`));
      return;
    }
    
    const form = forms[0];
    console.log(`✅ Form found: ${form.name} (ID: ${form.id})`);
    console.log(`   Active: ${form.is_active}`);
    console.log(`   Token: ${form.access_token}\n`);

    // Check form fields
    console.log('2. Checking form fields...');
    const [fields] = await connection.execute(
      'SELECT field_key, field_type, is_required, is_active FROM form_fields WHERE form_id = ?',
      [form.id]
    );
    console.log(`✅ Found ${fields.length} fields:`);
    fields.forEach(f => {
      console.log(`   - ${f.field_key} (${f.field_type}) - Required: ${f.is_required}, Active: ${f.is_active}`);
    });
    console.log('');

    // Check candidates table structure
    console.log('3. Checking candidates table...');
    const [candidatesCols] = await connection.execute('DESCRIBE candidates');
    const requiredCols = ['name', 'email', 'phone', 'position', 'stage', 'source', 'applied_date'];
    const missingCols = requiredCols.filter(col => 
      !candidatesCols.some(c => c.Field === col)
    );
    
    if (missingCols.length > 0) {
      console.log(`❌ Missing required columns in candidates table: ${missingCols.join(', ')}`);
    } else {
      console.log('✅ All required columns exist in candidates table');
    }
    console.log('');

    // Check form_submissions table
    console.log('4. Checking form_submissions table...');
    const [submissionsCols] = await connection.execute('DESCRIBE form_submissions');
    console.log(`✅ Form submissions table has ${submissionsCols.length} columns`);
    console.log('');

    // Check recent submissions
    console.log('5. Checking recent failed submissions...');
    const [failedSubmissions] = await connection.execute(
      `SELECT id, form_id, status, error_message, submitted_at 
       FROM form_submissions 
       WHERE status = 'failed' 
       ORDER BY submitted_at DESC 
       LIMIT 5`
    );
    
    if (failedSubmissions.length > 0) {
      console.log(`⚠️  Found ${failedSubmissions.length} recent failed submissions:`);
      failedSubmissions.forEach(s => {
        console.log(`   - ID: ${s.id}, Error: ${s.error_message}`);
      });
    } else {
      console.log('✅ No recent failed submissions');
    }
    console.log('');

    // Test a simple insert
    console.log('6. Testing database write permissions...');
    try {
      await connection.execute(
        `INSERT INTO form_analytics (form_id, event_type, ip_address) 
         VALUES (?, 'view', '127.0.0.1')`,
        [form.id]
      );
      console.log('✅ Database write test successful');
      
      // Clean up test data
      await connection.execute(
        `DELETE FROM form_analytics WHERE form_id = ? AND ip_address = '127.0.0.1' AND event_type = 'view'`,
        [form.id]
      );
    } catch (error) {
      console.log('❌ Database write test failed:', error.message);
    }

    console.log('\n✅ Diagnostic complete!');
    console.log('\nNext steps:');
    console.log('1. Check the backend server logs for detailed error messages');
    console.log('2. Ensure the backend server is running (npm run dev)');
    console.log('3. Verify the token in the URL matches the form access_token');
    console.log('4. Check browser console for the exact error response');

  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

diagnose();
