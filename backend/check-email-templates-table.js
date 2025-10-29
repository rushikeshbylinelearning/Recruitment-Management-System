import { query } from './config/database.js';

async function checkEmailTemplatesTable() {
  try {
    console.log('🔍 Checking email_templates table...');
    
    // Check if table exists
    const tableExists = await query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'email_templates'
    `);
    
    if (tableExists[0].count === 0) {
      console.log('❌ email_templates table does not exist. Creating it...');
      
      // Create the table
      await query(`
        CREATE TABLE email_templates (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          subject VARCHAR(500) NOT NULL,
          content TEXT NOT NULL,
          category ENUM('General', 'Interview', 'Rejection', 'Offer', 'Follow-up') DEFAULT 'General',
          is_active BOOLEAN DEFAULT TRUE,
          variables JSON,
          created_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      
      console.log('✅ email_templates table created successfully!');
      
      // Insert sample data
      console.log('📝 Inserting sample email templates...');
      
      await query(`
        INSERT INTO email_templates (name, subject, content, category, variables, created_by)
        VALUES 
        ('Interview Invitation', 'Interview Invitation for {{job_title}} Position', 
         'Dear {{candidate_name}},\n\nThank you for your interest in the {{job_title}} position at {{company_name}}. We would like to invite you for an interview on {{interview_date}} at {{interview_time}}.\n\nPlease let us know if this time works for you.\n\nBest regards,\n{{hr_name}}', 
         'Interview', 
         '["candidate_name", "job_title", "company_name", "interview_date", "interview_time", "hr_name"]', 
         1),
        ('Application Rejection', 'Update on your application for {{job_title}} at {{company_name}}', 
         'Dear {{candidate_name}},\n\nThank you for your application for the {{job_title}} position at {{company_name}}. We appreciate you taking the time to interview with us.\n\nWhile your qualifications are impressive, we have decided to move forward with other candidates at this time. We wish you the best in your job search.\n\nSincerely,\n{{hr_name}}', 
         'Rejection', 
         '["candidate_name", "job_title", "company_name", "hr_name"]', 
         1),
        ('Job Offer', 'Job Offer for {{job_title}} Position', 
         'Dear {{candidate_name}},\n\nWe are pleased to offer you the position of {{job_title}} at {{company_name}}. We believe your skills and experience would be a great asset to our team.\n\nMore details about the offer, including salary and benefits, will be sent in a separate official offer letter. Please respond by [date] to accept this offer.\n\nCongratulations!\n{{hr_name}}', 
         'Offer', 
         '["candidate_name", "job_title", "company_name", "hr_name"]', 
         1)
      `);
      
      console.log('✅ Sample email templates inserted successfully!');
      
    } else {
      console.log('✅ email_templates table exists');
      
      // Check if table has data
      const templateCount = await query('SELECT COUNT(*) as count FROM email_templates');
      console.log(`📊 Found ${templateCount[0].count} email templates in the table`);
    }
    
    // Test a simple query
    console.log('🧪 Testing email templates query...');
    const testQuery = await query(`
      SELECT et.*, u.name as created_by_name 
      FROM email_templates et
      LEFT JOIN users u ON et.created_by = u.id
      ORDER BY et.created_at DESC 
      LIMIT 5
    `);
    
    console.log('✅ Query test successful!');
    console.log('📋 Sample templates:');
    testQuery.forEach((template, index) => {
      console.log(`${index + 1}. ${template.name} (${template.category})`);
    });
    
  } catch (error) {
    console.error('❌ Error checking email_templates table:', error);
  } finally {
    process.exit();
  }
}

checkEmailTemplatesTable();








