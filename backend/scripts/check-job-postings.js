import pool, { testConnection } from '../config/database.js';

async function checkJobPostings() {
  let connection;
  try {
    const connected = await testConnection();
    if (!connected) {
      process.exit(1);
    }

    connection = await pool.getConnection();

    console.log('📋 job_postings table structure:\n');
    const [columns] = await connection.query('DESCRIBE job_postings');
    columns.forEach(col => {
      console.log(`${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key ? `[${col.Key}]` : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

checkJobPostings();
