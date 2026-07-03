/**
 * Unified public form submission — candidates always apply successfully;
 * duplicates are flagged for HR asynchronously.
 */

import fs from 'fs/promises';
import { transaction, query } from '../config/database.js';
import formSubmissionProcessor from './formSubmissionProcessor.js';
import validationService from './validationService.js';
import { normalizeFormData, extractContactFields } from '../utils/formDataNormalizer.js';
import { findExistingWithLock, findExistingForSubmission } from './candidateMatchService.js';
import { normalizeEmail } from '../utils/contactNormalizer.js';
import { createApplicationVersion } from './applicationVersionService.js';
import { hashResumeBuffer } from './publicDuplicateService.js';
import {
  flagCandidateAsDuplicate,
  notifyHrDuplicateApplication,
  ensureCandidateDuplicateColumns,
} from './duplicateCandidateService.js';

function sanitizeSubmission(normalizedFormData) {
  const sanitized = {};
  for (const [key, value] of Object.entries(normalizedFormData)) {
    sanitized[key] =
      typeof value === 'string' ? validationService.sanitizeText(value) : value;
  }
  return sanitized;
}

/**
 * Check duplicates (HR preview / optional; not shown to candidates).
 */
export async function checkDuplicateSubmission(formId, rawFields) {
  const normalized = normalizeFormData(rawFields);
  const contact = extractContactFields(normalized);
  return findExistingForSubmission({
    email: contact.email,
    phone: contact.phone,
    linkedinUrl: contact.linkedinUrl,
    formId,
  });
}

/**
 * Process public submission — never blocks the candidate on duplicate match.
 */
export async function processPublicSubmission({
  formId,
  formData,
  fields,
  filesByFieldKey,
  resolveResumeUpload,
  ipAddress,
  userAgent,
}) {
  await ensureCandidateDuplicateColumns();

  const normalizedFormData = normalizeFormData(formData);
  const validation = validationService.validateFormSubmission(
    fields,
    normalizedFormData,
    filesByFieldKey
  );

  if (!validation.isValid) {
    return {
      ok: false,
      status: 400,
      body: { success: false, message: 'Validation failed', errors: validation.errors },
    };
  }

  const contact = extractContactFields(normalizedFormData);
  const sanitizedData = sanitizeSubmission(normalizedFormData);
  const resumeFile = resolveResumeUpload(filesByFieldKey, fields);

  let resumeHash = null;
  if (resumeFile?.path) {
    try {
      const buf = await fs.readFile(resumeFile.path);
      resumeHash = hashResumeBuffer(buf);
    } catch {
      /* ignore */
    }
  }

  let resumeFileId = null;
  if (resumeFile) {
    const fileResult = await formSubmissionProcessor.handleFileUpload(resumeFile, sanitizedData);
    if (!fileResult.success) {
      return {
        ok: false,
        status: 400,
        body: { success: false, message: fileResult.error || 'Resume upload failed' },
      };
    }
    resumeFileId = fileResult.fileId;
  }

  const lockKey = normalizeEmail(contact.email)
    ? `pub_app_${formId}_${normalizeEmail(contact.email)}`
    : null;

  const result = await transaction(async (connection) => {
    if (lockKey) {
      const [lockRows] = await connection.execute('SELECT GET_LOCK(?, 15) AS acquired', [
        lockKey,
      ]);
      if (!lockRows[0]?.acquired) {
        throw new Error('Submission in progress. Please wait a moment and try again.');
      }
    }

    try {
      const existing = await findExistingWithLock(
        connection,
        {
          email: contact.email,
          phone: contact.phone,
          linkedinUrl: contact.linkedinUrl,
        },
        formId
      );

      // Always create a new candidate record — HR merges later if duplicate
      const processResult = await formSubmissionProcessor.processSubmissionInTransaction(
        connection,
        formId,
        sanitizedData,
        {
          ipAddress,
          userAgent,
          existingCandidateId: null,
          resumeFileId,
        }
      );

      if (!processResult.success) {
        throw new Error(processResult.error || 'Submission failed');
      }

      const version = await createApplicationVersion({
        candidateId: processResult.candidateId,
        formId,
        formSubmissionId: processResult.submissionId,
        email: contact.email || sanitizedData.email,
        phone: contact.phone,
        linkedinUrl: contact.linkedinUrl,
        resumeHash,
        submissionData: sanitizedData,
        action: 'new',
        parentApplicationId: null,
        connection,
      });

      let duplicateMeta = null;
      if (
        existing.exists &&
        existing.candidateId &&
        String(existing.candidateId) !== String(processResult.candidateId)
      ) {
        await flagCandidateAsDuplicate({
          newCandidateId: processResult.candidateId,
          primaryCandidateId: existing.candidateId,
          matchType: existing.matchType || 'email',
          applicationId: version.applicationId,
          connection,
        });

        const [primaryRows] = await connection.execute(
          'SELECT id, name, email, stage FROM candidates WHERE id = ?',
          [existing.candidateId]
        );
        duplicateMeta = {
          primary: primaryRows[0] || { id: existing.candidateId },
          newCandidateId: processResult.candidateId,
          newCandidateName: sanitizedData.name,
        };
      }

      return {
        type: 'success',
        candidateId: processResult.candidateId,
        submissionId: processResult.submissionId,
        version,
        duplicateMeta,
        sanitizedData,
      };
    } finally {
      if (lockKey) {
        await connection.execute('SELECT RELEASE_LOCK(?)', [lockKey]).catch(() => {});
      }
    }
  });

  if (result.duplicateMeta) {
    const { primary, newCandidateName } = result.duplicateMeta;
    setImmediate(() => {
      notifyHrDuplicateApplication({
        newCandidateId: result.candidateId,
        newCandidateName,
        primaryCandidateId: primary.id,
        primaryCandidateName: primary.name,
        email: contact.email || sanitizedData.email,
      }).catch((err) => console.error('[DuplicateNotify]', err.message));
    });
  }

  return {
    ok: true,
    status: 201,
    body: {
      success: true,
      message: 'Application submitted successfully. Thank you for applying!',
      data: {
        applicationRef: result.version.publicRef,
        version: result.version.version,
      },
    },
    candidateId: result.candidateId,
    sanitizedData: result.sanitizedData,
  };
}
