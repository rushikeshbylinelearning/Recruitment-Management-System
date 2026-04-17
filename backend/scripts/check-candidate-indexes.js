import pool from '../config/database.js';

async function checkIndexes() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    console.log('Checking indexes on candidates table...\n');
    
    // Get all indexes on candidates table
    const [indexes] = await connection.query(`
      SHOW INDEX FROM candidates
    `);
    
    console.log('All indexes on candidates table:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.Key_name} on column ${idx.Column_name} (Non_unique: ${idx.Non_unique})`);
    });
    
    // Check specifically for phone and email indexes
    const phoneIndex = indexes.find(idx => idx.Key_name === 'idx_phone');
    const emailIndex = indexes.find(idx => idx.Key_name === 'idx_email');
    
    console.log('\n--- Index Status ---');
    console.log(`Phone index (idx_phone): ${phoneIndex ? '✓ EXISTS' : '✗ MISSING'}`);
    console.log(`Email index (idx_email): ${emailIndex ? '✓ EXISTS' : '✗ MISSING'}`);
    
  } catch (error) {
    console.error('Error checking indexes:', error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    process.exit(0);
  }
}

checkIndexes();
