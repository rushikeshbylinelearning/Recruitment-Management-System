/**
 * Form Submission Processor Service
 * Handles processing of form submissions, candidate record creation, and notifications
 */

import { transaction, query } from '../config/database.js';
import emailService from './emailService.js';
import activityLogger from './activityLogger.js';
import fileStorage from './fileStorage.js';

class FormSubmissionProcessor {
  getFirstValue(data, keys, defaultValue = null) {
    for (const key of keys) {
      const value = data?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }
    return defaultValue;
  }

  /**
   * Process a form submission with transaction support
   * @param {number} formId - The form ID
   * @param {Object} submissionData - The form submission data
   * @param {Object} file - Optional resume file upload
   * @param {string} ipAddress - Submitter IP address
   * @param {string} userAgent - Browser user agent
   * @returns {Promise<Object>} - Result with candidateId and submissionId
   */
  async processSubmission(formId, submissionData, file = null, ipAddress = null, userAgent = null) {
    try {
      // Use transaction to ensure atomicity
      const result = await transaction(async (connection) => {
        // Step 1: Create submission record with pending status
        const [submissionResult] = await connection.execute(
          `INSERT INTO form_submissions 
           (form_id, submission_data, ip_address, user_agent, status, submitted_at)
           VALUES (?, ?, ?, ?, 'pending', NOW())`,
          [formId, JSON.stringify(submissionData), ipAddress, userAgent]
        );
        
        const submissionId = submissionResult.insertId;

        // Step 2: Handle file upload if present
        let resumeFileId = null;
        if (file) {
          const fileResult = await this.handleFileUpload(file, submissionData);
          if (!fileResult.success) {
            throw new Error(`File upload failed: ${fileResult.error}`);
          }
          resumeFileId = fileResult.fileId;
        }

        // Step 3: Create candidate record
        const candidateId = await this.createCandidateRecord(
          connection,
          formId,
          submissionData,
          resumeFileId
        );

        // Step 4: Update submission record with candidate_id and processed status
        await connection.execute(
          `UPDATE form_submissions 
           SET candidate_id = ?, status = 'processed', processed_at = NOW()
           WHERE id = ?`,
          [candidateId, submissionId]
        );

        return { candidateId, submissionId };
      });

      // Step 5: Send notifications (non-blocking - errors logged but don't fail submission)
      this.sendNotifications(result.candidateId, submissionData, formId).catch(error => {
        console.error('[FormSubmissionProcessor] Email notification failed:', error);
        // Log email error to activity logs
        activityLogger.log({
          entityType: 'candidate',
          entityId: result.candidateId,
          actionType: 'email_error',
          description: 'Failed to send email notifications',
          metadata: { error: error.message, formId }
        });
      });

      // Step 6: Log activity (non-blocking)
      activityLogger.log({
        entityType: 'candidate',
        entityId: result.candidateId,
        actionType: 'form_submission',
        description: 'Candidate applied via custom form',
        metadata: { 
          formId, 
          submissionId: result.submissionId,
          candidateName: this.getFirstValue(submissionData, ['name', 'full_name'], 'Unknown Candidate'),
          position: this.getFirstValue(submissionData, ['position', 'job_title', 'job_profile'], 'Not Specified')
        }
      }).catch(error => {
        console.error('[FormSubmissionProcessor] Activity logging failed:', error);
      });

      return {
        success: true,
        candidateId: result.candidateId,
        submissionId: result.submissionId
      };

    } catch (error) {
      console.error('[FormSubmissionProcessor] Submission processing failed:', error);
      
      // Update submission status to failed
      try {
        await query(
          `UPDATE form_submissions 
           SET status = 'failed', error_message = ?, processed_at = NOW()
           WHERE form_id = ? AND submission_data = ? AND status = 'pending'
           ORDER BY id DESC LIMIT 1`,
          [error.message, formId, JSON.stringify(submissionData)]
        );
      } catch (updateError) {
        console.error('[FormSubmissionProcessor] Failed to update submission status:', updateError);
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create candidate record in candidates table
   * @param {Object} connection - Database connection (for transaction)
   * @param {number} formId - The form ID
   * @param {Object} data - Submission data
   * @param {number|null} resumeFileId - Resume file ID if uploaded
   * @returns {Promise<number>} - Created candidate ID
   */
  async createCandidateRecord(connection, formId, data, resumeFileId = null) {
    try {
      // Get form details to extract job_id if linked
      const [formRows] = await connection.execute(
        'SELECT job_id FROM forms WHERE id = ?',
        [formId]
      );
      
      const jobId = formRows[0]?.job_id || this.getFirstValue(data, ['job_id', 'job_profile'], null);
      const candidateName = this.getFirstValue(data, ['name', 'full_name'], 'Unknown Candidate');
      const candidatePhone = this.getFirstValue(data, ['phone', 'phone_number'], null);
      const candidatePosition = this.getFirstValue(data, ['position', 'job_title', 'job_profile'], 'Not Specified');
      const candidateSource = this.getFirstValue(data, ['source'], 'Form Submission');
      const candidateExperience = this.getFirstValue(data, ['experience', 'years_experience'], null);
      const candidateNoticePeriod = this.getFirstValue(data, ['notice_period', 'notice_period_days'], null);

      // Map form data to candidate table columns
      const candidateData = {
        job_id: jobId,
        name: candidateName,
        email: data.email,
        phone: candidatePhone,
        position: candidatePosition,
        stage: 'Applied',
        source: candidateSource,
        applied_date: new Date().toISOString().split('T')[0],
        experience: candidateExperience,
        salary_expected: data.expected_ctc || data.expected_salary || null,
        notice_period: candidateNoticePeriod,
        current_ctc: data.current_ctc || null,
        resume_file_id: resumeFileId,
        notes: data.notes || data.hr_remarks || null,
        location: data.location || null,
        expertise: data.expertise || data.skills || null,
        work_preference: data.work_preference || null
      };

      // Insert candidate record
      const [result] = await connection.execute(
        `INSERT INTO candidates 
         (job_id, name, email, phone, position, stage, source, applied_date, 
          experience, salary_expected, notice_period, current_ctc, resume_file_id, 
          notes, location, expertise, work_preference, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          candidateData.job_id,
          candidateData.name,
          candidateData.email,
          candidateData.phone,
          candidateData.position,
          candidateData.stage,
          candidateData.source,
          candidateData.applied_date,
          candidateData.experience,
          candidateData.salary_expected,
          candidateData.notice_period,
          candidateData.current_ctc,
          candidateData.resume_file_id,
          candidateData.notes,
          candidateData.location,
          candidateData.expertise,
          candidateData.work_preference
        ]
      );

      return result.insertId;

    } catch (error) {
      console.error('[FormSubmissionProcessor] Failed to create candidate record:', error);
      throw error;
    }
  }

  /**
   * Store submission data in form_submissions table
   * Note: This is now handled in processSubmission for better transaction control
   * @param {number} formId - The form ID
   * @param {number} candidateId - The candidate ID
   * @param {Object} data - Submission data
   * @returns {Promise<number>} - Created submission ID
   */
  async storeSubmissionData(formId, candidateId, data) {
    try {
      const result = await query(
        `INSERT INTO form_submissions 
         (form_id, candidate_id, submission_data, status, submitted_at, processed_at)
         VALUES (?, ?, ?, 'processed', NOW(), NOW())`,
        [formId, candidateId, JSON.stringify(data)]
      );

      return result.insertId;

    } catch (error) {
      console.error('[FormSubmissionProcessor] Failed to store submission data:', error);
      throw error;
    }
  }

  /**
   * Handle file upload via fileStorage service
   * @param {Object} file - Uploaded file object
   * @param {Object} submissionData - Form submission data for context
   * @returns {Promise<Object>} - Result with fileId
   */
  async handleFileUpload(file, submissionData) {
    try {
      // Validate file type and size
      const validation = fileStorage.validateFile(file);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        };
      }

      // Check file size (max 5MB as per requirements)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return {
          success: false,
          error: 'File size exceeds 5MB limit'
        };
      }

      // Check file format (PDF, DOC, DOCX)
      const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return {
          success: false,
          error: 'Invalid file format. Only PDF, DOC, and DOCX are allowed'
        };
      }

      // Save file using fileStorage service
      const saveResult = await fileStorage.saveFile(file);
      if (!saveResult.success) {
        return {
          success: false,
          error: saveResult.error
        };
      }

      // Store file metadata in database
      const fileRecord = await query(
        `INSERT INTO file_uploads 
         (filename, original_name, file_path, file_size, mime_type, uploaded_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          saveResult.filename,
          saveResult.originalName,
          saveResult.filepath,
          saveResult.size,
          saveResult.mimeType
        ]
      );

      return {
        success: true,
        fileId: fileRecord.insertId,
        filename: saveResult.filename
      };

    } catch (error) {
      console.error('[FormSubmissionProcessor] File upload failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send email notifications to candidate and HR
   * @param {number} candidateId - The candidate ID
   * @param {Object} candidateData - Candidate information
   * @param {number} formId - The form ID
   * @returns {Promise<void>}
   */
  async sendNotifications(candidateId, candidateData, formId) {
    try {
      // Send candidate confirmation email
      const candidateEmailResult = await emailService.sendTemplateEmail(
        candidateData.email,
        'Application Received - {{name}}',
        `Dear {{name}},\n\nThank you for submitting your application for the position of {{position}}.\n\nWe have received your application and our HR team will review it shortly. You will be contacted if your profile matches our requirements.\n\nBest regards,\nHR Team`,
        {
          name: candidateData.name,
          position: candidateData.position || 'the position you applied for'
        }
      );

      if (!candidateEmailResult.success) {
        console.error('[FormSubmissionProcessor] Failed to send candidate confirmation:', candidateEmailResult.error);
      }

      // Send HR notification email
      const hrEmail = process.env.HR_EMAIL || process.env.EMAIL_USER;
      if (hrEmail) {
        const hrEmailResult = await emailService.sendTemplateEmail(
          hrEmail,
          'New Candidate Application - {{name}}',
          `New candidate application received:\n\nName: {{name}}\nEmail: {{email}}\nPhone: {{phone}}\nPosition: {{position}}\nExperience: {{experience}}\nExpected CTC: {{expected_ctc}}\nNotice Period: {{notice_period}}\n\nPlease review the application in the HR system.`,
          {
            name: candidateData.name,
            email: candidateData.email,
            phone: candidateData.phone,
            position: candidateData.position || 'Not Specified',
            experience: candidateData.experience || 'Not Specified',
            expected_ctc: candidateData.expected_ctc || candidateData.expected_salary || 'Not Specified',
            notice_period: candidateData.notice_period || 'Not Specified'
          }
        );

        if (!hrEmailResult.success) {
          console.error('[FormSubmissionProcessor] Failed to send HR notification:', hrEmailResult.error);
        }
      }

    } catch (error) {
      console.error('[FormSubmissionProcessor] Email notification error:', error);
      // Don't throw - email failures should not block submission
    }
  }
}

export default new FormSubmissionProcessor();
