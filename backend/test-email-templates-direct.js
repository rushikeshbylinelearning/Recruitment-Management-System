import { query } from './config/database.js';

async function testEmailTemplatesDirect() {
  try {
    console.log('🧪 Testing Email Templates Database Query...');
    
    // Test the exact query that was failing
    const page = 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    const category = '';
    
    let whereClause = 'WHERE 1=1';
    let params = [];
    
    if (category) {
      whereClause += ' AND category = ?';
      params.push(category);
    }
    
    console.log('📊 Query parameters:');
    console.log('- page:', page);
    console.log('- limit:', limit);
    console.log('- offset:', offset);
    console.log('- category:', category);
    console.log('- whereClause:', whereClause);
    console.log('- params:', params);
    
    // Get total count
    console.log('\n🔍 Testing count query...');
    const countResult = await query(
      `SELECT COUNT(*) as total FROM email_templates ${whereClause}`,
      params
    );
    const total = countResult[0].total;
    console.log('✅ Count query successful. Total templates:', total);
    
    // Get templates with the fixed query
    console.log('\n🔍 Testing templates query...');
    const templates = await query(
      `SELECT et.*, u.name as created_by_name 
       FROM email_templates et
       LEFT JOIN users u ON et.created_by = u.id
       ${whereClause}
       ORDER BY et.created_at DESC 
       LIMIT ? OFFSET ?`,
      params.concat([limit, offset])
    );
    
    console.log('✅ Templates query successful!');
    console.log(`📋 Found ${templates.length} templates:`);
    
    templates.forEach((template, index) => {
      console.log(`${index + 1}. ${template.name} (${template.category || 'General'})`);
      console.log(`   Subject: ${template.subject}`);
      console.log(`   Created by: ${template.created_by_name || 'Unknown'}`);
    });
    
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

testEmailTemplatesDirect();
