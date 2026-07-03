/** Indian Standard Time (UTC+5:30) — used for HR calendar-day filters and exports. */
export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * @param {Date|string|null|undefined} dateLike
 * @returns {string} YYYY-MM-DD in IST, or ''
 */
export function toISTYMD(dateLike) {
  if (dateLike == null || dateLike === '') return '';

  if (typeof dateLike === 'string') {
    const raw = dateLike.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 10);
    const midnightUtc = raw.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.\d+)?Z?$/i);
    if (midnightUtc) return midnightUtc[1];
  }

  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * @param {Date|string|null|undefined} dateLike
 * @param {string} [fromYmd]
 * @param {string} [toYmd]
 */
export function isISTDateInInclusiveRange(dateLike, fromYmd, toYmd) {
  if (!fromYmd && !toYmd) return true;
  const ymd = toISTYMD(dateLike);
  if (!ymd) return false;
  if (fromYmd && ymd < fromYmd) return false;
  if (toYmd && ymd > toYmd) return false;
  return true;
}

export function todayISTYMD() {
  return toISTYMD(new Date());
}
