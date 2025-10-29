// Email Configuration
// Copy these values to your .env file

export const emailConfig = {
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS // Gmail App Password without spaces
};

// Instructions for setting up Gmail App Password:
// 1. Go to your Google Account settings
// 2. Navigate to Security > 2-Step Verification
// 3. At the bottom, select "App passwords"
// 4. Select "Mail" and "Other (custom name)"
// 5. Enter "HR Workflow" as the name
// 6. Copy the generated 16-character password
// 7. Replace 'your-gmail-app-password-here' with this password
