/**
 * Migration: Add "Source" select field to the Default Candidate Application Form
 * Run once to update existing installations.
 */

import pool, { testConnection } from '../config/database.js';

async function addSourceField() {
  let connection;
  try {
    const connected = await testConnection();
    if (!connected) { console.error('❌ Cannot connect to database.'); process.exit(1); }

    connection = await pool.getConnection();

    // Get the default form ID
    const [forms] = await connection.query(
      "SELECT id FROM forms WHERE slug = 'default-application' LIMIT 1"
    );

    if (forms.length === 0) {
      console.log('⚠️  Default form not found. Run seed-default-form.js first.');
      return;
    }

    const formId = forms[0].id;

    // Check if source field already exists
    const [existing] = await connection.query(
      "SELECT id FROM form_fields WHERE form_id = ? AND field_key = 'source' LIMIT 1",
      [formId]
    );

    if (existing.length > 0) {
      console.log('⚠️  Source field already exists. Skipping.');
      return;
    }

    // Shift resume and notes order_index up by 1 to make room
    await connection.query(
      "UPDATE form_fields SET order_index = order_index + 1 WHERE form_id = ? AND order_index >= 9",
      [formId]
    );

    const sourceOptions = JSON.stringify([
      'Job Portal', 'LinkedIn', 'Referral', 'Company Website',
      'Walk-in', 'Campus Recruitment', 'Recruitment Agency', 'Other'
    ]);

    await connection.query(
      `INSERT INTO form_fields (form_id, label, field_key, field_type, is_required, options, placeholder, order_index)
       VALUES (?, 'Source', 'source', 'select', FALSE, ?, 'How did you hear about us?', 9)`,
      [formId, sourceOptions]
    );

    console.log('✅ Source field added to Default Candidate Application Form.');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

addSourceField();
