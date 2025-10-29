import { query, testConnection } from './config/database.js';

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    const connected = await testConnection();
    if (!connected) {
      console.log('❌ Database connection failed');
      return;
    }
    
    console.log('✅ Database connected successfully');
    
    // Test if interviews table exists
    console.log('Checking if interviews table exists...');
    const tables = await query("SHOW TABLES LIKE 'interviews'");
    if (tables.length === 0) {
      console.log('❌ Interviews table does not exist');
      console.log('Creating interviews table...');
      
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS interviews (
          id INT AUTO_INCREMENT PRIMARY KEY,
          candidate_id INT NOT NULL,
          interviewer_id INT NOT NULL,
          scheduled_date DATETIME NOT NULL,
          type VARCHAR(50) NOT NULL,
          status VARCHAR(50) DEFAULT 'Scheduled',
          location VARCHAR(255),
          meeting_link VARCHAR(500),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (candidate_id) REFERENCES candidates(id),
          FOREIGN KEY (interviewer_id) REFERENCES users(id)
        )
      `;
      
      await query(createTableSQL);
      console.log('✅ Interviews table created successfully');
    } else {
      console.log('✅ Interviews table exists');
    }
    
    // Test basic query
    console.log('Testing basic interviews query...');
    const interviews = await query('SELECT * FROM interviews LIMIT 5');
    console.log(`✅ Found ${interviews.length} interviews`);
    
    // Test the problematic query
    console.log('Testing the problematic query...');
    const testQuery = `
      SELECT 
        i.*,
        c.name as candidate_name,
        c.position as candidate_position,
        c.email as candidate_email,
        u.name as interviewer_name,
        u.email as interviewer_email
      FROM interviews i
      LEFT JOIN candidates c ON i.candidate_id = c.id
      LEFT JOIN users u ON i.interviewer_id = u.id
      ORDER BY i.scheduled_date DESC 
      LIMIT ? OFFSET ?
    `;
    
    const result = await query(testQuery, [5, 0]);
    console.log(`✅ Query executed successfully, returned ${result.length} results`);
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('Full error:', error);
  }
}

testDatabase();





