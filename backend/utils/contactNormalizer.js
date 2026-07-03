/**
 * Normalize contact fields for duplicate matching (email, phone, LinkedIn).
 */

export function normalizeEmail(email) {
  if (email === undefined || email === null) return null;
  const raw = String(email).trim().toLowerCase();
  if (!raw) return null;
  const first = raw.split(',')[0].trim();
  if (!first || !first.includes('@')) return null;
  return first;
}

export function normalizePhone(phone) {
  if (phone === undefined || phone === null) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

export function normalizeLinkedIn(url) {
  if (!url) return null;
  let u = String(url).trim().toLowerCase();
  if (!u) return null;
  u = u.replace(/\/$/, '');
  if (!u.includes('linkedin')) return u;
  return u;
}

export function emailsMatch(stored, submitted) {
  const a = normalizeEmail(stored);
  const b = normalizeEmail(submitted);
  if (!a || !b) return false;
  return a === b;
}

export function phonesMatch(stored, submitted) {
  const a = normalizePhone(stored);
  const b = normalizePhone(submitted);
  if (!a || !b) return false;
  return a === b;
}

export function linkedInUrlsMatch(stored, submitted) {
  const a = normalizeLinkedIn(stored);
  const b = normalizeLinkedIn(submitted);
  if (!a || !b) return false;
  return a === b || a.endsWith(b) || b.endsWith(a);
}
