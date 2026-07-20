/**
 * IST (Asia/Kolkata) calendar-date helpers for bulk import and storage.
 * DATE columns are calendar dates — not shifted by UTC when formatted for MySQL.
 */

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Extract YYYY-MM-DD in IST from a Date object or date-only / ISO string.
 * @param {Date|string|null|undefined} value
 * @returns {string|null}
 */
export function toISTYMD(value) {
  if (value == null || value === '') return null;

  if (typeof value === 'string') {
    const raw = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  }

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);

  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  if (!y || !m || !day) return null;
  return `${y}-${m}-${day}`;
}

/** Inclusive range on IST calendar days (from/to are YYYY-MM-DD). */
export function isISTDateInInclusiveRange(dateLike, fromYmd, toYmd) {
  if (!fromYmd && !toYmd) return true;
  const ymd = toISTYMD(dateLike);
  if (!ymd) return false;
  if (fromYmd && ymd < fromYmd) return false;
  if (toYmd && ymd > toYmd) return false;
  return true;
}

export function todayISTYMD() {
  return toISTYMD(new Date()) || '';
}

/** Parse DD/MM/YYYY or DD-MM-YYYY (Indian format) to YYYY-MM-DD. */
export function parseDDMMYYYYToYMD(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  const check = new Date(year, month - 1, day);
  if (
    check.getFullYear() !== year ||
    check.getMonth() !== month - 1 ||
    check.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Parse MM/DD/YYYY or MM-DD-YYYY (US / Excel mm-dd-yy) to YYYY-MM-DD. */
export function parseMMDDYYYYToYMD(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  const check = new Date(year, month - 1, day);
  if (
    check.getFullYear() !== year ||
    check.getMonth() !== month - 1 ||
    check.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Excel mm-dd-yy cells: swap day/month to recover HR tracker intent.
 * e.g. stored Nov 7 → 07/11 on sheet → 2026-07-11 (July 11)
 */
export function excelMMDDToIntendedYMD(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = date.getDate();
  const day = date.getMonth() + 1;
  if (month < 1 || month > 12 || day < 1 || day > 31) return toISTYMD(date);

  const check = new Date(year, month - 1, day);
  if (
    check.getFullYear() !== year ||
    check.getMonth() !== month - 1 ||
    check.getDate() !== day
  ) {
    return toISTYMD(date);
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** True when Excel numFmt is US month-first (mm-dd-yy, m/d/yy, etc.) */
export function isExcelUSDateFormat(numFmt) {
  if (!numFmt || typeof numFmt !== 'string') return false;
  const fmt = numFmt.toLowerCase();
  if (/dd[-/]mm/.test(fmt)) return false;
  return /mm[-/]dd|m\/d|mm\.dd/.test(fmt);
}

/**
 * Parse slash dates: DD/MM when first segment > 12, MM/DD when second > 12,
 * otherwise MM/DD for Book1 mm-dd-yy columns.
 */
export function parseSlashDateToYMD(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!match) return null;

  const a = Number(match[1]);
  const b = Number(match[2]);

  if (a > 12) return parseDDMMYYYYToYMD(trimmed);
  if (b > 12) return parseMMDDYYYYToYMD(trimmed);
  return parseMMDDYYYYToYMD(trimmed);
}

/** Parse applied date from Excel/CSV for Book1-style mm-dd-yy trackers. */
export function parseAppliedDateIST(value, options = {}) {
  if (value == null || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    if (isExcelUSDateFormat(options.excelNumFmt)) {
      return excelMMDDToIntendedYMD(value);
    }
    return toISTYMD(value);
  }

  const str = String(value).trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    return toISTYMD(str);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  return parseSlashDateToYMD(str);
}

export default {
  IST_TIMEZONE,
  toISTYMD,
  parseDDMMYYYYToYMD,
  parseMMDDYYYYToYMD,
  parseSlashDateToYMD,
  excelMMDDToIntendedYMD,
  isExcelUSDateFormat,
  parseAppliedDateIST,
  isISTDateInInclusiveRange,
  todayISTYMD,
};
