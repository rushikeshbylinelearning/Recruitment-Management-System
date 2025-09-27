import { query } from './config/database.js';

async function checkTableStructure() {
  try {
    console.log('🔍 Checking email_templates table structure...');
    
    // Get table structure
    const structure = await query('DESCRIBE email_templates');
    console.log('📊 Table structure:');
    structure.forEach(column => {
      console.log(`- ${column.Field}: ${column.Type} (${column.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    
    // Get sample data
    console.log('\n📋 Sample data:');
    const sampleData = await query('SELECT * FROM email_templates LIMIT 2');
    sampleData.forEach((row, index) => {
      console.log(`\nRow ${index + 1}:`);
      Object.keys(row).forEach(key => {
        console.log(`  ${key}: ${row[key]}`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error checking table structure:', error);
  } finally {
    process.exit();
  }
}

checkTableStructure();

