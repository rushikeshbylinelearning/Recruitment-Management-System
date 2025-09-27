import { query } from './config/database.js';

async function setupEmailTemplates() {
  try {
    console.log('Creating email_templates table...');
    
    // Create email_templates table
    await query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(100) NOT NULL DEFAULT 'General',
        is_active BOOLEAN DEFAULT TRUE,
        variables JSON,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_category (category),
        INDEX idx_created_by (created_by),
        INDEX idx_is_active (is_active)
      )
    `);

    console.log('Email templates table created successfully!');

    // Check if sample data already exists
    const existingTemplates = await query('SELECT COUNT(*) as count FROM email_templates');
    
    if (existingTemplates[0].count === 0) {
      console.log('Inserting sample email templates...');
      
      // Insert sample email templates
      await query(`
        INSERT INTO email_templates (name, subject, content, category, created_by) VALUES
        ('Interview Invitation', 'Interview Invitation - {{job_title}} Position', 'Dear {{candidate_name}},\\n\\nThank you for your interest in the {{job_title}} position at {{company_name}}.\\n\\nWe would like to invite you for an interview on {{interview_date}} at {{interview_time}}.\\n\\nPlease confirm your availability.\\n\\nBest regards,\\n{{hr_name}}', 'Interview', 1),
        ('Application Rejection', 'Thank you for your application', 'Dear {{candidate_name}},\\n\\nThank you for your interest in the {{job_title}} position at {{company_name}}.\\n\\nAfter careful consideration, we have decided to move forward with other candidates who more closely match our requirements.\\n\\nWe appreciate your time and interest in our company.\\n\\nBest regards,\\n{{hr_name}}', 'Rejection', 1),
        ('Job Offer', 'Job Offer - {{job_title}} Position', 'Dear {{candidate_name}},\\n\\nCongratulations! We are pleased to offer you the position of {{job_title}} at {{company_name}}.\\n\\nWe are excited about the possibility of you joining our team.\\n\\nPlease let us know your decision by the end of this week.\\n\\nBest regards,\\n{{hr_name}}', 'Offer', 1),
        ('Follow-up Email', 'Follow-up on your application', 'Dear {{candidate_name}},\\n\\nI hope this email finds you well.\\n\\nI wanted to follow up on your application for the {{job_title}} position at {{company_name}}.\\n\\nWe are still in the process of reviewing applications and will get back to you soon.\\n\\nThank you for your patience.\\n\\nBest regards,\\n{{hr_name}}', 'Follow-up', 1)
      `);
      
      console.log('Sample email templates inserted successfully!');
    } else {
      console.log('Sample email templates already exist, skipping insertion.');
    }

    console.log('Email templates setup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error setting up email templates:', error);
    process.exit(1);
  }
}

setupEmailTemplates();

