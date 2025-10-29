import { query } from './config/database.js';

async function testFixedQuery() {
  try {
    console.log('🧪 Testing Fixed Email Templates Query...');
    
    const limit = 10;
    const offset = 0;
    
    // Test the fixed query without category filter
    console.log('📊 Testing query without category filter...');
    const templates = await query(
      `SELECT et.*, u.name as created_by_name 
       FROM email_templates et
       LEFT JOIN users u ON et.created_by = u.id
       ORDER BY et.created_at DESC 
       LIMIT ${limit} OFFSET ${offset}`
    );
    
    console.log('✅ Query successful!');
    console.log(`📋 Found ${templates.length} templates:`);
    
    templates.forEach((template, index) => {
      console.log(`${index + 1}. ${template.name} (${template.category || 'General'})`);
      console.log(`   Subject: ${template.subject}`);
      console.log(`   Created by: ${template.created_by_name || 'Unknown'}`);
    });
    
    // Test with category filter
    console.log('\n📊 Testing query with category filter...');
    const categoryTemplates = await query(
      `SELECT et.*, u.name as created_by_name 
       FROM email_templates et
       LEFT JOIN users u ON et.created_by = u.id
       WHERE et.category = ?
       ORDER BY et.created_at DESC 
       LIMIT ${limit} OFFSET ${offset}`,
      ['Interview']
    );
    
    console.log('✅ Category query successful!');
    console.log(`📋 Found ${categoryTemplates.length} Interview templates`);
    
    // Test creating a new template
    console.log('\n🔍 Testing template creation...');
    const newTemplate = {
      name: 'Test Template',
      subject: 'Test Subject',
      content: 'Test content with {{candidate_name}} variable',
      category: 'General',
      variables: JSON.stringify(['candidate_name']),
      created_by: 1
    };
    
    const insertResult = await query(
      `INSERT INTO email_templates (name, subject, content, category, variables, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newTemplate.name, newTemplate.subject, newTemplate.content, newTemplate.category, newTemplate.variables, newTemplate.created_by]
    );
    
    console.log('✅ Template creation successful!');
    console.log('📧 New template ID:', insertResult.insertId);
    
    // Clean up - delete the test template
    await query('DELETE FROM email_templates WHERE id = ?', [insertResult.insertId]);
    console.log('🧹 Test template cleaned up');
    
  } catch (error) {
    console.error('❌ Error testing fixed query:', error);
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

testFixedQuery();








