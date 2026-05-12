import express from 'express';
import { query, transaction } from '../config/database.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { validateCandidate, validateCandidatePartial, validateId, validateUUID, validatePagination, handleValidationErrors } from '../middleware/validation.js';
import fileStorageService from '../services/fileStorage.js';
import fs from 'fs';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { asyncHandler, NotFoundError, ConflictError, ValidationError } from '../middleware/errorHandler.js';
import { createNotification } from '../services/inAppNotifications.js';

const router = express.Router();

const EXPORT_HEADERS = [
  'Name',
  'Email',
  'Phone',
  'Role',
  'Stage',
  'Experience (years)',
  'Location',
  'Source',
  'Applied Date',
  'Expected CTC',
  'Notes/Tags'
];

const parseNumber = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/[^0-9.]/g, '');
  if (!normalized) return null;
  const num = Number.parseFloat(normalized);
  return Number.isNaN(num) ? null : num;
};

const getDateStamp = () => new Date().toISOString().slice(0, 10);

const formatDate = (dateLike) => {
  if (!dateLike) return '';
  const d = new Date(dateLike);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

const normalizeDateInput = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  // Already ISO-like date
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // MM/DD/YYYY -> YYYY-MM-DD
  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const mm = slashMatch[1].padStart(2, '0');
    const dd = slashMatch[2].padStart(2, '0');
    const yyyy = slashMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const buildFilterSummary = (filters) => {
  const summary = [];
  if (filters.search) summary.push(`Search: ${filters.search}`);
  if (filters.stages.length > 0) summary.push(`Stage: ${filters.stages.join(', ')}`);
  if (filters.role) summary.push(`Role: ${filters.role}`);
  if (filters.location) summary.push(`Location: ${filters.location}`);
  if (filters.source) summary.push(`Source: ${filters.source}`);
  if (filters.minExperience || filters.maxExperience) summary.push(`Experience: ${filters.minExperience || 'Any'}-${filters.maxExperience || 'Any'} years`);
  if (filters.minCTC || filters.maxCTC) summary.push(`Expected CTC: ${filters.minCTC || 'Any'}-${filters.maxCTC || 'Any'}`);
  if (filters.startDate || filters.endDate) summary.push(`Applied Date: ${filters.startDate || 'Any'} to ${filters.endDate || 'Any'}`);
  return summary.length > 0 ? summary : ['No filters (all candidates)'];
};

const mapCandidateForExport = (candidate, notesMap) => ({
  name: candidate.name || '',
  email: candidate.email || '',
  phone: candidate.phone || '',
  role: candidate.position || '',
  stage: candidate.stage || '',
  experience: candidate.experience || '',
  location: candidate.location || '',
  source: candidate.source || '',
  appliedDate: formatDate(candidate.applied_date),
  expectedCtc: candidate.salary_expected || '',
  notesTags: (notesMap[candidate.id] || []).join(' | ')
});

const applyExportFilters = (candidates, filters) => {
  return candidates.filter((candidate) => {
    const searchTerm = (filters.search || '').toLowerCase();
    if (searchTerm) {
      const haystack = [
        candidate.name,
        candidate.email,
        candidate.phone,
        candidate.position,
        candidate.location
      ].map((v) => (v || '').toLowerCase()).join(' ');
      if (!haystack.includes(searchTerm)) return false;
    }

    if (filters.stages.length > 0 && !filters.stages.includes(candidate.stage)) return false;

    if (filters.role && !(candidate.position || '').toLowerCase().includes(filters.role.toLowerCase())) return false;
    if (filters.location && !(candidate.location || '').toLowerCase().includes(filters.location.toLowerCase())) return false;
    if (filters.source && candidate.source !== filters.source) return false;

    const experience = parseNumber(candidate.experience);
    const minExperience = parseNumber(filters.minExperience);
    const maxExperience = parseNumber(filters.maxExperience);
    if (minExperience !== null && (experience === null || experience < minExperience)) return false;
    if (maxExperience !== null && (experience === null || experience > maxExperience)) return false;

    const expectedCtc = parseNumber(candidate.salary_expected);
    const minCTC = parseNumber(filters.minCTC);
    const maxCTC = parseNumber(filters.maxCTC);
    if (minCTC !== null && (expectedCtc === null || expectedCtc < minCTC)) return false;
    if (maxCTC !== null && (expectedCtc === null || expectedCtc > maxCTC)) return false;

    const appliedDate = formatDate(candidate.applied_date);
    if (filters.startDate) {
      if (!appliedDate) return false;
      const candidateDate = new Date(`${appliedDate}T00:00:00`);
      const startDate = new Date(`${filters.startDate}T00:00:00`);
      if (Number.isNaN(candidateDate.getTime()) || Number.isNaN(startDate.getTime()) || candidateDate < startDate) {
        return false;
      }
    }
    if (filters.endDate) {
      if (!appliedDate) return false;
      const candidateDate = new Date(`${appliedDate}T00:00:00`);
      const endDate = new Date(`${filters.endDate}T23:59:59`);
      if (Number.isNaN(candidateDate.getTime()) || Number.isNaN(endDate.getTime()) || candidateDate > endDate) {
        return false;
      }
    }

    return true;
  });
};

// Get all candidates
router.get('/', authenticateToken, checkPermission('candidates', 'view'), asyncHandler(async (req, res) => {
  const search = req.query.search || '';
  const stage = req.query.stage || '';
  const source = req.query.source || '';

  let whereClause = 'WHERE 1=1';
  let params = [];

  if (search) {
    whereClause += ' AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.position LIKE ? OR c.location LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (stage) {
    whereClause += ' AND c.stage = ?';
    params.push(stage);
  }

  if (source) {
    whereClause += ' AND c.source = ?';
    params.push(source);
  }

  // Optimized query: Get candidates with all related data in a single query
  const candidates = await query(
    `SELECT c.*, u.name as assigned_to_name,
       (SELECT MAX(i.scheduled_date) 
        FROM interviews i 
        WHERE i.candidate_id = c.id 
        AND i.status = 'Completed') as latest_interview_date,
       (SELECT COUNT(*) FROM communications WHERE candidate_id = c.id) as communications_count,
       (SELECT COUNT(*) FROM interviews WHERE candidate_id = c.id) as interviews_count
     FROM candidates c
     LEFT JOIN users u ON c.assigned_to = u.id
     ${whereClause}
     ORDER BY 
       CASE 
         WHEN c.stage = 'Interview' AND latest_interview_date IS NOT NULL 
         THEN latest_interview_date 
         ELSE c.applied_date 
       END DESC`,
    params
  );

  // Get all candidate IDs for bulk note fetching
  const candidateIds = candidates.map(c => c.id);
  
  // Fetch all notes in a single query if there are candidates
  let notesMap = {};
  if (candidateIds.length > 0) {
    const allNotes = await query(
      `SELECT cnr.*, u.name as user_name, u.role as user_role 
       FROM candidate_notes_ratings cnr
       LEFT JOIN users u ON cnr.user_id = u.id
       WHERE cnr.candidate_id IN (${candidateIds.map(() => '?').join(',')})
       ORDER BY cnr.created_at DESC`,
      candidateIds
    );
    
    // Group notes by candidate_id
    allNotes.forEach(note => {
      if (!notesMap[note.candidate_id]) {
        notesMap[note.candidate_id] = [];
      }
      notesMap[note.candidate_id].push(note);
    });
  }

  // Parse JSON fields and add additional data
  for (let candidate of candidates) {
    try {
      candidate.skills = JSON.parse(candidate.skills || '[]');
    } catch (e) {
      candidate.skills = [];
    }

    // Add notes from the map
    candidate.notes = notesMap[candidate.id] || [];

    // Convert snake_case to camelCase for frontend compatibility
    candidate.resumeFileId = candidate.resume_file_id;
    candidate.resume = candidate.resume_path; // Add resume path for frontend
    candidate.appliedDate = candidate.applied_date;
    candidate.assignedTo = candidate.assigned_to_name || 'Unassigned';
    candidate.assignedToId = candidate.assigned_to || null; // Add user ID for form submission
    
    // Structure salary object
    candidate.salary = {
      expected: candidate.salary_expected || '',
      offered: candidate.salary_offered || '',
      negotiable: Boolean(candidate.salary_negotiable)
    };

    // Structure availability object
    candidate.availability = {
      joiningTime: candidate.joining_time || '',
      noticePeriod: candidate.notice_period || '',
      immediateJoiner: Boolean(candidate.immediate_joiner)
    };

    // Structure work preferences
    candidate.workPreferences = {
      workPreference: candidate.work_preference || null,
      willingAlternateSaturday: candidate.willing_alternate_saturday === null ? null : Boolean(candidate.willing_alternate_saturday),
      currentCtc: candidate.current_ctc || null,
      ctcFrequency: candidate.ctc_frequency || 'Annual'
    };

    // Structure assignment details
    candidate.assignmentDetails = {
      inHouseAssignmentStatus: candidate.in_house_assignment_status || 'Pending',
      interviewDate: candidate.interview_date || null,
      interviewerId: candidate.interviewer_id || null,
      inOfficeAssignment: candidate.in_office_assignment || null
    };

    // Add latest interview date for Interview stage candidates
    candidate.latestInterviewDate = candidate.latest_interview_date || null;

    // Add location fields
    candidate.assignmentLocation = candidate.assignment_location || null;
    candidate.resumeLocation = candidate.resume_location || null;

    // Initialize empty arrays for frontend compatibility
    candidate.communications = [];
    candidate.interviews = [];
    
    // Add counts from the optimized query
    candidate.communicationsCount = candidate.communications_count || 0;
    candidate.interviewsCount = candidate.interviews_count || 0;
    
    // Remove snake_case fields
    delete candidate.resume_file_id;
    delete candidate.resume_path;
    delete candidate.applied_date;
    delete candidate.assigned_to_name;
    delete candidate.salary_expected;
    delete candidate.salary_offered;
    delete candidate.salary_negotiable;
    delete candidate.joining_time;
    delete candidate.notice_period;
    delete candidate.immediate_joiner;
    delete candidate.work_preference;
    delete candidate.willing_alternate_saturday;
    delete candidate.current_ctc;
    delete candidate.ctc_frequency;
    delete candidate.in_house_assignment_status;
    delete candidate.interview_date;
    delete candidate.interviewer_id;
    delete candidate.in_office_assignment;
    delete candidate.assignment_location;
    delete candidate.resume_location;
    delete candidate.communications_count;
    delete candidate.interviews_count;
  }

  res.json({
    success: true,
    data: {
      candidates
    }
  });
}));

// Export candidates (Excel/PDF) based on filters
router.get('/export', authenticateToken, checkPermission('candidates', 'view'), asyncHandler(async (req, res) => {
  const format = String(req.query.format || '').toLowerCase();
  if (!['excel', 'pdf'].includes(format)) {
    throw new ValidationError('Invalid format. Use "excel" or "pdf"');
  }

  const stagesRaw = req.query.stage || req.query['stage[]'] || [];
  const stages = Array.isArray(stagesRaw) ? stagesRaw.map(String) : [String(stagesRaw)].filter(Boolean);
  const startDate = normalizeDateInput(req.query.startDate || req.query.appliedDateFrom || '');
  const endDate = normalizeDateInput(req.query.endDate || req.query.appliedDateTo || '');

  const filters = {
    search: String(req.query.search || ''),
    stages,
    role: String(req.query.role || ''),
    location: String(req.query.location || ''),
    source: String(req.query.source || ''),
    minExperience: String(req.query.minExperience || ''),
    maxExperience: String(req.query.maxExperience || ''),
    minCTC: String(req.query.minCTC || ''),
    maxCTC: String(req.query.maxCTC || ''),
    startDate,
    endDate
  };

  const candidates = await query(
    `SELECT id, name, email, phone, position, stage, experience, location, source, applied_date, salary_expected
     FROM candidates
     ORDER BY applied_date DESC`
  );

  const filteredCandidates = applyExportFilters(candidates, filters);
  if (filteredCandidates.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No candidates to export'
    });
  }

  const candidateIds = filteredCandidates.map((c) => c.id);
  let notesMap = {};
  if (candidateIds.length > 0) {
    const notes = await query(
      `SELECT candidate_id, notes
       FROM candidate_notes_ratings
       WHERE candidate_id IN (${candidateIds.map(() => '?').join(',')})
       ORDER BY created_at DESC`,
      candidateIds
    );
    notesMap = notes.reduce((acc, row) => {
      if (!acc[row.candidate_id]) acc[row.candidate_id] = [];
      if (row.notes) acc[row.candidate_id].push(row.notes);
      return acc;
    }, {});
  }

  const exportRows = filteredCandidates.map((candidate) => mapCandidateForExport(candidate, notesMap));
  const summaryLines = buildFilterSummary(filters);
  const dateStamp = getDateStamp();

  if (filteredCandidates.length > 1000) {
    res.setHeader('X-Export-Notice', 'Large export - preparing download');
  }

  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Candidates');

    sheet.addRow([`Candidates Report - ${dateStamp}`]).font = { bold: true, size: 14 };
    sheet.addRow([`Export Date: ${new Date().toLocaleString()}`]);
    for (const line of summaryLines) {
      sheet.addRow([line]);
    }
    sheet.addRow([]);

    const headerRow = sheet.addRow(EXPORT_HEADERS);
    headerRow.font = { bold: true };

    for (const row of exportRows) {
      sheet.addRow([
        row.name,
        row.email,
        row.phone,
        row.role,
        row.stage,
        row.experience,
        row.location,
        row.source,
        row.appliedDate,
        row.expectedCtc,
        row.notesTags
      ]);
    }

    sheet.columns.forEach((column) => {
      let maxLength = 12;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const length = String(cell.value || '').length;
        if (length > maxLength) maxLength = length;
      });
      column.width = Math.min(maxLength + 2, 40);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Candidates_Export_${dateStamp}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  }

  const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Candidates_Export_${dateStamp}.pdf"`);
  doc.pipe(res);

  const addFooter = () => {
    const page = doc.bufferedPageRange();
    for (let i = page.start; i < page.start + page.count; i += 1) {
      doc.switchToPage(i);
      doc.fontSize(9).fillColor('#666')
        .text(`Page ${i + 1}`, 36, doc.page.height - 30, { align: 'right' });
    }
  };

  doc.fontSize(16).fillColor('#111').text('Candidates Report', { align: 'left' });
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor('#444').text(`Export Date: ${new Date().toLocaleString()}`);
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor('#444').text('Applied Filters:');
  for (const line of summaryLines) {
    doc.text(`- ${line}`);
  }
  doc.moveDown(0.8);

  const drawRow = (values, isHeader = false) => {
    const rowText = values.map((v) => String(v ?? '')).join(' | ');
    doc.fontSize(isHeader ? 10 : 9).fillColor(isHeader ? '#000' : '#222').text(rowText, {
      width: doc.page.width - 72
    });
  };

  drawRow(EXPORT_HEADERS, true);
  doc.moveDown(0.3);
  exportRows.forEach((row) => {
    drawRow([
      row.name,
      row.email,
      row.phone,
      row.role,
      row.stage,
      row.experience,
      row.location,
      row.source,
      row.appliedDate,
      row.expectedCtc,
      row.notesTags
    ]);
    doc.moveDown(0.25);
  });

  addFooter();
  doc.end();
}));

