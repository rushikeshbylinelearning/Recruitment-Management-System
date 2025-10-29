import { query } from './config/database.js';

async function testBasicQuery() {
  try {
    console.log('🧪 Testing Basic Database Query...');
    
    // Test 1: Simple select without parameters
    console.log('📊 Test 1: Simple select without parameters');
    const result1 = await query('SELECT * FROM email_templates LIMIT 3');
    console.log('✅ Simple query successful!');
    console.log(`📋 Found ${result1.length} templates`);
    
    // Test 2: Simple select with one parameter
    console.log('\n📊 Test 2: Simple select with one parameter');
    const result2 = await query('SELECT * FROM email_templates WHERE id = ?', [1]);
    console.log('✅ Parameter query successful!');
    console.log(`📋 Found ${result2.length} templates with id=1`);
    
    // Test 3: Simple select with LIMIT parameter
    console.log('\n📊 Test 3: Simple select with LIMIT parameter');
    const result3 = await query('SELECT * FROM email_templates LIMIT ?', [2]);
    console.log('✅ LIMIT query successful!');
    console.log(`📋 Found ${result3.length} templates with LIMIT 2`);
    
    // Test 4: Simple select with LIMIT and OFFSET parameters
    console.log('\n📊 Test 4: Simple select with LIMIT and OFFSET parameters');
    const result4 = await query('SELECT * FROM email_templates LIMIT ? OFFSET ?', [2, 0]);
    console.log('✅ LIMIT OFFSET query successful!');
    console.log(`📋 Found ${result4.length} templates with LIMIT 2 OFFSET 0`);
    
    // Test 5: Complex query with JOIN
    console.log('\n📊 Test 5: Complex query with JOIN');
    const result5 = await query(`
      SELECT et.id, et.name, et.subject, u.name as created_by_name 
      FROM email_templates et
      LEFT JOIN users u ON et.created_by = u.id
      LIMIT 3
    `);
    console.log('✅ JOIN query successful!');
    console.log(`📋 Found ${result5.length} templates with JOIN`);
    
    // Test 6: Complex query with JOIN and parameters
    console.log('\n📊 Test 6: Complex query with JOIN and parameters');
    const result6 = await query(`
      SELECT et.id, et.name, et.subject, u.name as created_by_name 
      FROM email_templates et
      LEFT JOIN users u ON et.created_by = u.id
      LIMIT ? OFFSET ?
    `, [2, 0]);
    console.log('✅ JOIN with parameters query successful!');
    console.log(`📋 Found ${result6.length} templates with JOIN and parameters`);
    
  } catch (error) {
    console.error('❌ Error testing basic query:', error);
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

testBasicQuery();








