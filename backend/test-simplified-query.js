import { query } from './config/database.js';

async function testSimplifiedQuery() {
  try {
    console.log('🧪 Testing Simplified Email Templates Query...');
    
    const limit = 10;
    const offset = 0;
    
    // Test the simplified query without category filter
    console.log('📊 Testing query without category filter...');
    const templates = await query(
      `SELECT et.*, u.name as created_by_name 
       FROM email_templates et
       LEFT JOIN users u ON et.created_by = u.id
       ORDER BY et.created_at DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
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
       LIMIT ? OFFSET ?`,
      ['Interview', limit, offset]
    );
    
    console.log('✅ Category query successful!');
    console.log(`📋 Found ${categoryTemplates.length} Interview templates`);
    
  } catch (error) {
    console.error('❌ Error testing simplified query:', error);
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

testSimplifiedQuery();