// Get candidate by ID
router.get('/:id', authenticateToken, checkPermission('candidates', 'view'), validateUUID('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;

  const candidates = await query(
    `SELECT c.*, u.name as assigned_to_name 
     FROM candidates c
     LEFT JOIN users u ON c.assigned_to = u.id
     WHERE c.id = ?`,
    [candidateId]
  );

  if (candidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  const candidate = candidates[0];

  // Get notes for this candidate from hr_notes table (single source of truth)
  const notes = await query(
    `SELECT hn.id, hn.candidate_id, hn.stage, hn.note_text as notes, hn.interaction_type, 
            hn.author_id as user_id, hn.created_at, hn.updated_at,
            u.name as user_name, u.role as user_role 
     FROM hr_notes hn
     LEFT JOIN users u ON hn.author_id = u.id
     WHERE hn.candidate_id = ?
     ORDER BY hn.created_at DESC`,
    [candidateId]
  );
  candidate.notes = notes;

  // Parse JSON fields and structure data
  try {
    candidate.skills = JSON.parse(candidate.skills || '[]');
  } catch (e) {
    candidate.skills = [];
  }

  // Convert snake_case to camelCase for frontend compatibility
  candidate.resumeFileId = candidate.resume_file_id;
  candidate.resume = candidate.resume_path; // Add resume path for frontend
  candidate.appliedDate = candidate.applied_date;
  candidate.assignedTo = candidate.assigned_to_name || 'Unassigned';
  candidate.assignedToId = candidate.assigned_to || null; // Add user ID for form submission
  
  // Structure salary object
  candidate.salary = {
    expected: candidate.salary_expected || '',
    offered: candidate.salary_offered || '',
    negotiable: Boolean(candidate.salary_negotiable)
  };

  // Structure availability object
  candidate.availability = {
    joiningTime: candidate.joining_time || '',
    noticePeriod: candidate.notice_period || '',
    immediateJoiner: Boolean(candidate.immediate_joiner)
  };

  // Structure work preferences
  candidate.workPreferences = {
    workPreference: candidate.work_preference || null,
    willingAlternateSaturday: candidate.willing_alternate_saturday === null ? null : Boolean(candidate.willing_alternate_saturday),
    currentCtc: candidate.current_ctc || null,
    ctcFrequency: candidate.ctc_frequency || 'Annual'
  };

  // Structure assignment details
  candidate.assignmentDetails = {
    inHouseAssignmentStatus: candidate.in_house_assignment_status || 'Pending',
    interviewDate: candidate.interview_date || null,
    interviewerId: candidate.interviewer_id || null,
    inOfficeAssignment: candidate.in_office_assignment || null
  };

  // Add location fields
  candidate.assignmentLocation = candidate.assignment_location || null;
  candidate.resumeLocation = candidate.resume_location || null;
  
  // Remove snake_case fields
  delete candidate.resume_file_id;
  delete candidate.resume_path;
  delete candidate.applied_date;
  delete candidate.assigned_to_name;
  delete candidate.salary_expected;
  delete candidate.salary_offered;
  delete candidate.salary_negotiable;
  delete candidate.joining_time;
  delete candidate.notice_period;
  delete candidate.immediate_joiner;
  // Remove new snake_case fields
  delete candidate.work_preference;
  delete candidate.willing_alternate_saturday;
  delete candidate.current_ctc;
  delete candidate.ctc_frequency;
  delete candidate.in_house_assignment_status;
  delete candidate.interview_date;
  delete candidate.interviewer_id;
  delete candidate.in_office_assignment;
  // Remove new location snake_case fields
  delete candidate.assignment_location;
  delete candidate.resume_location;

  // Get communications
  const communications = await query(
    `SELECT c.*, u.name as created_by_name 
     FROM communications c
     LEFT JOIN users u ON c.created_by = u.id
     WHERE c.candidate_id = ?
     ORDER BY c.date DESC`,
    [candidateId]
  );
  candidate.communications = communications;

  // Get interviews
  const interviews = await query(
    `SELECT i.*, u.name as interviewer_name 
     FROM interviews i
     LEFT JOIN users u ON i.interviewer_id = u.id
     WHERE i.candidate_id = ?
     ORDER BY i.scheduled_date DESC`,
    [candidateId]
  );


  candidate.interviews = interviews;


  res.json({
    success: true,
    data: { candidate }
  });
}));

