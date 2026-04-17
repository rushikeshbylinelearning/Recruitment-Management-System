/**
 * Returns the next 30-minute boundary at or after the given time.
 * - If minutes < 30: returns same hour at :30
 * - If minutes >= 30: returns next hour at :00
 * Always returns a time >= now (seconds/ms are zeroed out).
 */
export function getNextSlot(now: Date): Date {
  const result = new Date(now);
  result.setSeconds(0, 0);

  const minutes = now.getMinutes();
  if (minutes < 30) {
    result.setMinutes(30);
  } else {
    result.setMinutes(0);
    result.setHours(result.getHours() + 1);
  }

  return result;
}

/**
 * Formats a Date as 'HH:MM' for use in <input type="time"> fields.
 */
export function formatTimeForInput(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
