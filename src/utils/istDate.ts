/** Indian Standard Time (UTC+5:30) — used for HR calendar-day filters and display. */
export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Calendar date in IST as YYYY-MM-DD.
 * Date-only strings (filters, DB DATE) are kept as-is; datetimes are converted via IST.
 */
export function toISTYMD(dateLike: Date | string | null | undefined): string {
  if (dateLike == null || dateLike === '') return '';

  if (typeof dateLike === 'string') {
    const raw = dateLike.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 10);
    const midnightUtc = raw.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.\d+)?Z?$/i);
    if (midnightUtc) return midnightUtc[1];
  }

  const d = typeof dateLike === 'string' ? new Date(dateLike) : dateLike;
  if (Number.isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Inclusive range on IST calendar days (from/to are YYYY-MM-DD from date inputs). */
export function isISTDateInInclusiveRange(
  dateLike: Date | string | null | undefined,
  fromYmd?: string,
  toYmd?: string
): boolean {
  if (!fromYmd && !toYmd) return true;
  const ymd = toISTYMD(dateLike);
  if (!ymd) return false;
  if (fromYmd && ymd < fromYmd) return false;
  if (toYmd && ymd > toYmd) return false;
  return true;
}

export function todayISTYMD(): string {
  return toISTYMD(new Date());
}