// Create new candidate
router.post('/', authenticateToken, checkPermission('candidates', 'create'), validateCandidate, handleValidationErrors, asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    position,
    stage,
    source,
    appliedDate,
    resumePath,
    resumeFileId,
    notes,
    score,
    assignedTo,
    skills = [],
    experience,
    salaryExpected,
    salaryOffered,
    salaryNegotiable,
    joiningTime,
    noticePeriod,
    immediateJoiner,
    jobId,
    // New fields
    location,
    expertise,
    willingAlternateSaturday,
    workPreference,
    currentCtc,
    ctcFrequency,
    inHouseAssignmentStatus,
    interviewDate,
    interviewerId,
    inOfficeAssignment,
    // New location fields
    assignmentLocation,
    resumeLocation
  } = req.body;

  // Validate assigned user exists (only if assignedTo is a valid user ID)
  let assignedUserId = null;
  if (assignedTo && assignedTo !== 'Unassigned') {
    const users = await query('SELECT id FROM users WHERE id = ?', [assignedTo]);
    if (users.length === 0) {
      throw new ValidationError('Assigned user not found');
    }
    assignedUserId = assignedTo;
  }

  // Check if candidate already exists with same email and position
  const existingCandidates = await query(
    'SELECT id FROM candidates WHERE email = ? AND position = ?',
    [email, position]
  );

  if (existingCandidates.length > 0) {
    throw new ConflictError('Candidate already exists for this position');
  }

  // Normalize appliedDate: strip time component if full ISO string was sent
  const normalizedAppliedDate = appliedDate
    ? String(appliedDate).slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // Debug log to catch any remaining undefined bindings before they hit MySQL
  const insertValues = [
    jobId ?? null,
    name ?? null,
    email ?? null,
    phone ?? null,
    position ?? null,
    stage ?? null,
    source ?? null,
    normalizedAppliedDate,
    resumePath ?? null,
    resumeFileId ?? null,
    score ?? 0,
    assignedUserId ?? null,
    JSON.stringify(skills ?? []),
    experience ?? null,
    salaryExpected ?? null,
    salaryOffered ?? null,
    salaryNegotiable ?? false,
    joiningTime ?? null,
    noticePeriod ?? null,
    immediateJoiner ?? false,
    // New fields
    location ?? null,
    expertise ?? null,
    willingAlternateSaturday ?? null,
    workPreference ?? null,
    currentCtc ?? null,
    ctcFrequency ?? 'Annual',
    inHouseAssignmentStatus ?? 'Pending',
    interviewDate ?? null,
    interviewerId ?? null,
    inOfficeAssignment ?? null,
    // New location fields
    assignmentLocation ?? null,
    resumeLocation ?? null,
  ];

  // Guard: ensure no undefined values slip through to MySQL
  const undefinedFields = insertValues.reduce((acc, val, idx) => {
    if (val === undefined) acc.push(idx);
    return acc;
  }, []);
  if (undefinedFields.length > 0) {
    console.warn('[Candidate Create] Undefined values at positions:', undefinedFields);
    throw new ValidationError('Missing required fields in submission');
  }

  console.log('[Candidate Create] Field mapping:', {
    jobId, name, email, phone, position, stage, source,
    appliedDate: normalizedAppliedDate, experience, salaryExpected,
    noticePeriod, currentCtc, location, expertise, workPreference,
    interviewDate, interviewerId, assignmentLocation, resumeLocation
  });

  // Create candidate (without notes field)
  const result = await query(
    `INSERT INTO candidates (job_id, name, email, phone, position, stage, source, applied_date, resume_path, resume_file_id, score, 
     assigned_to, skills, experience, salary_expected, salary_offered, salary_negotiable, joining_time, notice_period, immediate_joiner,
     location, expertise, willing_alternate_saturday, work_preference, current_ctc, ctc_frequency, in_house_assignment_status, 
     interview_date, interviewer_id, in_office_assignment, assignment_location, resume_location) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    insertValues
  );

  // If notes are provided, add them to hr_notes table (single source of truth)
  if (notes && typeof notes === 'string' && notes.trim()) {
    await query(
      `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [result.insertId, stage || 'Applied', notes.trim(), 'General Note', req.user.id]
    );
  }

  // Sync assignment status: Update assignments table if inHouseAssignmentStatus is set
  if (inHouseAssignmentStatus && inHouseAssignmentStatus !== 'Draft') {
    // Map candidate status to assignment status
    const statusMapping = {
      'Assigned': 'Assigned',
      'In Progress': 'In Progress', 
      'Submitted': 'Submitted',
      'Approved': 'Approved',
      'Rejected': 'Rejected',
      'Cancelled': 'Cancelled'
    };
    
    const assignmentStatus = statusMapping[inHouseAssignmentStatus];
    if (assignmentStatus) {
      // Update all assignments for this candidate to the new status
      await query(
        `UPDATE assignments SET status = ?, updated_at = NOW() WHERE candidate_id = ?`,
        [assignmentStatus, result.insertId]
      );
    }
  }

  res.status(201).json({
    success: true,
    message: 'Candidate created successfully',
    data: {
      candidateId: result.insertId
    }
  });

  // Trigger workflow engine for candidate creation (non-blocking, after response)
  const newCandidateId = result.insertId;
  const creatingUserId = req.user.id;
  setImmediate(async () => {
    try {
      const workflowEngine = (await import('../services/workflowEngine.js')).default;
      const [newCandidate] = await query(
        `SELECT c.*, j.title as job_title, u.name as assigned_to_name
         FROM candidates c
         LEFT JOIN job_postings j ON j.id = c.job_id
         LEFT JOIN users u ON u.id = c.assigned_to
         WHERE c.id = ?`,
        [newCandidateId]
      );
      if (newCandidate) {
        await workflowEngine.run('candidate', 'created', newCandidate, creatingUserId);
      }
    } catch (err) {
      console.error('[Candidate Create] Workflow engine failed:', err);
    }
  });
}));

