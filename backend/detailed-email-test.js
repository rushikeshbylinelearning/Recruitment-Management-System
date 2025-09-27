import nodemailer from 'nodemailer';
import { emailConfig } from './email-config.js';

console.log('🔍 Detailed Email Configuration Test');
console.log('=====================================');

// Display current configuration
console.log('📧 Email User:', emailConfig.EMAIL_USER);
console.log('🔑 Password Length:', emailConfig.EMAIL_PASS.length);
console.log('🔑 Password (masked):', emailConfig.EMAIL_PASS.substring(0, 4) + '****' + emailConfig.EMAIL_PASS.substring(emailConfig.EMAIL_PASS.length - 4));

// Test different authentication methods
async function testAuthentication() {
  console.log('\n🧪 Testing Authentication Methods...');
  
  // Method 1: Basic Gmail SMTP
  console.log('\n1️⃣ Testing Basic Gmail SMTP...');
  try {
    const transporter1 = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailConfig.EMAIL_USER,
        pass: emailConfig.EMAIL_PASS
      }
    });
    
    await transporter1.verify();
    console.log('✅ Basic Gmail SMTP: SUCCESS');
    return transporter1;
  } catch (error) {
    console.log('❌ Basic Gmail SMTP: FAILED');
    console.log('   Error:', error.message);
  }
  
  // Method 2: Explicit SMTP settings
  console.log('\n2️⃣ Testing Explicit SMTP Settings...');
  try {
    const transporter2 = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: emailConfig.EMAIL_USER,
        pass: emailConfig.EMAIL_PASS
      }
    });
    
    await transporter2.verify();
    console.log('✅ Explicit SMTP: SUCCESS');
    return transporter2;
  } catch (error) {
    console.log('❌ Explicit SMTP: FAILED');
    console.log('   Error:', error.message);
  }
  
  // Method 3: SSL/TLS
  console.log('\n3️⃣ Testing SSL/TLS...');
  try {
    const transporter3 = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: emailConfig.EMAIL_USER,
        pass: emailConfig.EMAIL_PASS
      }
    });
    
    await transporter3.verify();
    console.log('✅ SSL/TLS: SUCCESS');
    return transporter3;
  } catch (error) {
    console.log('❌ SSL/TLS: FAILED');
    console.log('   Error:', error.message);
  }
  
  return null;
}

// Test sending email
async function testSendingEmail(transporter) {
  if (!transporter) {
    console.log('\n❌ No working transporter found. Cannot test email sending.');
    return;
  }
  
  console.log('\n📧 Testing Email Sending...');
  try {
    const result = await transporter.sendMail({
      from: emailConfig.EMAIL_USER,
      to: emailConfig.EMAIL_USER, // Send to yourself
      subject: 'Test Email from HR Workflow System',
      text: 'This is a test email to verify the email service is working.',
      html: '<h2>✅ Email Service Test</h2><p>This is a test email to verify the email service is working.</p>'
    });
    
    console.log('✅ Email sent successfully!');
    console.log('📧 Message ID:', result.messageId);
    console.log('📬 Check your inbox at:', emailConfig.EMAIL_USER);
    
  } catch (error) {
    console.log('❌ Failed to send email:', error.message);
  }
}

// Run the tests
async function runTests() {
  const transporter = await testAuthentication();
  await testSendingEmail(transporter);
  
  console.log('\n📋 Troubleshooting Tips:');
  console.log('1. Verify 2-Factor Authentication is enabled');
  console.log('2. Check if the App Password was generated correctly');
  console.log('3. Ensure the account is not locked or restricted');
  console.log('4. Try logging into Gmail normally first');
  console.log('5. Check if the account has any security alerts');
}

runTests();

