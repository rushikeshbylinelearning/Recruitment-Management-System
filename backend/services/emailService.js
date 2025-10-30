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
      // Use only environment-configured credentials (no fallback)
      const emailUser = emailConfig.EMAIL_USER;
      const emailPass = emailConfig.EMAIL_PASS;
      const smtpHost = emailConfig.EMAIL_HOST;
      const smtpPort = Number(emailConfig.EMAIL_PORT) || 587;
      if (!emailUser || !emailPass || !smtpHost) {
        console.error('⚠️ Email credentials or host not configured. Check EMAIL_USER, EMAIL_PASS, EMAIL_HOST env vars');
        return;
      }
      console.log('📧 Email Service config for host:', smtpHost);

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: emailUser, pass: emailPass },
        tls: { ciphers: 'SSLv3', rejectUnauthorized: false }
      });

      this.transporter.verify((error, success) => {
        if (error) {
          console.error('\n❌ Email Service Authentication Failed:');
          console.error('   Error Code:', error.code);
          console.error('   Response:', error.response);
          console.error('\nEmail functionality is DISABLED until authentication is fixed.\n');
        } else {
          console.log('✅ Email service is ready (SMTP: ' + smtpHost + ')');
        }
      });
    } catch (error) {
      console.error('Failed to initialize email transporter:', error);
    }
  }

  /**
   * Email sender
   */
  async sendEmail(to, subject, text, html = null, attachments = null) {
    let emailTo, emailSubject, emailText, emailHtml, emailAttachments;
    try {
      const emailUser = emailConfig.EMAIL_USER;
      const fromAddress = emailConfig.EMAIL_FROM || emailUser;
      const fromName = process.env.EMAIL_FROM_NAME || 'HR Workflow Management';
      if (!emailUser) throw new Error('EMAIL_USER not set');

      // Flexible argument handling
      if (typeof to === 'object') {
        emailTo = to.to;
        emailSubject = to.subject;
        emailText = to.text;
        emailHtml = to.html;
        emailAttachments = to.attachments;
      } else {
        emailTo = to;
        emailSubject = subject;
        emailText = text;
        emailHtml = html;
        emailAttachments = attachments;
      }

      const mailOptions = {
        from: `"${fromName}" <${fromAddress}>`,
        to: emailTo,
        subject: emailSubject,
        text: emailText,
        html: emailHtml || emailText
      };
      if (emailAttachments && Array.isArray(emailAttachments) && emailAttachments.length > 0) {
        mailOptions.attachments = emailAttachments.map(att => ({ filename: att.filename, path: att.path }));
      }

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', { messageId: result.messageId, to: emailTo, subject: emailSubject });
      return { success: true, message: 'Email sent successfully', messageId: result.messageId };
    } catch (error) {
      console.error('Failed to send email:', error.message);
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