// Update candidate
router.put('/:id', authenticateToken, checkPermission('candidates', 'edit'), validateUUID('id'), validateCandidate, handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;
  const {
    name,
    email,
    phone,
    position,
    stage,
    source,
    appliedDate,
    resumePath,
    notes,
    score,
    assignedTo,
    skills = [],
    experience,
    salaryExpected,
    salaryOffered,
    salaryNegotiable,
    joiningTime,
    noticePeriod,
    immediateJoiner,
    // New fields
    location,
    expertise,
    willingAlternateSaturday,
    workPreference,
    currentCtc,
    ctcFrequency,
    inHouseAssignmentStatus,
    interviewDate,
    interviewerId,
    inOfficeAssignment,
    // New location fields
    assignmentLocation,
    resumeLocation
  } = req.body;

  // Check if candidate exists
  const existingCandidates = await query('SELECT id FROM candidates WHERE id = ?', [candidateId]);
  if (existingCandidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  // Validate assigned user exists (only if assignedTo is a valid user ID)
  let assignedUserId = null;
  if (assignedTo && assignedTo !== 'Unassigned') {
    const users = await query('SELECT id FROM users WHERE id = ?', [assignedTo]);
    if (users.length === 0) {
      throw new ValidationError('Assigned user not found');
    }
    assignedUserId = assignedTo;
  }

  // Normalize appliedDate: strip time component if full ISO string was sent
  const safeAppliedDate = appliedDate
    ? String(appliedDate).slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // Convert undefined values to null to avoid SQL binding errors
  const safeResumePath = resumePath === undefined ? null : resumePath;
  const safeNotes = notes === undefined ? null : notes;
  const safeScore = score === undefined ? null : score;
  const safeExperience = experience === undefined ? null : experience;
  const safeSalaryExpected = salaryExpected === undefined ? null : salaryExpected;
  const safeSalaryOffered = salaryOffered === undefined ? null : salaryOffered;
  const safeSalaryNegotiable = salaryNegotiable === undefined ? false : salaryNegotiable;
  const safeJoiningTime = joiningTime === undefined ? null : joiningTime;
  const safeNoticePeriod = noticePeriod === undefined ? null : noticePeriod;
  const safeImmediateJoiner = immediateJoiner === undefined ? false : immediateJoiner;
  // New fields safe values
  const safeLocation = location === undefined ? null : location;
  const safeExpertise = expertise === undefined ? null : expertise;
  const safeWillingAlternateSaturday = willingAlternateSaturday === undefined ? null : willingAlternateSaturday;
  const safeWorkPreference = workPreference === undefined ? null : workPreference;
  const safeCurrentCtc = currentCtc === undefined ? null : currentCtc;
  const safeCtcFrequency = ctcFrequency === undefined ? 'Annual' : ctcFrequency;
  const safeInHouseAssignmentStatus = inHouseAssignmentStatus === undefined ? 'Pending' : inHouseAssignmentStatus;
  const safeInterviewDate = interviewDate === undefined ? null : interviewDate;
  const safeInterviewerId = interviewerId === undefined ? null : interviewerId;
  const safeInOfficeAssignment = inOfficeAssignment === undefined ? null : inOfficeAssignment;
  // New location fields safe values
  const safeAssignmentLocation = assignmentLocation === undefined ? null : assignmentLocation;
  const safeResumeLocation = resumeLocation === undefined ? null : resumeLocation;

  // Update candidate (without notes field)
  await query(
    `UPDATE candidates SET name = ?, email = ?, phone = ?, position = ?, stage = ?, source = ?, applied_date = ?, 
     resume_path = ?, score = ?, assigned_to = ?, skills = ?, experience = ?, salary_expected = ?, 
     salary_offered = ?, salary_negotiable = ?, joining_time = ?, notice_period = ?, immediate_joiner = ?,
     location = ?, expertise = ?, willing_alternate_saturday = ?, work_preference = ?, current_ctc = ?, 
     ctc_frequency = ?, in_house_assignment_status = ?, interview_date = ?, interviewer_id = ?, 
     in_office_assignment = ?, assignment_location = ?, resume_location = ?, updated_at = NOW() 
     WHERE id = ?`,
    [name, email, phone, position, stage, source, safeAppliedDate, safeResumePath, safeScore, assignedUserId,
     JSON.stringify(skills), safeExperience, safeSalaryExpected, safeSalaryOffered, safeSalaryNegotiable, safeJoiningTime, safeNoticePeriod, safeImmediateJoiner,
     safeLocation, safeExpertise, safeWillingAlternateSaturday, safeWorkPreference, safeCurrentCtc, safeCtcFrequency, 
     safeInHouseAssignmentStatus, safeInterviewDate, safeInterviewerId, safeInOfficeAssignment, 
     safeAssignmentLocation, safeResumeLocation, candidateId]
  );

  // If notes are provided, add them to hr_notes table (single source of truth)
  if (notes && typeof notes === 'string' && notes.trim()) {
    await query(
      `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [candidateId, stage, notes.trim(), 'General Note', req.user.id]
    );
  }

  // Sync assignment status: Update assignments table if inHouseAssignmentStatus changed
  if (inHouseAssignmentStatus && inHouseAssignmentStatus !== 'Draft') {
    // Map candidate status to assignment status
    const statusMapping = {
      'Assigned': 'Assigned',
      'In Progress': 'In Progress', 
      'Submitted': 'Submitted',
      'Approved': 'Approved',
      'Rejected': 'Rejected',
      'Cancelled': 'Cancelled'
    };
    
    const assignmentStatus = statusMapping[inHouseAssignmentStatus];
    if (assignmentStatus) {
      // Update all assignments for this candidate to the new status
      await query(
        `UPDATE assignments SET status = ?, updated_at = NOW() WHERE candidate_id = ?`,
        [assignmentStatus, candidateId]
      );
    }
  }

  res.json({
    success: true,
    message: 'Candidate updated successfully'
  });
}));

// Partial update candidate (for assignment updates)
router.patch('/:id', authenticateToken, checkPermission('candidates', 'edit'), validateUUID('id'), validateCandidatePartial, handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;
  const updateData = req.body;

  // Check if candidate exists
  const existingCandidates = await query('SELECT id FROM candidates WHERE id = ?', [candidateId]);
  if (existingCandidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  // Build dynamic update query based on provided fields
  const updateFields = [];
  const updateValues = [];

  // Only update fields that are provided in the request
  if (updateData.name !== undefined) {
    updateFields.push('name = ?');
    updateValues.push(updateData.name);
  }
  if (updateData.email !== undefined) {
    updateFields.push('email = ?');
    updateValues.push(updateData.email);
  }
  if (updateData.phone !== undefined) {
    updateFields.push('phone = ?');
    updateValues.push(updateData.phone);
  }
  if (updateData.position !== undefined) {
    updateFields.push('position = ?');
    updateValues.push(updateData.position);
  }
  if (updateData.stage !== undefined) {
    updateFields.push('stage = ?');
    updateValues.push(updateData.stage);
  }
  if (updateData.source !== undefined) {
    updateFields.push('source = ?');
    updateValues.push(updateData.source);
  }
  if (updateData.appliedDate !== undefined) {
    updateFields.push('applied_date = ?');
    // Normalize: strip time component if full ISO string was sent
    updateValues.push(updateData.appliedDate ? String(updateData.appliedDate).slice(0, 10) : null);
  }
  if (updateData.resumePath !== undefined) {
    updateFields.push('resume_path = ?');
    updateValues.push(updateData.resumePath);
  }
  if (updateData.assignedTo !== undefined) {
    const assignedUserId = updateData.assignedTo === 'Unassigned' ? null : updateData.assignedTo;
    updateFields.push('assigned_to = ?');
    updateValues.push(assignedUserId);
  }
  if (updateData.score !== undefined) {
    updateFields.push('score = ?');
    updateValues.push(updateData.score);
  }
  if (updateData.assignmentLocation !== undefined) {
    updateFields.push('assignment_location = ?');
    updateValues.push(updateData.assignmentLocation);
  }
  if (updateData.inOfficeAssignment !== undefined) {
    updateFields.push('in_office_assignment = ?');
    updateValues.push(updateData.inOfficeAssignment);
  }
  if (updateData.inHouseAssignmentStatus !== undefined) {
    updateFields.push('in_house_assignment_status = ?');
    updateValues.push(updateData.inHouseAssignmentStatus);
  }

  // Add updated_at timestamp
  updateFields.push('updated_at = NOW()');
  updateValues.push(candidateId);

  if (updateFields.length === 1) { // Only updated_at was added
    return res.json({
      success: true,
      message: 'No fields to update'
    });
  }

  // Execute the update
  await query(
    `UPDATE candidates SET ${updateFields.join(', ')} WHERE id = ?`,
    updateValues
  );

  // If notes are provided, add them to hr_notes table (single source of truth)
  if (updateData.notes && typeof updateData.notes === 'string' && updateData.notes.trim()) {
    // Get current stage for the note
    const [candidateData] = await query('SELECT stage FROM candidates WHERE id = ?', [candidateId]);
    const currentStage = candidateData?.stage || 'Applied';
    
    await query(
      `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [candidateId, currentStage, updateData.notes.trim(), 'General Note', req.user.id]
    );
  }

  res.json({
    success: true,
    message: 'Candidate updated successfully'
  });
}));

