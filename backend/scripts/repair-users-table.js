import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function repairUsersTable() {
  let connection;
  
  try {
    console.log('🔧 Connecting to database...');
    
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'hr_workflow'
    });

    console.log('✅ Connected to database');
    console.log('🔧 Attempting to repair users table...');

    // Repair the users table
    const [repairResult] = await connection.query('REPAIR TABLE users');
    console.log('Repair result:', repairResult);

    // Check if repair was successful
    if (repairResult && repairResult[0]) {
      const status = repairResult[0].Msg_text;
      if (status === 'OK' || status.includes('successfully')) {
        console.log('✅ Users table repaired successfully!');
      } else {
        console.log('⚠️ Repair completed with message:', status);
      }
    }

    // Verify table is accessible
    console.log('🔍 Verifying table accessibility...');
    const [rows] = await connection.query('SELECT COUNT(*) as count FROM users');
    console.log(`✅ Table is accessible. Found ${rows[0].count} users.`);

    // Optimize the table for good measure
    console.log('🔧 Optimizing table...');
    await connection.query('OPTIMIZE TABLE users');
    console.log('✅ Table optimized');

  } catch (error) {
    console.error('❌ Error repairing table:', error.message);
    console.error('Full error:', error);
    
    // If REPAIR doesn't work, suggest alternative
    console.log('\n⚠️ If repair failed, you may need to:');
    console.log('1. Stop the Node.js server');
    console.log('2. Run this command in MySQL:');
    console.log('   USE hr_workflow;');
    console.log('   REPAIR TABLE users;');
    console.log('3. Or use myisamchk utility if table is MyISAM');
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the repair
repairUsersTable();
