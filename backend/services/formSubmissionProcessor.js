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
  async processSubmission(
    formId,
    submissionData,
    file = null,
    ipAddress = null,
    userAgent = null,
    options = {}
  ) {
    const { existingCandidateId = null } = options;
    try {
      console.log('[FormSubmissionProcessor] Starting submission process for form:', formId);
      console.log('[FormSubmissionProcessor] Submission data:', JSON.stringify(submissionData, null, 2));
      
      let resumeFileId = null;
      if (file) {
        const fileResult = await this.handleFileUpload(file, submissionData);
        if (!fileResult.success) {
          throw new Error(`File upload failed: ${fileResult.error}`);
        }
        resumeFileId = fileResult.fileId;
      }

      const result = await transaction(async (connection) =>
        this.processSubmissionInTransaction(connection, formId, submissionData, {
          ipAddress,
          userAgent,
          existingCandidateId,
          resumeFileId,
        })
      );

      console.log('[FormSubmissionProcessor] Transaction completed successfully');

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
      console.error('[FormSubmissionProcessor] Error stack:', error.stack);
      
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
   * Core submission steps inside an open transaction (used by publicSubmissionService).
   */
  async processSubmissionInTransaction(connection, formId, submissionData, opts = {}) {
    const { ipAddress = null, userAgent = null, existingCandidateId = null, resumeFileId = null } = opts;

    const [submissionResult] = await connection.execute(
      `INSERT INTO form_submissions 
       (form_id, submission_data, ip_address, user_agent, status, submitted_at)
       VALUES (?, ?, ?, ?, 'pending', NOW())`,
      [formId, JSON.stringify(submissionData), ipAddress, userAgent]
    );

    const submissionId = submissionResult.insertId;
    let candidateId;

    if (existingCandidateId) {
      candidateId = await this.updateCandidateRecord(
        connection,
        existingCandidateId,
        formId,
        submissionData,
        resumeFileId
      );
    } else {
      candidateId = await this.createCandidateRecord(
        connection,
        formId,
        submissionData,
        resumeFileId
      );
    }

    await connection.execute(
      `UPDATE form_submissions 
       SET candidate_id = ?, status = 'processed', processed_at = NOW()
       WHERE id = ?`,
      [candidateId, submissionId]
    );

    return { success: true, candidateId, submissionId };
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
      console.log('[FormSubmissionProcessor] Creating candidate record...');
      
      // Generate UUID for the new candidate
      const [uuidResult] = await connection.execute('SELECT UUID() as uuid');
      const candidateId = uuidResult[0].uuid;
      console.log('[FormSubmissionProcessor] Generated UUID:', candidateId);
      
      // Get form details to extract job_id if linked
      const [formRows] = await connection.execute(
        'SELECT job_id FROM forms WHERE id = ?',
        [formId]
      );
      
      const jobId = formRows[0]?.job_id || this.getFirstValue(data, ['job_id', 'job_profile'], null);
      const candidateName = this.getFirstValue(data, ['name', 'full_name', 'candidate_name', 'applicant_name'], 'Unknown Candidate');
      const candidateEmail = this.getFirstValue(data, ['email', 'email_id', 'email_address', 'emailid'], null);
      const candidatePhone = this.getFirstValue(data, ['phone', 'phone_number', 'mobile', 'mobile_number', 'contact_number', 'contact'], null);
      const candidatePosition = this.getFirstValue(data, ['position', 'position_applied', 'applied_position', 'postion', 'job_title', 'job_role', 'role', 'designation', 'profile', 'job_profile'], 'Not Specified');
      const candidateSource = this.getFirstValue(data, ['source', 'referral_source', 'application_source'], 'Form Submission');
      const candidateExperience = this.getFirstValue(data, ['experience', 'experience_in_years', 'years_experience', 'years_of_experience', 'exp', 'work_experience', 'total_experience'], null);
      const candidateNoticePeriod = this.getFirstValue(data, ['notice_period', 'notice_period_days', 'notice_period_in_days'], null);

      console.log('[FormSubmissionProcessor] Candidate data:', {
        id: candidateId,
        name: candidateName,
        email: candidateEmail,
        phone: candidatePhone,
        position: candidatePosition
      });

      // Map form data to candidate table columns — use ?? null to prevent undefined bindings
      const candidateData = {
        id: candidateId,
        job_id: jobId ?? null,
        name: candidateName ?? null,
        email: candidateEmail ?? null,
        phone: candidatePhone ?? null,
        position: candidatePosition ?? null,
        stage: 'Applied',
        source: candidateSource ?? 'Form Submission',
        applied_date: new Date().toISOString().split('T')[0],
        experience: candidateExperience ?? null,
        salary_expected: data.expected_ctc ?? data.expected_salary ?? null,
        notice_period: candidateNoticePeriod ?? null,
        current_ctc: data.current_ctc ?? null,
        resume_file_id: resumeFileId ?? null,
        notes: data.notes ?? data.hr_remarks ?? null,
        location: data.location ?? null,
        expertise: data.expertise ?? data.skills ?? null,
        work_preference: data.work_preference ?? null
      };

      // Debug: log field mapping to catch mismatches early
      console.log('[FormSubmissionProcessor] Field mapping:');
      Object.entries(candidateData).forEach(([key, value]) => {
        if (value === undefined) {
          console.warn(`[FormSubmissionProcessor] WARNING: undefined value for field "${key}"`);
        } else {
          console.log(`  ${key} =>`, value);
        }
      });

      // Guard: replace any remaining undefined with null before MySQL binding
      const safeInsertValues = [
        candidateData.id,
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
        candidateData.work_preference,
      ].map(v => (v === undefined ? null : v));

      // Insert candidate record with UUID
      const [result] = await connection.execute(
        `INSERT INTO candidates 
         (id, job_id, name, email, phone, position, stage, source, applied_date, 
          experience, salary_expected, notice_period, current_ctc, resume_file_id, 
          notes, location, expertise, work_preference, requires_card_view, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        safeInsertValues
      );

      console.log('[FormSubmissionProcessor] Candidate record created with ID:', candidateId);
      return candidateId;

    } catch (error) {
      console.error('[FormSubmissionProcessor] Failed to create candidate record:', error);
      console.error('[FormSubmissionProcessor] SQL Error Code:', error.code);
      console.error('[FormSubmissionProcessor] SQL Error Message:', error.sqlMessage);
      
      // Provide more specific error messages
      if (error.code === 'ER_DUP_ENTRY') {
        throw new Error('A candidate with this email already exists');
      } else if (error.code === 'ER_BAD_NULL_ERROR') {
        throw new Error('Missing required field: ' + error.sqlMessage);
      } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        throw new Error('Invalid job reference');
      } else {
        throw new Error('Database error: ' + error.message);
      }
    }
  }

  /**
   * Update an existing candidate from a new public form submission (re-application).
   */
  async updateCandidateRecord(connection, candidateId, formId, data, resumeFileId = null) {
    const [formRows] = await connection.execute('SELECT job_id FROM forms WHERE id = ?', [formId]);
    const jobId = formRows[0]?.job_id || this.getFirstValue(data, ['job_id', 'job_profile'], null);
    const candidateName = this.getFirstValue(data, ['name', 'full_name', 'candidate_name', 'applicant_name'], null);
    const candidateEmail = this.getFirstValue(data, ['email', 'email_id', 'email_address', 'emailid'], null);
    const candidatePhone = this.getFirstValue(data, ['phone', 'phone_number', 'mobile', 'mobile_number', 'contact_number', 'contact'], null);
    const candidatePosition = this.getFirstValue(data, ['position', 'position_applied', 'applied_position', 'postion', 'job_title', 'job_role', 'role', 'designation', 'profile', 'job_profile'], null);
    const candidateExperience = this.getFirstValue(data, ['experience', 'experience_in_years', 'years_experience', 'years_of_experience', 'exp', 'work_experience', 'total_experience'], null);
    const candidateNoticePeriod = this.getFirstValue(data, ['notice_period', 'notice_period_days', 'notice_period_in_days'], null);

    await connection.execute(
      `UPDATE candidates SET
         job_id = COALESCE(?, job_id),
         name = COALESCE(?, name),
         email = COALESCE(?, email),
         phone = COALESCE(?, phone),
         position = COALESCE(?, position),
         experience = COALESCE(?, experience),
         salary_expected = COALESCE(?, salary_expected),
         notice_period = COALESCE(?, notice_period),
         current_ctc = COALESCE(?, current_ctc),
         resume_file_id = COALESCE(?, resume_file_id),
         notes = COALESCE(?, notes),
         location = COALESCE(?, location),
         expertise = COALESCE(?, expertise),
         work_preference = COALESCE(?, work_preference),
         updated_at = NOW()
       WHERE id = ?`,
      [
        jobId,
        candidateName,
        candidateEmail,
        candidatePhone,
        candidatePosition,
        candidateExperience,
        data.expected_ctc ?? data.expected_salary ?? null,
        candidateNoticePeriod,
        data.current_ctc ?? null,
        resumeFileId,
        data.notes ?? data.hr_remarks ?? null,
        data.location ?? null,
        data.expertise ?? data.skills ?? null,
        data.work_preference ?? null,
        candidateId,
      ]
    );

    return candidateId;
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
