/**
 * Test script to debug form submission error
 */

import { query, transaction } from './config/database.js';
import formSubmissionProcessor from './services/formSubmissionProcessor.js';

async function testFormSubmission() {
  console.log('🔍 Testing form submission process...\n');

  try {
    // Step 1: Check if forms table exists and has data
    console.log('1. Checking forms table...');
    const forms = await query('SELECT * FROM forms WHERE slug = ?', ['default-application']);
    console.log('Forms found:', forms.length);
    if (forms.length > 0) {
      console.log('Form details:', forms[0]);
    } else {
      console.log('❌ No form found with slug "default-application"');
      return;
    }

    // Step 2: Check form_fields table
    console.log('\n2. Checking form_fields table...');
    const fields = await query(
      'SELECT * FROM form_fields WHERE form_id = ? AND is_active = TRUE',
      [forms[0].id]
    );
    console.log('Form fields found:', fields.length);
    fields.forEach(field => {
      console.log(`  - ${field.field_key} (${field.field_type}, required: ${field.is_required})`);
    });

    // Step 3: Check candidates table structure
    console.log('\n3. Checking candidates table structure...');
    const candidatesStructure = await query('DESCRIBE candidates');
    console.log('Candidates table columns:');
    candidatesStructure.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}, null: ${col.Null})`);
    });

    // Step 4: Check form_submissions table structure
    console.log('\n4. Checking form_submissions table structure...');
    const submissionsStructure = await query('DESCRIBE form_submissions');
    console.log('Form submissions table columns:');
    submissionsStructure.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}, null: ${col.Null})`);
    });

    // Step 5: Test a sample submission
    console.log('\n5. Testing sample submission...');
    const testData = {
      name: 'Test Candidate',
      email: 'test' + Date.now() + '@example.com',
      phone: '1234567890',
      position: 'Test Position',
      experience: '2 years',
      expected_ctc: '500000',
      notice_period: '30 days',
      location: 'Test Location'
    };

    console.log('Test data:', testData);
    
    const result = await formSubmissionProcessor.processSubmission(
      forms[0].id,
      testData,
      null,
      '127.0.0.1',
      'Test User Agent'
    );

    console.log('\n✅ Submission result:', result);

    if (result.success) {
      // Clean up test data
      console.log('\n6. Cleaning up test data...');
      await query('DELETE FROM candidates WHERE email = ?', [testData.email]);
      await query('DELETE FROM form_submissions WHERE candidate_id = ?', [result.candidateId]);
      console.log('Test data cleaned up');
    }

  } catch (error) {
    console.error('\n❌ Error during test:', error);
    console.error('Error stack:', error.stack);
  }

  process.exit(0);
}

testFormSubmission();
