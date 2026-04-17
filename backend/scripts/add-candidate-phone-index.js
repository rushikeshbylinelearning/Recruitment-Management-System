import pool from '../config/database.js';

async function addPhoneIndex() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    console.log('Task 16.1: Creating indexes on candidates table\n');
    
    // Check if phone index exists
    const [phoneIndexCheck] = await connection.query(`
      SELECT COUNT(1) as count
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE table_schema = DATABASE() 
      AND table_name = 'candidates' 
      AND index_name = 'idx_phone'
    `);
    
    const phoneIndexExists = phoneIndexCheck[0].count > 0;
    
    // Check if email index exists
    const [emailIndexCheck] = await connection.query(`
      SELECT COUNT(1) as count
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE table_schema = DATABASE() 
      AND table_name = 'candidates' 
      AND index_name = 'idx_email'
    `);
    
    const emailIndexExists = emailIndexCheck[0].count > 0;
    
    console.log('--- Current Index Status ---');
    console.log(`Phone index (idx_phone): ${phoneIndexExists ? '✓ EXISTS' : '✗ MISSING'}`);
    console.log(`Email index (idx_email): ${emailIndexExists ? '✓ EXISTS' : '✗ MISSING'}`);
    console.log('');
    
    // Add phone index if missing
    if (!phoneIndexExists) {
      console.log('Creating phone index...');
      await connection.query('ALTER TABLE candidates ADD INDEX idx_phone (phone)');
      console.log('✓ Phone index created successfully');
    } else {
      console.log('Phone index already exists, skipping creation');
    }
    
    // Add email index if missing
    if (!emailIndexExists) {
      console.log('Creating email index...');
      await connection.query('ALTER TABLE candidates ADD INDEX idx_email (email)');
      console.log('✓ Email index created successfully');
    } else {
      console.log('Email index already exists, skipping creation');
    }
    
    // Verify all indexes
    console.log('\n--- Verifying All Indexes on candidates table ---');
    const [allIndexes] = await connection.query('SHOW INDEX FROM candidates');
    
    const uniqueIndexes = [...new Set(allIndexes.map(idx => idx.Key_name))];
    uniqueIndexes.forEach(indexName => {
      const columns = allIndexes
        .filter(idx => idx.Key_name === indexName)
        .map(idx => idx.Column_name)
        .join(', ');
      console.log(`  - ${indexName} (${columns})`);
    });
    
    console.log('\n✅ Task 16.1 completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    process.exit(0);
  }
}

addPhoneIndex();
