import emailService from './services/emailService.js';

async function testEmail() {
  console.log('🧪 Testing Email Service...');
  console.log('📧 Using credentials from email-config.js');
  
  try {
    // Test with a simple email
    const result = await emailService.sendEmail(
      'rahulkirad.byline@gmail.com', // Send to yourself for testing
      'Test Email from HR Workflow System',
      'This is a test email to verify that the email service is working correctly.',
      '<h2>✅ Email Service Test</h2><p>This is a test email to verify that the email service is working correctly.</p><p><strong>If you receive this email, the email service is working properly!</strong></p>'
    );

    if (result.success) {
      console.log('✅ SUCCESS: Email sent successfully!');
      console.log('📧 Message ID:', result.messageId);
      console.log('📬 Check your inbox at rahulkirad.bylinelearning.com');
    } else {
      console.log('❌ FAILED: Could not send email');
      console.log('🔍 Error:', result.error);
    }
  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
}

testEmail();
