import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function checkUsers() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'hr_workflow'
    });

    console.log('📊 Checking users table after repair...\n');

    // Get all users
    const [users] = await connection.query('SELECT id, username, email, name, role, status, created_at FROM users');
    
    console.log(`Found ${users.length} user(s):\n`);
    users.forEach(user => {
      console.log(`  ID: ${user.id}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Status: ${user.status}`);
      console.log(`  Created: ${user.created_at}`);
      console.log('  ---');
    });

    if (users.length === 0) {
      console.log('⚠️ No users found! You will need to create an admin user.');
      console.log('Run: node create-admin.js');
    } else if (users.length === 1) {
      console.log('⚠️ Only 1 user remains after repair. Other users were lost due to corruption.');
      console.log('You may need to recreate missing user accounts.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkUsers();