// Delete candidate
router.delete('/:id', authenticateToken, checkPermission('candidates', 'delete'), validateUUID('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;

  // Check if candidate exists
  const existingCandidates = await query('SELECT id FROM candidates WHERE id = ?', [candidateId]);
  if (existingCandidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  // Delete candidate (cascading will handle related records)
  await query('DELETE FROM candidates WHERE id = ?', [candidateId]);

  res.json({
    success: true,
    message: 'Candidate deleted successfully'
  });
}));

// Bulk delete candidates (POST to avoid DELETE body parsing issues)
router.post('/bulk-delete', authenticateToken, checkPermission('candidates', 'delete'), asyncHandler(async (req, res) => {
  const { ids } = req.body || {};

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ValidationError('ids must be a non-empty array of candidate IDs');
  }

  if (ids.length > 500) {
    throw new ValidationError('Cannot delete more than 500 candidates at once');
  }

  // Coerce all values to strings and filter out empty ones
  const cleanIds = ids.map(id => String(id).trim()).filter(Boolean);
  if (cleanIds.length === 0) {
    throw new ValidationError('No valid candidate IDs provided');
  }

  const placeholders = cleanIds.map(() => '?').join(', ');
  const result = await query(
    `DELETE FROM candidates WHERE id IN (${placeholders})`,
    cleanIds
  );

  res.json({
    success: true,
    message: `${result.affectedRows} candidate(s) deleted successfully`,
    data: { deletedCount: result.affectedRows }
  });
}));

// Bulk delete candidates (DELETE method kept for REST compliance)
router.delete('/', authenticateToken, checkPermission('candidates', 'delete'), asyncHandler(async (req, res) => {
  const { ids } = req.body || {};

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ValidationError('ids must be a non-empty array of candidate IDs');
  }

  if (ids.length > 500) {
    throw new ValidationError('Cannot delete more than 500 candidates at once');
  }

  const cleanIds = ids.map(id => String(id).trim()).filter(Boolean);
  if (cleanIds.length === 0) {
    throw new ValidationError('No valid candidate IDs provided');
  }

  const placeholders = cleanIds.map(() => '?').join(', ');
  const result = await query(
    `DELETE FROM candidates WHERE id IN (${placeholders})`,
    cleanIds
  );

  res.json({
    success: true,
    message: `${result.affectedRows} candidate(s) deleted successfully`,
    data: { deletedCount: result.affectedRows }
  });
}));

