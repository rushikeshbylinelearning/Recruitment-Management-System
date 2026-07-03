/**
 * Maps DB rows to the Interviews page shape and derives attendance from
 * candidate interview sub-stages (kanban) plus interview status.
 */

const SUB_STAGE_ATTENDANCE = {
  'came-down': 'Came',
  'no-show': 'Did Not Come',
  'follow-up-interview': 'Follow Up',
  'selected-interview': 'Came',
  'rejected-interview': 'Came',
};

export function deriveAttendance({ status, sub_stage: subStage }) {
  if (subStage && SUB_STAGE_ATTENDANCE[subStage]) {
    return SUB_STAGE_ATTENDANCE[subStage];
  }
  if (status === 'Completed') return 'Came';
  if (status === 'Cancelled') return 'Cancelled';
  if (status === 'In Progress') return 'Scheduled';
  if (status === 'Scheduled') return 'Scheduled';
  return 'Scheduled';
}

function isValidTimestamp(ms) {
  return typeof ms === 'number' && !Number.isNaN(ms) && Number.isFinite(ms);
}

function toDateString(value) {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    const ms = value.getTime();
    if (!isValidTimestamp(ms)) return null;
    return value.toISOString().slice(0, 10);
  }

  const s = String(value).trim();
  if (!s || s.startsWith('0000-00-00') || s === 'Invalid Date') return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const slice = s.slice(0, 10);
    const [y, m, d] = slice.split('-').map(Number);
    if (y < 1 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    return slice;
  }

  const d = new Date(s);
  const ms = d.getTime();
  if (!isValidTimestamp(ms)) return null;
  return d.toISOString().slice(0, 10);
}

function toTimeString(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (!isValidTimestamp(value.getTime())) return null;
    return value.toTimeString().slice(0, 8);
  }
  const s = String(value);
  const match = s.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = match[1].padStart(2, '0');
  return `${h}:${match[2]}:00`;
}

export function mapInterviewRow(row) {
  const date =
    toDateString(row.date) ||
    toDateString(row.scheduled_date) ||
    null;
  const time = toTimeString(row.time) || '09:00:00';
  const attendance = deriveAttendance({
    status: row.status,
    sub_stage: row.sub_stage,
  });

  return {
    id: row.id,
    source: 'interview',
    candidate_id: row.candidate_id,
    candidate_name: row.candidate_name ?? null,
    candidate_email: row.candidate_email ?? null,
    job_role: row.job_role || row.candidate_position || '',
    interviewer_id: row.interviewer_id,
    interviewer_name: row.interviewer_name ?? null,
    date,
    time,
    duration: row.duration ?? 60,
    type: row.type,
    mode: row.mode || 'Virtual',
    meeting_link: row.meeting_link ?? undefined,
    location: row.location ?? undefined,
    status: row.status,
    attendance,
    notes: row.notes ?? undefined,
    main_stage: row.main_stage ?? null,
    sub_stage: row.sub_stage ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapCandidateInterviewRow(row) {
  const date = toDateString(row.interview_date);
  if (!date) return null;

  const attendance = deriveAttendance({
    status: 'Scheduled',
    sub_stage: row.sub_stage,
  });

  return {
    id: `candidate-${row.candidate_id}-${date}`,
    source: 'candidate',
    candidate_id: row.candidate_id,
    candidate_name: row.candidate_name ?? null,
    candidate_email: row.candidate_email ?? null,
    job_role: row.candidate_position || '',
    interviewer_id: row.interviewer_id ?? null,
    interviewer_name: row.interviewer_name ?? null,
    date,
    time: '09:00:00',
    duration: 60,
    type: 'HR Round',
    mode: 'Virtual',
    status: 'Scheduled',
    attendance,
    main_stage: row.main_stage ?? null,
    sub_stage: row.sub_stage ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
