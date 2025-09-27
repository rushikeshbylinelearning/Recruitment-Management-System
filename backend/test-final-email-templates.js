import { query } from './config/database.js';

async function testFinalEmailTemplates() {
  try {
    console.log('🧪 Testing Final Email Templates Functionality...');
    
    const limit = 10;
    const offset = 0;
    
    // Test 1: Get all templates
    console.log('📊 Test 1: Get all templates');
    const allTemplates = await query(
      `SELECT et.*, u.name as created_by_name 
       FROM email_templates et
       LEFT JOIN users u ON et.created_by = u.id
       ORDER BY et.created_at DESC 
       LIMIT ${limit} OFFSET ${offset}`
    );
    
    console.log('✅ All templates query successful!');
    console.log(`📋 Found ${allTemplates.length} templates:`);
    allTemplates.forEach((template, index) => {
      console.log(`${index + 1}. ${template.name} (${template.type})`);
    });
    
    // Test 2: Get templates by type
    console.log('\n📊 Test 2: Get templates by type');
    const interviewTemplates = await query(
      `SELECT et.*, u.name as created_by_name 
       FROM email_templates et
       LEFT JOIN users u ON et.created_by = u.id
       WHERE et.type = ?
       ORDER BY et.created_at DESC 
       LIMIT ${limit} OFFSET ${offset}`,
      ['Interview Invite']
    );
    
    console.log('✅ Type filter query successful!');
    console.log(`📋 Found ${interviewTemplates.length} Interview Invite templates`);
    
    // Test 3: Create a new template
    console.log('\n📊 Test 3: Create new template');
    const newTemplate = {
      name: 'Test Template',
      subject: 'Test Subject',
      content: 'Test content with {{candidate_name}} variable',
      type: 'Custom',
      is_active: 1,
      created_by: 1
    };
    
    const insertResult = await query(
      `INSERT INTO email_templates (name, subject, body, type, is_active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [newTemplate.name, newTemplate.subject, newTemplate.content, newTemplate.type, newTemplate.is_active, newTemplate.created_by]
    );
    
    console.log('✅ Template creation successful!');
    console.log('📧 New template ID:', insertResult.insertId);
    
    // Test 4: Update the template
    console.log('\n📊 Test 4: Update template');
    const updateResult = await query(
      `UPDATE email_templates SET name = ?, subject = ?, body = ? WHERE id = ?`,
      ['Updated Test Template', 'Updated Test Subject', 'Updated content', insertResult.insertId]
    );
    
    console.log('✅ Template update successful!');
    console.log('📝 Rows affected:', updateResult.affectedRows);
    
    // Test 5: Get the updated template
    console.log('\n📊 Test 5: Get updated template');
    const updatedTemplate = await query(
      `SELECT et.*, u.name as created_by_name 
       FROM email_templates et
       LEFT JOIN users u ON et.created_by = u.id
       WHERE et.id = ?`,
      [insertResult.insertId]
    );
    
    console.log('✅ Get template by ID successful!');
    console.log('📋 Updated template:', updatedTemplate[0].name);
    
    // Clean up - delete the test template
    console.log('\n🧹 Cleaning up test template...');
    await query('DELETE FROM email_templates WHERE id = ?', [insertResult.insertId]);
    console.log('✅ Test template cleaned up');
    
    console.log('\n🎉 All email templates tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing email templates:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sql: error.sql
    });
  } finally {
    process.exit();
  }
}

testFinalEmailTemplates();
