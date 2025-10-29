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
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }

      const emailUser = emailConfig.EMAIL_USER || process.env.EMAIL_USER;
      const emailPass = emailConfig.EMAIL_PASS || process.env.EMAIL_PASS;
      
      if (!emailUser || !emailPass) {
        throw new Error('Email credentials not configured. Please check email-config.js or .env file');
      }

      // Handle both string and object parameters
      let emailTo, emailSubject, emailText, emailHtml, emailAttachments;
      
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

      const mailOptions = {
        from: emailUser,
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

      const result = await this.transporter.sendMail(mailOptions);
      
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
      console.error('Failed to send email:', {
        to: emailTo,
        subject: emailSubject,
        error: error.message
      });

      return {
        success: false,
        message: 'Failed to send email',
        error: error.message
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
