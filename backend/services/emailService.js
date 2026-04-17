import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { emailConfig } from '../email-config.js';
import { query } from '../config/database.js';

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
      console.log('📧 EMAIL_USER:', emailUser ? emailUser : '(not set)');
      console.log('📧 EMAIL_PASS:', emailPass ? '***set***' : '(not set)');

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
  /**
   * Send assignment dispatch email to a candidate with retry + exponential backoff.
   * Substitutes {{candidate_name}}, {{submission_link}}, {{deadline}}, {{expiry_warning}}
   * (and any other {{variable}}) in the HR-provided email body.
   *
   * @param {Object} candidateAssignment
   * @param {number} candidateAssignment.id
   * @param {string} candidateAssignment.candidate_name
   * @param {string} candidateAssignment.candidate_email
   * @param {string} candidateAssignment.assignment_title
   * @param {string} candidateAssignment.deadline
   * @param {string} candidateAssignment.expiry_at
   * @param {string} candidateAssignment.submission_link
   * @param {string} candidateAssignment.email_body  - HR template with {{variables}}
   */
  async sendAssignmentEmail(candidateAssignment) {
    const {
      id,
      candidate_name,
      candidate_email,
      assignment_title,
      deadline,
      expiry_at,
      submission_link,
      email_body
    } = candidateAssignment;

    const subject = 'Next Step in Your Application';

    // Build expiry warning string
    const expiryDate = new Date(expiry_at);
    const expiryWarning = `Your submission link will expire on ${expiryDate.toUTCString()}.`;

    // Substitute all known template variables in the HR-provided body
    const variables = {
      candidate_name: candidate_name || '',
      submission_link: submission_link || '',
      deadline: deadline || '',
      expiry_warning: expiryWarning,
      assignment_title: assignment_title || ''
    };

    let processedBody = email_body || '';
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processedBody = processedBody.replace(regex, variables[key]);
    });

    // Retry with exponential backoff: delays 1s, 2s, 4s
    const maxRetries = 3;
    const baseDelay = 1000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.sendEmail(candidate_email, subject, processedBody);
      if (result.success) {
        return result;
      }

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * baseDelay;
        console.warn(`Assignment email attempt ${attempt + 1} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // All retries exhausted — mark as Failed in DB
        console.error(`All ${maxRetries} retries exhausted for candidateAssignment id=${id}. Marking email_status=Failed.`);
        try {
          await query(
            `UPDATE candidate_assignments SET email_status = 'Failed' WHERE id = ?`,
            [id]
          );
        } catch (dbError) {
          console.error('Failed to update email_status to Failed:', dbError.message);
        }
        return { success: false, message: 'Email delivery failed after retries', error: result.error };
      }
    }
  }

  /**
   * Send submission notification email to the HR user when a candidate submits.
   *
   * @param {Object} candidateAssignment
   * @param {number} candidateAssignment.id
   * @param {string} candidateAssignment.candidate_name
   * @param {string} candidateAssignment.assignment_title
   * @param {string} candidateAssignment.assigned_by_email
   */
  async sendSubmissionNotificationEmail(candidateAssignment) {
    const { candidate_name, assignment_title, assigned_by_email } = candidateAssignment;

    const subject = 'Candidate has submitted assignment';
    const assignmentViewLink = '/assignments';

    const body =
      `Hello,\n\n` +
      `${candidate_name} has submitted their assignment: "${assignment_title}".\n\n` +
      `You can review the submission in the Assignment View:\n${assignmentViewLink}\n\n` +
      `Regards,\nHR Workflow Management`;

    return await this.sendEmail(assigned_by_email, subject, body);
  }
}

// Create and export a singleton instance
const emailService = new EmailService();
export default emailService;
