/**
 * ICS Generator Service
 * Generates RFC 5545 iCalendar strings for interview events.
 */

/**
 * Pads a number to 2 digits.
 * @param {number} n
 * @returns {string}
 */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Formats a Date object to UTC iCalendar datetime string: YYYYMMDDTHHmmssZ
 * @param {Date} date
 * @returns {string}
 */
function toICSDate(date) {
  const y = date.getUTCFullYear();
  const mo = pad2(date.getUTCMonth() + 1);
  const d = pad2(date.getUTCDate());
  const h = pad2(date.getUTCHours());
  const mi = pad2(date.getUTCMinutes());
  const s = pad2(date.getUTCSeconds());
  return `${y}${mo}${d}T${h}${mi}${s}Z`;
}

/**
 * Generates a simple UUID v4-like string without external dependencies.
 * @returns {string}
 */
function generateUID() {
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-${((Math.floor(Math.random() * 4) + 8)).toString(16)}${hex().slice(1)}-${hex()}${hex()}${hex()}`;
}

/**
 * Escapes special characters in iCalendar text values.
 * @param {string} text
 * @returns {string}
 */
function escapeICSText(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generates a valid RFC 5545 iCalendar string for an interview event.
 *
 * @param {Object} interview
 * @param {string} interview.date             - 'YYYY-MM-DD'
 * @param {string} interview.time             - 'HH:MM' or 'HH:MM:SS'
 * @param {number} interview.duration         - duration in minutes
 * @param {string} interview.type             - 'HR Round' | 'Technical' | 'Final'
 * @param {string} interview.mode             - 'Virtual' | 'In-Person'
 * @param {string} [interview.meeting_link]   - URL for virtual interviews
 * @param {string} [interview.location]       - physical location for in-person
 * @param {string} interview.candidate_name
 * @param {string} interview.job_role
 * @param {string} interview.interviewer_name
 * @param {string} interview.interviewer_email
 * @returns {string} RFC 5545 iCalendar string
 */
function generateICS(interview) {
  const {
    date,
    time,
    duration,
    type,
    mode,
    meeting_link,
    location,
    candidate_name,
    job_role,
    interviewer_name,
    interviewer_email,
  } = interview;

  if (!date || !time) {
    throw new Error(`Cannot generate ICS: missing date (${date}) or time (${time})`);
  }

  // Parse date and time into a UTC Date object.
  // Treat the provided date+time as UTC (no timezone conversion).
  const timeParts = time.split(':');
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  const seconds = timeParts[2] ? parseInt(timeParts[2], 10) : 0;

  const [year, month, day] = date.split('-').map(Number);

  const dtStart = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
  const dtEnd = new Date(dtStart.getTime() + duration * 60 * 1000);

  const uid = generateUID();
  const summary = escapeICSText(`${type} Interview - ${candidate_name}`);

  // Build description
  let descriptionParts = [
    `Role: ${job_role}`,
    `Mode: ${mode}`,
    `Interviewer: ${interviewer_name}`,
  ];
  if (mode === 'Virtual' && meeting_link) {
    descriptionParts.push(`Meeting Link: ${meeting_link}`);
  } else if (mode === 'In-Person' && location) {
    descriptionParts.push(`Location: ${location}`);
  }
  const description = escapeICSText(descriptionParts.join('\\n'));

  // Location/URL line
  let locationLine = '';
  if (mode === 'Virtual' && meeting_link) {
    locationLine = `URL:${meeting_link}`;
  } else if (mode === 'In-Person' && location) {
    locationLine = `LOCATION:${escapeICSText(location)}`;
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HR Workflow Management//Interview Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'X-WR-CALNAME:HR Workflow Management',
    'X-WR-TIMEZONE:UTC',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(dtStart)}`,
    `DTEND:${toICSDate(dtEnd)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `ORGANIZER;CN=${escapeICSText(interviewer_name)}:mailto:${interviewer_email}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'CLASS:PUBLIC',
  ];

  if (locationLine) {
    lines.push(locationLine);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.join('\r\n') + '\r\n';
}

export { generateICS };
