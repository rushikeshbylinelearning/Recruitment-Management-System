import { emailConfig } from './email-config.js';

console.log('🔍 Email Configuration Diagnosis');
console.log('================================');
console.log('📧 Email User:', emailConfig.EMAIL_USER);
console.log('🔑 Email Pass Length:', emailConfig.EMAIL_PASS.length);
console.log('🔑 Email Pass (first 4 chars):', emailConfig.EMAIL_PASS.substring(0, 4) + '****');
console.log('🔑 Email Pass (last 4 chars):', '****' + emailConfig.EMAIL_PASS.substring(emailConfig.EMAIL_PASS.length - 4));
console.log('🔑 Has Spaces:', emailConfig.EMAIL_PASS.includes(' '));

console.log('\n📋 Troubleshooting Checklist:');
console.log('1. ✅ Gmail account: rahulkirad.bylinelearning.com');
console.log('2. ❓ 2-Factor Authentication enabled?');
console.log('3. ❓ App Password generated correctly?');
console.log('4. ❓ App Password copied without spaces?');

console.log('\n🔧 Common Issues:');
console.log('- App password should be 16 characters without spaces');
console.log('- 2FA must be enabled on the Gmail account');
console.log('- App password should be generated for "Mail" service');
console.log('- Account should not be in "Less secure app access" mode');

console.log('\n📝 Steps to Fix:');
console.log('1. Go to https://myaccount.google.com/');
console.log('2. Security → 2-Step Verification (enable if not enabled)');
console.log('3. Security → App passwords');
console.log('4. Generate new app password for "Mail"');
console.log('5. Copy the 16-character password without spaces');
console.log('6. Update email-config.js with the new password');

// Test if the password format looks correct
const passwordPattern = /^[a-z]{4}\s[a-z]{4}\s[a-z]{4}\s[a-z]{4}$/;
const passwordWithoutSpaces = emailConfig.EMAIL_PASS.replace(/\s/g, '');

console.log('\n🔍 Password Analysis:');
console.log('- Original format matches pattern:', passwordPattern.test(emailConfig.EMAIL_PASS));
console.log('- Length without spaces:', passwordWithoutSpaces.length);
console.log('- Should be exactly 16 characters:', passwordWithoutSpaces.length === 16);
console.log('- Contains only letters:', /^[a-z]+$/.test(passwordWithoutSpaces));

if (passwordWithoutSpaces.length === 16 && /^[a-z]+$/.test(passwordWithoutSpaces)) {
  console.log('✅ Password format looks correct!');
  console.log('💡 Try using the password without spaces in email-config.js:');
  console.log('EMAIL_PASS: "' + passwordWithoutSpaces + '"');
} else {
  console.log('❌ Password format might be incorrect');
  console.log('💡 Please generate a new app password from Google Account settings');
}

