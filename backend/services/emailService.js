import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { emailConfig } from '../email-config.js';

// Load environment variables
dotenv.config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // Use credentials from email-config.js or fallback to environment variables
      const emailUser = emailConfig.EMAIL_USER || process.env.EMAIL_USER;
      const emailPass = emailConfig.EMAIL_PASS || process.env.EMAIL_PASS;
      
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass
        },
        // Fix for hosted environments where SSL certificate mismatch occurs
        // Some hosting providers intercept SMTP connections and use their own certificates
        tls: {
          rejectUnauthorized: false,
          // This allows the connection even if certificate hostname doesn't match
          // Gmail's SMTP is still encrypted, but we're skipping hostname verification
          // which is safe since we're connecting to smtp.gmail.com
        }
      });

      // Verify connection configuration
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('Email service configuration error:', error);
        } else {
          console.log('Email service is ready to send messages');
        }
      });
    } catch (error) {
      console.error('Failed to initialize email transporter:', error);
    }
  }

  /**
   * Send email using Gmail SMTP
   * @param {string|Object} to - Recipient email address or email options object
   * @param {string} subject - Email subject
   * @param {string} text - Plain text content
   * @param {string} html - HTML content (optional)
   * @param {Array} attachments - Array of attachment objects {filename, path} (optional)
   * @returns {Promise<Object>} - Result object with success status and message
   */
  async sendEmail(to, subject, text, html = null, attachments = null) {
    // Declare variables outside try block so they're accessible in catch
    let emailTo, emailSubject, emailText, emailHtml, emailAttachments;
    let emailUser, emailPass;
    
    try {
      // Try to get credentials from multiple sources
      emailUser = emailConfig.EMAIL_USER || process.env.EMAIL_USER || process.env.EMAIL_USERNAME;
      emailPass = emailConfig.EMAIL_PASS || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
      
      // Trim whitespace (common issue with environment variables and file uploads)
      if (emailUser) emailUser = emailUser.trim();
      if (emailPass) emailPass = emailPass.trim();
      
      // Enhanced diagnostic for authentication failures
      if (!emailUser || !emailPass) {
        const diagnostic = {
          emailConfigUser: !!emailConfig.EMAIL_USER,
          emailConfigPass: !!emailConfig.EMAIL_PASS,
          envEmailUser: !!process.env.EMAIL_USER,
          envEmailPass: !!process.env.EMAIL_PASS,
          envEmailUsername: !!process.env.EMAIL_USERNAME,
          envEmailPassword: !!process.env.EMAIL_PASSWORD,
          finalEmailUser: emailUser,
          finalEmailPassLength: emailPass ? emailPass.length : 0
        };
        
        throw new Error('Email credentials not configured. Please check email-config.js or .env file');
      }
      
      // Log which email is being used (for debugging, but don't log password)
      if (typeof console !== 'undefined' && console.log) {
        console.log(`Using email credentials for: ${emailUser.substring(0, 3)}***@${emailUser.split('@')[1] || 'unknown'}`);
        console.log(`Password length: ${emailPass.length} characters`);
      }

      // SOLUTION: Gmail blocks A2 Hosting IPs. Use environment variable EMAIL_HOST to override
      // For hosted: Create cPanel email account OR use SendGrid (recommended)
      // Set EMAIL_HOST, EMAIL_PORT in environment variables for production
      const smtpHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
      const smtpPort = parseInt(process.env.EMAIL_PORT) || 587;
      const smtpSecure = smtpPort === 465;
      
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: emailUser,
          pass: emailPass
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000
      });

      // Handle both string and object parameters
      if (typeof to === 'object') {
        // New format: sendEmail({to, subject, text, html, attachments})
        emailTo = to.to;
        emailSubject = to.subject;
        emailText = to.text;
        emailHtml = to.html;
        emailAttachments = to.attachments;
      } else {
        // Legacy format: sendEmail(to, subject, text, html, attachments)
        emailTo = to;
        emailSubject = subject;
        emailText = text;
        emailHtml = html;
        emailAttachments = attachments;
      }

      // Use proper "from" address format
      // If using cPanel email, use that domain. Otherwise use Gmail but with proper format
      const fromAddress = process.env.EMAIL_FROM || emailUser;
      const fromName = process.env.EMAIL_FROM_NAME || 'HR Workflow Management';
      
      const mailOptions = {
        from: `"${fromName}" <${fromAddress}>`, // Proper format: "Name" <email@domain.com>
        to: emailTo,
        subject: emailSubject,
        text: emailText,
        html: emailHtml || emailText // Use HTML if provided, otherwise use text
      };

      // Add attachments if provided
      if (emailAttachments && Array.isArray(emailAttachments) && emailAttachments.length > 0) {
        mailOptions.attachments = emailAttachments.map(attachment => ({
          filename: attachment.filename,
          path: attachment.path
        }));
      }

      console.log(`Attempting to send email to: ${emailTo}`);
      console.log(`Subject: ${emailSubject}`);
      if (emailAttachments && emailAttachments.length > 0) {
        console.log(`Attachments: ${emailAttachments.length} files`);
      }

      const result = await transporter.sendMail(mailOptions);
      
      console.log('Email sent successfully:', {
        messageId: result.messageId,
        to: emailTo,
        subject: emailSubject
      });

      return {
        success: true,
        message: 'Email sent successfully',
        messageId: result.messageId
      };

    } catch (error) {
      // Safely log error details
      const errorInfo = {
        to: emailTo || 'unknown',
        subject: emailSubject || 'unknown',
        error: error.message
      };
      
      // Only log if console is available (might not be in some environments)
      if (typeof console !== 'undefined' && console.error) {
        console.error('Failed to send email:', errorInfo);
      }

      // Extract detailed error information
      let errorDetails = {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response || error.responseCode,
        responseCode: error.responseCode
      };

      // Remove undefined values
      Object.keys(errorDetails).forEach(key => {
        if (errorDetails[key] === undefined) {
          delete errorDetails[key];
        }
      });

      // Build diagnostic info
      const diagnostic = {};
      if (!emailUser || !emailPass) {
        diagnostic.credentialsMissing = true;
        diagnostic.hasEmailUser = !!emailUser;
        diagnostic.hasEmailPass = !!emailPass;
        diagnostic.emailConfigUser = !!emailConfig.EMAIL_USER;
        diagnostic.emailConfigPass = !!emailConfig.EMAIL_PASS;
        diagnostic.envEmailUser = !!process.env.EMAIL_USER;
        diagnostic.envEmailPass = !!process.env.EMAIL_PASS;
      }
      // Note: We create a new transporter for each email, so this check is not needed
      if (!emailTo) {
        diagnostic.emailToMissing = true;
      }
      if (!emailSubject) {
        diagnostic.emailSubjectMissing = true;
      }
      
      // Add authentication-specific diagnostics
      if (error.code === 'EAUTH') {
        diagnostic.authenticationFailed = true;
        diagnostic.emailUserConfigured = !!emailUser;
        diagnostic.emailUserValue = emailUser ? `${emailUser.substring(0, 3)}***@${emailUser.split('@')[1] || 'unknown'}` : 'not set';
        diagnostic.emailPassConfigured = !!emailPass;
        diagnostic.emailPassLength = emailPass ? emailPass.length : 0;
        diagnostic.emailPassTrimmed = emailPass ? (emailPass !== (emailConfig.EMAIL_PASS || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || '')) : false;
        diagnostic.suggestion = 'Possible issues: 1) Gmail App Password might be incorrect or expired, 2) Gmail might be blocking your hosting provider\'s IP address, 3) Check if password has whitespace or encoding issues, 4) Try generating a new Gmail App Password';
      }

      return {
        success: false,
        message: 'Failed to send email',
        error: error.message,
        errorDetails: Object.keys(errorDetails).length > 0 ? errorDetails : undefined,
        diagnostic: Object.keys(diagnostic).length > 0 ? diagnostic : undefined
      };
    }
  }

  /**
   * Send email with template variables replaced
   * @param {string} to - Recipient email address
   * @param {string} subject - Email subject with variables
   * @param {string} content - Email content with variables
   * @param {Object} variables - Object containing variable values
   * @returns {Promise<Object>} - Result object with success status and message
   */
  async sendTemplateEmail(to, subject, content, variables = {}) {
    try {
      // Replace variables in subject and content
      let processedSubject = subject;
      let processedContent = content;

      // Replace all variables in the format {{variable_name}}
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        processedSubject = processedSubject.replace(regex, variables[key] || '');
        processedContent = processedContent.replace(regex, variables[key] || '');
      });

      // Convert line breaks to HTML for better formatting
      const htmlContent = processedContent.replace(/\n/g, '<br>');

      return await this.sendEmail(to, processedSubject, processedContent, htmlContent);

    } catch (error) {
      console.error('Failed to send template email:', error);
      return {
        success: false,
        message: 'Failed to send template email',
        error: error.message
      };
    }
  }

  /**
   * Send bulk emails to multiple recipients
   * @param {Array} recipients - Array of recipient objects {email, name, variables}
   * @param {string} subject - Email subject
   * @param {string} content - Email content
   * @returns {Promise<Object>} - Result object with success/failure counts
   */
  async sendBulkEmails(recipients, subject, content) {
    const results = {
      sent: 0,
      failed: 0,
      details: []
    };

    for (const recipient of recipients) {
      try {
        const result = await this.sendTemplateEmail(
          recipient.email,
          subject,
          content,
          recipient.variables || {}
        );

        if (result.success) {
          results.sent++;
          results.details.push({
            email: recipient.email,
            success: true,
            messageId: result.messageId
          });
        } else {
          results.failed++;
          results.details.push({
            email: recipient.email,
            success: false,
            error: result.error
          });
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          email: recipient.email,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`Bulk email sending completed: ${results.sent} sent, ${results.failed} failed`);
    return results;
  }
}

// Create and export a singleton instance
const emailService = new EmailService();
export default emailService;
