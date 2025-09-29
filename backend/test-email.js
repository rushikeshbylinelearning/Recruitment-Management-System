import emailService from './services/emailService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEmailService() {
  console.log('Testing Email Service...');
  console.log('Email User:', process.env.EMAIL_USER);
  console.log('Email Pass configured:', !!process.env.EMAIL_PASS);
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Email credentials not configured!');
    console.log('Please add the following to your .env file:');
    console.log('EMAIL_USER=rahulkirad.bylinelearning.com');
    console.log('EMAIL_PASS=your-gmail-app-password-here');
    return;
  }

  try {
    // Test basic email sending
    console.log('\n📧 Testing basic email sending...');
    const result = await emailService.sendEmail(
      'test@example.com', // Replace with your email for testing
      'Test Email from HR Workflow',
      'This is a test email from the HR Workflow Management system.',
      '<h2>Test Email</h2><p>This is a test email from the HR Workflow Management system.</p>'
    );

    if (result.success) {
      console.log('✅ Email sent successfully!');
      console.log('Message ID:', result.messageId);
    } else {
      console.log('❌ Failed to send email:', result.error);
    }

    // Test template email sending
    console.log('\n📧 Testing template email sending...');
    const templateResult = await emailService.sendTemplateEmail(
      'test@example.com', // Replace with your email for testing
      'Hello {{candidate_name}} - {{job_title}} Position',
      'Dear {{candidate_name}},\n\nThank you for your interest in the {{job_title}} position.\n\nBest regards,\n{{hr_name}}',
      {
        candidate_name: 'John Doe',
        job_title: 'Software Engineer',
        hr_name: 'Jane Smith'
      }
    );

    if (templateResult.success) {
      console.log('✅ Template email sent successfully!');
      console.log('Message ID:', templateResult.messageId);
    } else {
      console.log('❌ Failed to send template email:', templateResult.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testEmailService();