// Update candidate stage (with automation)
router.patch('/:id/stage', authenticateToken, checkPermission('candidates', 'edit'), validateUUID('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;
  const { stage, notes } = req.body;

  if (!stage) {
    throw new ValidationError('Stage is required');
  }

  const validStages = ['Applied', 'Follow Up', 'Screening', 'Interview', 'Offer', 'Hired', 'On Hold', 'Rejected', 'No Show - Interview', 'No Show - Onboarding', 'Last Minute Back Out', 'Profile Not Matched'];
  if (!validStages.includes(stage)) {
    throw new ValidationError('Invalid stage');
  }

  // Check if candidate exists and get current stage
  const [candidate] = await query('SELECT id, name, stage FROM candidates WHERE id = ?', [candidateId]);
  if (!candidate) {
    throw new NotFoundError('Candidate not found');
  }

  const previousStage = candidate.stage;
  const candidateName = candidate.name;

  // Only proceed if stage actually changed
  if (previousStage === stage) {
    return res.json({
      success: true,
      message: 'Candidate stage unchanged'
    });
  }

  // Import automation services
  const automationEngine = (await import('../services/automationEngine.js')).default;
  const activityLogger = (await import('../services/activityLogger.js')).default;

  // Update stage with previous_stage tracking
  await query(
    'UPDATE candidates SET stage = ?, previous_stage = ?, stage_updated_at = NOW(), updated_at = NOW() WHERE id = ?',
    [stage, previousStage, candidateId]
  );

  // Log stage change activity
  await activityLogger.logStageChange({
    candidateId,
    previousStage,
    newStage: stage,
    userId: req.user.id,
    candidateName
  });

  // Create HR note for stage change event
  const stageChangeNoteText = `Stage changed from ${previousStage} to ${stage}`;
  await query(
    `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id) VALUES (?, ?, ?, ?, ?)`,
    [candidateId, stage, stageChangeNoteText, 'Stage Change', req.user.id]
  );

  // If notes are provided, add them to hr_notes table (single source of truth)
  if (notes && typeof notes === 'string' && notes.trim()) {
    await query(
      `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [candidateId, stage, notes.trim(), 'General Note', req.user.id]
    );
  }

  // Create in-app notification for important stage changes
  if (['Offer', 'Hired', 'Rejected'].includes(stage)) {
    // Get candidate's assigned recruiter
    const [candidateData] = await query(
      'SELECT assigned_to FROM candidates WHERE id = ?',
      [candidateId]
    );
    
    if (candidateData && candidateData.assigned_to) {
      await createNotification(candidateData.assigned_to, {
        type: 'candidate_stage_change',
        title: `Candidate Stage Updated`,
        message: `${candidateName} moved to ${stage} stage`,
        link: `/candidates/${candidateId}`
      });
    }
    
    // Also notify admins and HR managers for Hired/Rejected
    if (['Hired', 'Rejected'].includes(stage)) {
      const admins = await query(
        'SELECT id FROM users WHERE role IN ("Admin", "HR Manager")'
      );
      for (const admin of admins) {
        if (admin.id !== req.user.id) { // Don't notify the person who made the change
          await createNotification(admin.id, {
            type: 'candidate_stage_change',
            title: `Candidate ${stage}`,
            message: `${candidateName} has been ${stage.toLowerCase()}`,
            link: `/candidates/${candidateId}`
          });
        }
      }
    }
  }

  // Execute automations asynchronously (non-blocking)
  setImmediate(async () => {
    try {
      await automationEngine.executeStageChangeAutomations({
        candidateId,
        newStage: stage,
        previousStage,
        userId: req.user.id
      });
    } catch (error) {
      console.error('[Stage Update] Automation execution failed:', error);
    }
  });

  // Execute Phase 3 workflow engine (non-blocking)
  setImmediate(async () => {
    try {
      const workflowEngine = (await import('../services/workflowEngine.js')).default;
      const [fullCandidate] = await query(
        `SELECT c.*, j.title as job_title, u.name as assigned_to_name
         FROM candidates c
         LEFT JOIN job_postings j ON j.id = c.job_id
         LEFT JOIN users u ON u.id = c.assigned_to
         WHERE c.id = ?`,
        [candidateId]
      );
      if (fullCandidate) {
        await workflowEngine.run('candidate', 'stage_change', fullCandidate, req.user.id);
      }
    } catch (error) {
      console.error('[Stage Update] Workflow engine failed:', error);
    }
  });

  res.json({
    success: true,
    message: 'Candidate stage updated successfully',
    data: {
      candidate: {
        id: candidateId,
        name: candidateName,
        stage: stage,
        previousStage: previousStage
      },
      previousStage,
      newStage: stage,
      automationTriggered: true
    }
  });
}));

// Get candidate analytics
router.get('/:id/analytics', authenticateToken, checkPermission('candidates', 'view'), validateUUID('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;

  // Check if candidate exists
  const candidates = await query('SELECT id, name, position FROM candidates WHERE id = ?', [candidateId]);
  if (candidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  const candidate = candidates[0];

  // Get analytics data
  const analytics = await query(
    `SELECT 
       (SELECT COUNT(*) FROM communications WHERE candidate_id = ?) as total_communications,
       (SELECT COUNT(*) FROM interviews WHERE candidate_id = ?) as total_interviews,
       (SELECT COUNT(*) FROM interviews WHERE candidate_id = ? AND status = 'Completed') as completed_interviews,
       (SELECT DATEDIFF(NOW(), applied_date) FROM candidates WHERE id = ?) as days_in_pipeline`,
    [candidateId, candidateId, candidateId, candidateId, candidateId]
  );

  // Get stage timeline
  const timeline = await query(
    `SELECT 'applied' as event, applied_date as date, stage as status FROM candidates WHERE id = ?
     UNION ALL
     SELECT 'communication' as event, date, type as status FROM communications WHERE candidate_id = ?
     UNION ALL
     SELECT 'interview' as event, scheduled_date as date, status FROM interviews WHERE candidate_id = ?
     ORDER BY date DESC`,
    [candidateId, candidateId, candidateId]
  );

  res.json({
    success: true,
    data: {
      candidate,
      analytics: analytics[0],
      timeline
    }
  });
}));

// Bulk import candidates
router.post('/bulk-import', authenticateToken, checkPermission('candidates', 'create'), asyncHandler(async (req, res) => {
  const { candidates } = req.body;

  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new ValidationError('Candidates array is required');
  }

  const results = [];
  const errors = [];

  for (let i = 0; i < candidates.length; i++) {
    try {
      const candidate = candidates[i];
      
      // Skip completely empty rows
      const hasAnyData = candidate.name || candidate.email || candidate.phone;
      if (!hasAnyData) {
        continue;
      }
      
      // Validate required fields (only name and email are required)
      if (!candidate.name || !candidate.email) {
        errors.push({ row: i + 1, error: 'Missing required fields (name and email)' });
        continue;
      }

      // Set default assignedTo if not provided
      let assignedTo = candidate.assignedTo || 1; // Default to admin user ID 1

      // Validate assigned user exists
      const users = await query('SELECT id FROM users WHERE id = ?', [assignedTo]);
      if (users.length === 0) {
        errors.push({ row: i + 1, error: 'Assigned user not found' });
        continue;
      }

      // Resolve interviewer name to ID
      let interviewerId = null;
      if (candidate.interviewerName && candidate.interviewerName.trim()) {
        // Try exact match first
        let interviewerQuery = await query('SELECT id FROM users WHERE name = ?', [candidate.interviewerName.trim()]);
        
        // If not found, try case-insensitive search
        if (interviewerQuery.length === 0) {
          interviewerQuery = await query('SELECT id FROM users WHERE LOWER(name) = LOWER(?)', [candidate.interviewerName.trim()]);
        }
        
        // If still not found, try partial match
        if (interviewerQuery.length === 0) {
          interviewerQuery = await query('SELECT id FROM users WHERE LOWER(name) LIKE LOWER(?)', [`%${candidate.interviewerName.trim()}%`]);
        }
        
        if (interviewerQuery.length > 0) {
          interviewerId = interviewerQuery[0].id;
        }
      }

      // Create candidate with all new fields (without notes field)
      const result = await query(
        `INSERT INTO candidates (job_id, name, email, phone, position, stage, source, applied_date, resume_path, score, 
         assigned_to, skills, experience, salary_expected, salary_offered, salary_negotiable, joining_time, notice_period, immediate_joiner,
         location, expertise, willing_alternate_saturday, work_preference, current_ctc, ctc_frequency, in_house_assignment_status, 
         interview_date, interviewer_id, in_office_assignment, assignment_location, resume_location) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [candidate.jobId || null, candidate.name, candidate.email, candidate.phone || '', candidate.position || '', candidate.stage || 'Applied',
         candidate.source || 'Bulk Import', candidate.appliedDate || new Date().toISOString().split('T')[0],
         candidate.resumePath || null, candidate.score || 0, assignedTo,
         JSON.stringify(candidate.skills || []), candidate.experience || '', candidate.expectedSalary || '', 
         candidate.salaryOffered || '', candidate.salaryNegotiable !== undefined ? candidate.salaryNegotiable : true,
         candidate.joiningTime || '', candidate.noticePeriod || '', candidate.immediateJoiner || false,
         // New fields
         candidate.location || null, candidate.expertise || null, candidate.willingAlternateSaturday || null,
         candidate.workPreference || null, candidate.currentCtc || null, candidate.ctcFrequency || 'Annual',
         candidate.inHouseAssignmentStatus || 'Pending', candidate.interviewDate || null, interviewerId,
         candidate.inOfficeAssignment || null, candidate.assignmentLocation || null, candidate.resumeLocation || null]
      );

      // If notes are provided, add them to hr_notes table (single source of truth)
      if (candidate.notes && typeof candidate.notes === 'string' && candidate.notes.trim()) {
        await query(
          `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [result.insertId, candidate.stage || 'Applied', candidate.notes.trim(), 'General Note', req.user.id]
        );
      }

      // Sync assignment status: Update assignments table if inHouseAssignmentStatus is set
      if (candidate.inHouseAssignmentStatus && candidate.inHouseAssignmentStatus !== 'Draft') {
        // Map candidate status to assignment status
        const statusMapping = {
          'Assigned': 'Assigned',
          'In Progress': 'In Progress', 
          'Submitted': 'Submitted',
          'Approved': 'Approved',
          'Rejected': 'Rejected',
          'Cancelled': 'Cancelled'
        };
        
        const assignmentStatus = statusMapping[candidate.inHouseAssignmentStatus];
        if (assignmentStatus) {
          // Update all assignments for this candidate to the new status
          await query(
            `UPDATE assignments SET status = ?, updated_at = NOW() WHERE candidate_id = ?`,
            [assignmentStatus, result.insertId]
          );
        }
      }

      results.push({ row: i + 1, candidateId: result.insertId });
    } catch (error) {
      errors.push({ row: i + 1, error: error.message });
    }
  }

  res.status(201).json({
    success: true,
    message: `Bulk import completed. ${results.length} candidates imported successfully.`,
    data: {
      imported: results,
      errors
    }
  });
}));

// Download candidate resume
router.get('/:id/resume', authenticateToken, checkPermission('candidates', 'view'), validateUUID('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;

  // Get candidate with file information
  const candidates = await query(
    `SELECT c.*, fu.filename, fu.original_name, fu.mime_type, fu.file_path
     FROM candidates c
     LEFT JOIN file_uploads fu ON c.resume_file_id = fu.id
     WHERE c.id = ?`,
    [candidateId]
  );

  if (candidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  const candidate = candidates[0];

  if (!candidate.filename) {
    throw new NotFoundError('No resume file found for this candidate');
  }

  const filePath = fileStorageService.getFilePath(candidate.filename);

  if (!fs.existsSync(filePath)) {
    throw new NotFoundError('Resume file not found on disk');
  }

  res.setHeader('Content-Disposition', `attachment; filename="${candidate.original_name}"`);
  res.setHeader('Content-Type', candidate.mime_type);
  res.sendFile(filePath);
}));

// Get candidate resume metadata
router.get('/:id/resume/metadata', authenticateToken, checkPermission('candidates', 'view'), validateUUID('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;

  const candidates = await query(
    `SELECT c.name as candidate_name, fu.filename, fu.original_name, fu.file_size, fu.mime_type, fu.uploaded_at, u.name as uploaded_by_name
     FROM candidates c
     LEFT JOIN file_uploads fu ON c.resume_file_id = fu.id
     LEFT JOIN users u ON fu.uploaded_by = u.id
     WHERE c.id = ?`,
    [candidateId]
  );

  if (candidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  const candidate = candidates[0];

  if (!candidate.filename) {
    res.json({
      success: true,
      data: {
        hasResume: false,
        message: 'No resume file found for this candidate'
      }
    });
    return;
  }

  res.json({
    success: true,
    data: {
      hasResume: true,
      candidateName: candidate.candidate_name,
      filename: candidate.filename,
      originalName: candidate.original_name,
      fileSize: candidate.file_size,
      mimeType: candidate.mime_type,
      uploadedAt: candidate.uploaded_at,
      uploadedBy: candidate.uploaded_by_name
    }
  });
}));

// Add note to candidate
router.post('/:id/notes', authenticateToken, checkPermission('candidates', 'edit'), validateUUID('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;
  const { notes, rating, ratingComments, recommendation } = req.body;

  // Check if candidate exists
  const existingCandidates = await query('SELECT id FROM candidates WHERE id = ?', [candidateId]);
  if (existingCandidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  // Add note/rating/recommendation to candidate_notes_ratings table
  const result = await query(
    `INSERT INTO candidate_notes_ratings (candidate_id, user_id, notes, rating, rating_comments, recommendation) VALUES (?, ?, ?, ?, ?, ?)`,
    [candidateId, req.user.id, notes || null, rating || null, ratingComments || null, recommendation || null]
  );

  res.json({
    success: true,
    message: 'Note/rating added successfully',
    data: {
      id: result.insertId
    }
  });
}));

// Add interview notes and recommendation (for interviewers - limited permission)
router.post('/:id/interview-notes', authenticateToken, checkPermission('candidates', 'view'), validateUUID('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;
  const { notes, recommendation } = req.body;

  // Check if candidate exists
  const existingCandidates = await query('SELECT id FROM candidates WHERE id = ?', [candidateId]);
  if (existingCandidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  // Validate that the user is an interviewer and has an interview assigned to this candidate
  if (req.user.role !== 'Interviewer') {
    return res.status(403).json({
      success: false,
      message: 'This endpoint is only available for interviewers'
    });
  }

  // Check if the interviewer has an interview assigned to this candidate
  const interviewCheck = await query(
    'SELECT id FROM interviews WHERE candidate_id = ? AND interviewer_id = ?',
    [candidateId, req.user.id]
  );

  if (interviewCheck.length === 0) {
    return res.status(403).json({
      success: false,
      message: 'You are not assigned to interview this candidate'
    });
  }

  // Add interview notes and recommendation to candidate_notes_ratings table
  const result = await query(
    `INSERT INTO candidate_notes_ratings (candidate_id, user_id, notes, recommendation) VALUES (?, ?, ?, ?)`,
    [candidateId, req.user.id, notes || null, recommendation || null]
  );

  res.json({
    success: true,
    message: 'Interview notes and recommendation added successfully',
    data: {
      id: result.insertId
    }
  });
}));

// Get candidate notes and ratings
router.get('/:id/notes', authenticateToken, checkPermission('candidates', 'view'), validateUUID('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;

  // Check if candidate exists
  const existingCandidates = await query('SELECT id FROM candidates WHERE id = ?', [candidateId]);
  if (existingCandidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  // Get notes and ratings for this candidate
  const notes = await query(
    `SELECT cnr.*, u.name as user_name, u.role as user_role 
     FROM candidate_notes_ratings cnr
     LEFT JOIN users u ON cnr.user_id = u.id
     WHERE cnr.candidate_id = ?
     ORDER BY cnr.created_at DESC`,
    [candidateId]
  );

  res.json({
    success: true,
    data: notes
  });
}));

// Delete a specific candidate note
router.delete('/:id/notes/:noteId', authenticateToken, checkPermission('candidates', 'edit'), [...validateUUID('id'), ...validateId('noteId')], handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;
  const noteId = req.params.noteId;

  // Check if candidate exists
  const existingCandidates = await query('SELECT id FROM candidates WHERE id = ?', [candidateId]);
  if (existingCandidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  // Check if note exists for this candidate
  const existingNotes = await query(
    'SELECT id, user_id FROM candidate_notes_ratings WHERE id = ? AND candidate_id = ?',
    [noteId, candidateId]
  );

  if (existingNotes.length === 0) {
    throw new NotFoundError('Note not found');
  }

  const note = existingNotes[0];

  // Only allow the note owner, Admin, or HR Manager to delete the note
  if (note.user_id !== req.user.id && req.user.role !== 'Admin' && req.user.role !== 'HR Manager') {
    throw new ValidationError('You can only delete your own notes');
  }

  await query('DELETE FROM candidate_notes_ratings WHERE id = ?', [noteId]);

  res.json({
    success: true,
    message: 'Note deleted successfully'
  });
}));

// Add interaction candidate to pipeline
router.post('/add-from-interaction', authenticateToken, checkPermission('candidates', 'create'), asyncHandler(async (req, res) => {
  const { interactionId } = req.body;

  if (!interactionId) {
    throw new ValidationError('interactionId is required');
  }

  // Get interaction candidate data
  const interactionCandidates = await query(
    'SELECT * FROM interaction_candidates WHERE id = ?',
    [interactionId]
  );

  if (interactionCandidates.length === 0) {
    throw new NotFoundError('Interaction candidate not found');
  }

  const interactionCandidate = interactionCandidates[0];

  const { checkForDuplicateCandidate, createCandidateFromInteraction, linkInteractionToCandidate, migrateInteractionNotesToHRNotes } = await import('../services/integrationService.js');

  // Check if already linked to a candidate
  if (interactionCandidate.candidate_id) {
    // Return existing candidate
    const existingCandidates = await query(
      'SELECT * FROM candidates WHERE id = ?',
      [interactionCandidate.candidate_id]
    );

    if (existingCandidates.length > 0) {
      // Re-sync interaction notes on explicit user action ("View Candidate"/"Add to Pipeline")
      // so deleted/missing notes can be migrated again without duplicating existing ones.
      const migratedCount = await migrateInteractionNotesToHRNotes(interactionId, interactionCandidate.candidate_id);

      return res.json({
        success: true,
        data: {
          candidateId: interactionCandidate.candidate_id,
          isNew: false,
          candidate: existingCandidates[0],
          migratedCount
        }
      });
    }
  }

  // Check if candidate exists by phone or email
  const duplicateCheck = await checkForDuplicateCandidate(
    interactionCandidate.phone,
    interactionCandidate.email
  );
  
  let candidate = null;
  let isNew = false;

  if (duplicateCheck) {
    // Candidate exists, link interaction to candidate
    candidate = duplicateCheck.candidate;
    await linkInteractionToCandidate(interactionId, candidate.id);
    
    // Migrate interaction notes to HR notes
    await migrateInteractionNotesToHRNotes(interactionId, candidate.id);
    
    // Return with information about how the duplicate was matched
    return res.json({
      success: true,
      data: {
        candidateId: candidate.id,
        isNew: false,
        candidate,
        matchedBy: duplicateCheck.matchedBy,
        message: `Candidate already exists with the same ${duplicateCheck.matchedBy}. Interaction has been linked to existing candidate.`
      }
    });
  } else {
    // Create new candidate from interaction (skip duplicate check since we already checked)
    const candidateId = await createCandidateFromInteraction(
      {
        name: interactionCandidate.name,
        phone: interactionCandidate.phone,
        email: interactionCandidate.email,
        source: interactionCandidate.source || 'Interaction'
      },
      interactionCandidate.status,
      true // Skip duplicate check
    );

    // Link interaction to new candidate
    await linkInteractionToCandidate(interactionId, candidateId);

    // Migrate interaction notes to HR notes
    await migrateInteractionNotesToHRNotes(interactionId, candidateId);

    // Fetch the newly created candidate
    const newCandidates = await query(
      'SELECT * FROM candidates WHERE id = ?',
      [candidateId]
    );

    candidate = newCandidates[0];
    isNew = true;
  }

  res.json({
    success: true,
    data: {
      candidateId: candidate.id,
      isNew,
      candidate,
      message: isNew ? 'Candidate successfully added to pipeline.' : 'Interaction linked to existing candidate.'
    }
  });
}));

// Get HR notes for a candidate (grouped by stage)
router.get('/:id/hr-notes', authenticateToken, checkPermission('candidates', 'view'), validateUUID('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;

  // Check if candidate exists
  const existingCandidates = await query('SELECT id FROM candidates WHERE id = ?', [candidateId]);
  if (existingCandidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  // Fetch all HR notes for this candidate with author information
  const hrNotes = await query(
    `SELECT 
      hn.id,
      hn.candidate_id,
      hn.stage,
      hn.note_text,
      hn.interaction_type,
      hn.author_id,
      hn.created_at,
      hn.updated_at,
      u.name as author_name,
      u.role as author_role
     FROM hr_notes hn
     LEFT JOIN users u ON hn.author_id = u.id
     WHERE hn.candidate_id = ?
     ORDER BY hn.created_at DESC`,
    [candidateId]
  );

  // Group notes by stage
  const notesByStage = {};
  
  for (const note of hrNotes) {
    const stage = note.stage;
    
    if (!notesByStage[stage]) {
      notesByStage[stage] = [];
    }
    
    notesByStage[stage].push({
      id: note.id,
      note_text: note.note_text,
      interaction_type: note.interaction_type,
      author_name: note.author_name || 'Unknown',
      author_role: note.author_role || null,
      created_at: note.created_at,
      updated_at: note.updated_at
    });
  }

  res.json({
    success: true,
    data: {
      // Keep contract aligned with frontend hrNotesAPI expectations.
      notesByStage
    }
  });
}));

// Create new HR note for a candidate
router.post('/:id/hr-notes', authenticateToken, checkPermission('candidates', 'edit'), validateUUID('id'), handleValidationErrors, asyncHandler(async (req, res) => {
  const candidateId = req.params.id;
  const { note_text, interaction_type } = req.body;

  // Validate required fields
  if (!note_text || typeof note_text !== 'string' || !note_text.trim()) {
    throw new ValidationError('note_text is required and must be a non-empty string');
  }

  // Validate interaction_type if provided
  const validInteractionTypes = ['Phone Call', 'Email', 'Interview', 'Stage Change', 'General Note', 'System Event'];
  const interactionType = interaction_type || 'General Note';
  
  if (!validInteractionTypes.includes(interactionType)) {
    throw new ValidationError(`interaction_type must be one of: ${validInteractionTypes.join(', ')}`);
  }

  // Check if candidate exists and get current stage
  const candidates = await query('SELECT id, stage FROM candidates WHERE id = ?', [candidateId]);
  if (candidates.length === 0) {
    throw new NotFoundError('Candidate not found');
  }

  const candidate = candidates[0];
  const currentStage = candidate.stage;

  // Insert new HR note
  const result = await query(
    `INSERT INTO hr_notes (candidate_id, stage, note_text, interaction_type, author_id, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [candidateId, currentStage, note_text.trim(), interactionType, req.user.id]
  );

  // Fetch the created note with author information
  const createdNotes = await query(
    `SELECT 
      hn.id,
      hn.candidate_id,
      hn.stage,
      hn.note_text,
      hn.interaction_type,
      hn.author_id,
      hn.created_at,
      u.name as author_name,
      u.role as author_role
     FROM hr_notes hn
     LEFT JOIN users u ON hn.author_id = u.id
     WHERE hn.id = ?`,
    [result.insertId]
  );

  const createdNote = createdNotes[0];

  res.status(201).json({
    success: true,
    data: {
      id: createdNote.id,
      candidate_id: createdNote.candidate_id,
      stage: createdNote.stage,
      note_text: createdNote.note_text,
      interaction_type: createdNote.interaction_type,
      author_id: createdNote.author_id,
      author_name: createdNote.author_name || 'Unknown',
      author_role: createdNote.author_role || null,
      created_at: createdNote.created_at
    }
  });
}));

// Check if candidate exists in main pipeline by phone
router.get('/check-by-phone/:phone', authenticateToken, checkPermission('candidates', 'view'), asyncHandler(async (req, res) => {
  const phone = decodeURIComponent(req.params.phone);
  
  if (!phone || phone.trim().length < 7) {
    return res.json({ success: true, exists: false, data: null });
  }

  // Check if candidate exists in main pipeline
  const candidates = await query(
    `SELECT id, name, email, phone, stage, position, location, source, applied_date
     FROM candidates 
     WHERE phone = ?
     LIMIT 1`,
    [phone]
  );

  if (candidates.length === 0) {
    return res.json({ success: true, exists: false, data: null });
  }

  const candidate = candidates[0];

  // Get latest HR note for this candidate
  const latestNote = await query(
    `SELECT hn.*, u.name AS author_name
     FROM hr_notes hn
     LEFT JOIN users u ON hn.author_id = u.id
     WHERE hn.candidate_id = ?
     ORDER BY hn.created_at DESC
     LIMIT 1`,
    [candidate.id]
  );

  res.json({
    success: true,
    exists: true,
    data: candidate,
    latestNote: latestNote[0] || null
  });
}));

export default router;