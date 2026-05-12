import pool, { testConnection } from '../config/database.js';
import { generateToken } from '../middleware/tokenValidator.js';

async function seedDefaultForm() {
  let connection;
  try {
    console.log('🔄 Seeding default form...');
    
    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Cannot connect to database.');
      process.exit(1);
    }

    connection = await pool.getConnection();

    // Check if default form already exists
    const [existingForms] = await connection.query(
      "SELECT id FROM forms WHERE slug = 'default-application' LIMIT 1"
    );

    if (existingForms.length > 0) {
      console.log('⚠️  Default form already exists. Skipping...');
      return;
    }

    // Generate access token
    const accessToken = generateToken();

    // Insert default form
    const [formResult] = await connection.query(`
      INSERT INTO forms (name, slug, description, is_active, access_token, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      'Default Candidate Application Form',
      'default-application',
      'Standard candidate intake form with essential fields',
      true,
      accessToken,
      1
    ]);

    const formId = formResult.insertId;
    console.log(`✅ Created default form with ID: ${formId}`);
    console.log(`   Access token: ${accessToken}`);

    // Insert default form fields
    const fields = [
      { label: 'Full Name', field_key: 'name', field_type: 'text', is_required: true, placeholder: 'Enter your full name', order_index: 1 },
      { label: 'Email Address', field_key: 'email', field_type: 'email', is_required: true, placeholder: 'your.email@example.com', order_index: 2 },
      { label: 'Phone Number', field_key: 'phone', field_type: 'tel', is_required: true, placeholder: '+1234567890', order_index: 3 },
      { label: 'Job Profile', field_key: 'position', field_type: 'select', is_required: true, placeholder: null, order_index: 4 },
      { label: 'Years of Experience', field_key: 'experience', field_type: 'number', is_required: true, placeholder: 'e.g., 5', order_index: 5 },
      { label: 'Notice Period (Days)', field_key: 'notice_period', field_type: 'number', is_required: true, placeholder: 'e.g., 30', order_index: 6 },
      { label: 'Current CTC', field_key: 'current_ctc', field_type: 'text', is_required: false, placeholder: 'e.g., $50,000', order_index: 7 },
      { label: 'Expected CTC', field_key: 'expected_ctc', field_type: 'text', is_required: true, placeholder: 'e.g., $60,000', order_index: 8 },
      { label: 'Source', field_key: 'source', field_type: 'select', is_required: false, placeholder: null, order_index: 9, options: JSON.stringify(['Job Portal', 'LinkedIn', 'Referral', 'Company Website', 'Walk-in', 'Campus Recruitment', 'Recruitment Agency', 'Other']) },
      { label: 'Resume', field_key: 'resume', field_type: 'file', is_required: false, placeholder: null, order_index: 10 },
      { label: 'Additional Comments', field_key: 'notes', field_type: 'textarea', is_required: false, placeholder: 'Any additional information...', order_index: 11 }
    ];

    for (const field of fields) {
      await connection.query(`
        INSERT INTO form_fields (form_id, label, field_key, field_type, is_required, options, placeholder, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [formId, field.label, field.field_key, field.field_type, field.is_required, field.options || null, field.placeholder, field.order_index]);
    }

    console.log(`✅ Created ${fields.length} default form fields`);

    // Insert default field mappings
    const mappings = [
      { field_key: 'name', db_column: 'name', excel_column: 'Full Name' },
      { field_key: 'email', db_column: 'email', excel_column: 'Email Address' },
      { field_key: 'phone', db_column: 'phone', excel_column: 'Phone Number' },
      { field_key: 'position', db_column: 'position', excel_column: 'Job Profile' },
      { field_key: 'experience', db_column: 'experience', excel_column: 'Experience (Years)' },
      { field_key: 'notice_period', db_column: 'notice_period', excel_column: 'Notice Period (Days)' },
      { field_key: 'current_ctc', db_column: 'current_ctc', excel_column: 'Current CTC' },
      { field_key: 'expected_ctc', db_column: 'expected_salary', excel_column: 'Expected CTC' },
      { field_key: 'notes', db_column: 'notes', excel_column: 'Comments' },
      { field_key: 'source', db_column: 'source', excel_column: 'Source' }
    ];

    for (const mapping of mappings) {
      await connection.query(`
        INSERT INTO form_field_mappings (form_id, field_key, db_column, excel_column)
        VALUES (?, ?, ?, ?)
      `, [formId, mapping.field_key, mapping.db_column, mapping.excel_column]);
    }

    console.log(`✅ Created ${mappings.length} field mappings`);
    console.log('\n🎉 Default form seeded successfully!');
    console.log(`\n📋 Form URL: /apply/default-application?token=${accessToken}`);

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

seedDefaultForm();
