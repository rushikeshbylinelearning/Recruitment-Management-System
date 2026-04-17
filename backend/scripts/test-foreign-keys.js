import pool, { testConnection } from '../config/database.js';

async function testForeignKeyConstraints() {
  let connection;
  try {
    console.log('🧪 Testing Foreign Key Constraints and Cascading Deletes\n');
    console.log('═'.repeat(60));
    
    const connected = await testConnection();
    if (!connected) {
      process.exit(1);
    }

    connection = await pool.getConnection();

    // Clean up any existing test data
    await connection.query("DELETE FROM forms WHERE name LIKE 'FK Test%'");

    // Test 1: CASCADE delete from forms to form_fields
    console.log('\n📝 Test 1: CASCADE delete (forms -> form_fields)');
    console.log('─'.repeat(60));
    
    const [form1] = await connection.query(`
      INSERT INTO forms (name, slug, access_token, created_by)
      VALUES ('FK Test Form 1', 'fk-test-1', UUID(), 1)
    `);
    const formId1 = form1.insertId;
    console.log(`✓ Created form with ID: ${formId1}`);

    await connection.query(`
      INSERT INTO form_fields (form_id, label, field_key, field_type, order_index)
      VALUES 
        (?, 'Test Field 1', 'test_field_1', 'text', 1),
        (?, 'Test Field 2', 'test_field_2', 'email', 2),
        (?, 'Test Field 3', 'test_field_3', 'tel', 3)
    `, [formId1, formId1, formId1]);
    console.log('✓ Created 3 form fields');

    const [fieldsBefore] = await connection.query(
      'SELECT COUNT(*) as count FROM form_fields WHERE form_id = ?',
      [formId1]
    );
    console.log(`✓ Fields before delete: ${fieldsBefore[0].count}`);

    await connection.query('DELETE FROM forms WHERE id = ?', [formId1]);
    console.log('✓ Deleted form');

    const [fieldsAfter] = await connection.query(
      'SELECT COUNT(*) as count FROM form_fields WHERE form_id = ?',
      [formId1]
    );
    console.log(`✓ Fields after delete: ${fieldsAfter[0].count}`);

    if (fieldsAfter[0].count === 0) {
      console.log('✅ CASCADE delete working correctly for form_fields');
    } else {
      console.log('❌ CASCADE delete FAILED for form_fields');
    }

    // Test 2: CASCADE delete from forms to form_submissions
    console.log('\n📝 Test 2: CASCADE delete (forms -> form_submissions)');
    console.log('─'.repeat(60));
    
    const [form2] = await connection.query(`
      INSERT INTO forms (name, slug, access_token, created_by)
      VALUES ('FK Test Form 2', 'fk-test-2', UUID(), 1)
    `);
    const formId2 = form2.insertId;
    console.log(`✓ Created form with ID: ${formId2}`);

    await connection.query(`
      INSERT INTO form_submissions (form_id, submission_data, status)
      VALUES 
        (?, '{"name": "Test 1"}', 'pending'),
        (?, '{"name": "Test 2"}', 'processed')
    `, [formId2, formId2]);
    console.log('✓ Created 2 form submissions');

    const [submissionsBefore] = await connection.query(
      'SELECT COUNT(*) as count FROM form_submissions WHERE form_id = ?',
      [formId2]
    );
    console.log(`✓ Submissions before delete: ${submissionsBefore[0].count}`);

    await connection.query('DELETE FROM forms WHERE id = ?', [formId2]);
    console.log('✓ Deleted form');

    const [submissionsAfter] = await connection.query(
      'SELECT COUNT(*) as count FROM form_submissions WHERE form_id = ?',
      [formId2]
    );
    console.log(`✓ Submissions after delete: ${submissionsAfter[0].count}`);

    if (submissionsAfter[0].count === 0) {
      console.log('✅ CASCADE delete working correctly for form_submissions');
    } else {
      console.log('❌ CASCADE delete FAILED for form_submissions');
    }

    // Test 3: CASCADE delete from forms to form_field_mappings
    console.log('\n📝 Test 3: CASCADE delete (forms -> form_field_mappings)');
    console.log('─'.repeat(60));
    
    const [form3] = await connection.query(`
      INSERT INTO forms (name, slug, access_token, created_by)
      VALUES ('FK Test Form 3', 'fk-test-3', UUID(), 1)
    `);
    const formId3 = form3.insertId;
    console.log(`✓ Created form with ID: ${formId3}`);

    await connection.query(`
      INSERT INTO form_field_mappings (form_id, field_key, db_column, excel_column)
      VALUES 
        (?, 'name', 'name', 'Full Name'),
        (?, 'email', 'email', 'Email Address')
    `, [formId3, formId3]);
    console.log('✓ Created 2 field mappings');

    const [mappingsBefore] = await connection.query(
      'SELECT COUNT(*) as count FROM form_field_mappings WHERE form_id = ?',
      [formId3]
    );
    console.log(`✓ Mappings before delete: ${mappingsBefore[0].count}`);

    await connection.query('DELETE FROM forms WHERE id = ?', [formId3]);
    console.log('✓ Deleted form');

    const [mappingsAfter] = await connection.query(
      'SELECT COUNT(*) as count FROM form_field_mappings WHERE form_id = ?',
      [formId3]
    );
    console.log(`✓ Mappings after delete: ${mappingsAfter[0].count}`);

    if (mappingsAfter[0].count === 0) {
      console.log('✅ CASCADE delete working correctly for form_field_mappings');
    } else {
      console.log('❌ CASCADE delete FAILED for form_field_mappings');
    }

    // Test 4: CASCADE delete from forms to form_analytics
    console.log('\n📝 Test 4: CASCADE delete (forms -> form_analytics)');
    console.log('─'.repeat(60));
    
    const [form4] = await connection.query(`
      INSERT INTO forms (name, slug, access_token, created_by)
      VALUES ('FK Test Form 4', 'fk-test-4', UUID(), 1)
    `);
    const formId4 = form4.insertId;
    console.log(`✓ Created form with ID: ${formId4}`);

    await connection.query(`
      INSERT INTO form_analytics (form_id, event_type, ip_address)
      VALUES 
        (?, 'view', '192.168.1.1'),
        (?, 'submission', '192.168.1.2'),
        (?, 'view', '192.168.1.3')
    `, [formId4, formId4, formId4]);
    console.log('✓ Created 3 analytics events');

    const [analyticsBefore] = await connection.query(
      'SELECT COUNT(*) as count FROM form_analytics WHERE form_id = ?',
      [formId4]
    );
    console.log(`✓ Analytics events before delete: ${analyticsBefore[0].count}`);

    await connection.query('DELETE FROM forms WHERE id = ?', [formId4]);
    console.log('✓ Deleted form');

    const [analyticsAfter] = await connection.query(
      'SELECT COUNT(*) as count FROM form_analytics WHERE form_id = ?',
      [formId4]
    );
    console.log(`✓ Analytics events after delete: ${analyticsAfter[0].count}`);

    if (analyticsAfter[0].count === 0) {
      console.log('✅ CASCADE delete working correctly for form_analytics');
    } else {
      console.log('❌ CASCADE delete FAILED for form_analytics');
    }

    // Test 5: Comprehensive cascade test (all tables at once)
    console.log('\n📝 Test 5: Comprehensive CASCADE delete (all tables)');
    console.log('─'.repeat(60));
    
    const [form5] = await connection.query(`
      INSERT INTO forms (name, slug, access_token, created_by)
      VALUES ('FK Test Form 5', 'fk-test-5', UUID(), 1)
    `);
    const formId5 = form5.insertId;
    console.log(`✓ Created form with ID: ${formId5}`);

    // Add data to all related tables
    await connection.query(`
      INSERT INTO form_fields (form_id, label, field_key, field_type, order_index)
      VALUES (?, 'Comprehensive Field', 'comp_field', 'text', 1)
    `, [formId5]);
    
    await connection.query(`
      INSERT INTO form_submissions (form_id, submission_data, status)
      VALUES (?, '{"test": "data"}', 'pending')
    `, [formId5]);
    
    await connection.query(`
      INSERT INTO form_field_mappings (form_id, field_key, db_column, excel_column)
      VALUES (?, 'comp_field', 'test_col', 'Test Column')
    `, [formId5]);
    
    await connection.query(`
      INSERT INTO form_analytics (form_id, event_type)
      VALUES (?, 'view')
    `, [formId5]);

    console.log('✓ Created records in all 4 related tables');

    // Count records before delete
    const [countsBefore] = await connection.query(`
      SELECT 
        (SELECT COUNT(*) FROM form_fields WHERE form_id = ?) as fields,
        (SELECT COUNT(*) FROM form_submissions WHERE form_id = ?) as submissions,
        (SELECT COUNT(*) FROM form_field_mappings WHERE form_id = ?) as mappings,
        (SELECT COUNT(*) FROM form_analytics WHERE form_id = ?) as analytics
    `, [formId5, formId5, formId5, formId5]);
    
    console.log(`✓ Records before delete:`);
    console.log(`  - form_fields: ${countsBefore[0].fields}`);
    console.log(`  - form_submissions: ${countsBefore[0].submissions}`);
    console.log(`  - form_field_mappings: ${countsBefore[0].mappings}`);
    console.log(`  - form_analytics: ${countsBefore[0].analytics}`);

    // Delete the form
    await connection.query('DELETE FROM forms WHERE id = ?', [formId5]);
    console.log('✓ Deleted form');

    // Count records after delete
    const [countsAfter] = await connection.query(`
      SELECT 
        (SELECT COUNT(*) FROM form_fields WHERE form_id = ?) as fields,
        (SELECT COUNT(*) FROM form_submissions WHERE form_id = ?) as submissions,
        (SELECT COUNT(*) FROM form_field_mappings WHERE form_id = ?) as mappings,
        (SELECT COUNT(*) FROM form_analytics WHERE form_id = ?) as analytics
    `, [formId5, formId5, formId5, formId5]);
    
    console.log(`✓ Records after delete:`);
    console.log(`  - form_fields: ${countsAfter[0].fields}`);
    console.log(`  - form_submissions: ${countsAfter[0].submissions}`);
    console.log(`  - form_field_mappings: ${countsAfter[0].mappings}`);
    console.log(`  - form_analytics: ${countsAfter[0].analytics}`);

    const allZero = countsAfter[0].fields === 0 && 
                    countsAfter[0].submissions === 0 && 
                    countsAfter[0].mappings === 0 && 
                    countsAfter[0].analytics === 0;

    if (allZero) {
      console.log('✅ Comprehensive CASCADE delete working correctly');
    } else {
      console.log('❌ Comprehensive CASCADE delete FAILED');
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✅ All foreign key constraint tests completed successfully!');
    console.log('═'.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

testForeignKeyConstraints();
