import { query, testConnection } from './config/database.js';

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Database connection failed');
      return;
    }
    
    console.log('✅ Database connected successfully');
    
    // Check if users table exists and has data
    const users = await query('SELECT COUNT(*) as count FROM users');
    console.log(`Users in database: ${users[0].count}`);
    
    if (users[0].count > 0) {
      const userList = await query('SELECT id, username, email, name, role FROM users LIMIT 5');
      console.log('Sample users:');
      userList.forEach(user => {
        console.log(`- ${user.name} (${user.username}) - ${user.role}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testDatabase();
