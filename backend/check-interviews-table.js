import { query } from './config/database.js';

async function checkInterviewsTable() {
  try {
    console.log('Checking if interviews table exists...');
    
    // Check if table exists
    const tables = await query("SHOW TABLES LIKE 'interviews'");
    console.log('Tables found:', tables);
    
    if (tables.length === 0) {
      console.log('Interviews table does not exist. Creating it...');
      
      // Create interviews table
      await query(`
        CREATE TABLE interviews (
          id INT PRIMARY KEY AUTO_INCREMENT,
          candidate_id INT NOT NULL,
          interviewer_id INT NOT NULL,
          scheduled_date DATETIME NOT NULL,
          type ENUM('Video', 'Phone', 'In-Person') NOT NULL,
          status ENUM('Scheduled', 'In Progress', 'Completed', 'Cancelled') DEFAULT 'Scheduled',
          location VARCHAR(255),
          meeting_link TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
          FOREIGN KEY (interviewer_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      
      console.log('Interviews table created successfully!');
    } else {
      console.log('Interviews table already exists.');
      
      // Check table structure
      const structure = await query('DESCRIBE interviews');
      console.log('Table structure:', structure);
    }
    
    // Test a simple query
    const testQuery = await query('SELECT COUNT(*) as count FROM interviews');
    console.log('Interview count:', testQuery[0].count);
    
  } catch (error) {
    console.error('Error checking interviews table:', error);
  }
}

checkInterviewsTable();

