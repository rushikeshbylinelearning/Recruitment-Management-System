import emailService from './services/emailService.js';

async function testTemplateEmail() {
  console.log('🧪 Testing Template Email Service...');
  
  try {
    // Test template email with variables
    const result = await emailService.sendTemplateEmail(
      'rahulkirad.byline@gmail.com',
      'Hello {{candidate_name}} - {{job_title}} Position',
      'Dear {{candidate_name}},\n\nThank you for your interest in the {{job_title}} position at {{company_name}}.\n\nWe would like to schedule an interview with you.\n\nBest regards,\n{{hr_name}}',
      {
        candidate_name: 'John Doe',
        job_title: 'Software Engineer',
        company_name: 'HR Workflow Management',
        hr_name: 'Rahul Kirad'
      }
    );

    if (result.success) {
      console.log('✅ Template email sent successfully!');
      console.log('📧 Message ID:', result.messageId);
      console.log('📬 Check your inbox for the template email');
    } else {
      console.log('❌ Failed to send template email:', result.error);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testTemplateEmail();



