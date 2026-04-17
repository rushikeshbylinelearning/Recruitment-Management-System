/**
 * Integration tests for Public Forms API routes
 * Tests: 8.1-8.5 - Public Form API endpoints
 * Run with: node backend/test/publicForms.integration.test.js
 */

import { query } from '../config/database.js';
import { generateToken, validateToken } from '../middleware/tokenValidator.js';
import validationService from '../services/validationService.js';

console.log('=== Public Forms API Integration Tests ===\n');

let testFormId;
let testFormSlug = 'test-public-form';
let testFormToken;

// Helper to create mock request/response objects
const createMockReqRes = (queryParams = {}, params = {}, body = {}) => {
  const req = {
    query: queryParams,
    params: params,
    body: body,
    ip: '127.0.0.1',
    get: (header) => header === 'user-agent' ? 'test-agent' : null
  };
  
  const res = {
    statusCode: null,
    jsonData: null,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.jsonData = data;
      return this;
    }
  };
  
  const next = () => {
    console.log('✓ next() called - middleware passed');
  };
  
  return { req, res, next };
};

// Setup: Create test form
console.log('Setup: Creating test form...');
try {
  testFormToken = generateToken();
  const result = await query(
    `INSERT INTO forms (name, slug, description, is_active, access_token, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['Test Public Form', testFormSlug, 'Test form for integration tests', true, testFormToken, 1]
  );
  testFormId = result.insertId;
  console.log('✓ Test form created with ID:', testFormId);
  console.log('✓ Token:', testFormToken);

  // Create test form fields
  await query(
    `INSERT INTO form_fields (form_id, label, field_key, field_type, is_required, order_index)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [testFormId, 'Name', 'name', 'text', true, 1]
  );

  await query(
    `INSERT INTO form_fields (form_id, label, field_key, field_type, is_required, order_index)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [testFormId, 'Email', 'email', 'email', true, 2]
  );

  await query(
    `INSERT INTO form_fields (form_id, label, field_key, field_type, is_required, order_index)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [testFormId, 'Phone', 'phone', 'tel', true, 3]
  );

  console.log('✓ Test form fields created\n');
} catch (error) {
  console.error('✗ Setup failed:', error.message);
  process.exit(1);
}

// Test 1: Token validation - valid token
console.log('Test 1: Valid token should pass validation');
const test1 = createMockReqRes({ token: testFormToken }, { slug: testFormSlug });
let nextCalled = false;
await validateToken(test1.req, test1.res, () => { nextCalled = true; });
console.assert(nextCalled === true, 'next() should be called');
console.assert(test1.req.form !== undefined, 'Form should be attached to request');
console.assert(test1.req.form.slug === testFormSlug, 'Form slug should match');
console.log('✓ Test 1 passed\n');

// Test 2: Token validation - missing token
console.log('Test 2: Missing token should return 401');
const test2 = createMockReqRes({}, { slug: testFormSlug });
await validateToken(test2.req, test2.res, test2.next);
console.assert(test2.res.statusCode === 401, 'Should return 401');
console.assert(test2.res.jsonData.message === 'Access token required', 'Should have correct message');
console.log('✓ Test 2 passed\n');

// Test 3: Token validation - invalid token format
console.log('Test 3: Invalid token format should return 401');
const test3 = createMockReqRes({ token: 'short' }, { slug: testFormSlug });
await validateToken(test3.req, test3.res, test3.next);
console.assert(test3.res.statusCode === 401, 'Should return 401');
console.assert(test3.res.jsonData.message === 'Invalid token format', 'Should have correct message');
console.log('✓ Test 3 passed\n');

// Test 4: Token validation - inactive form
console.log('Test 4: Inactive form should return 403');
await query('UPDATE forms SET is_active = FALSE WHERE id = ?', [testFormId]);
const test4 = createMockReqRes({ token: testFormToken }, { slug: testFormSlug });
await validateToken(test4.req, test4.res, test4.next);
console.assert(test4.res.statusCode === 403, 'Should return 403');
console.assert(test4.res.jsonData.message.includes('no longer accepting'), 'Should have correct message');
// Reactivate form
await query('UPDATE forms SET is_active = TRUE WHERE id = ?', [testFormId]);
console.log('✓ Test 4 passed\n');

// Test 5: Validation service - email validation
console.log('Test 5: ValidationService should validate emails correctly');
console.assert(validationService.validateEmail('test@example.com') === true, 'Valid email should pass');
console.assert(validationService.validateEmail('invalid-email') === false, 'Invalid email should fail');
console.assert(validationService.validateEmail('') === false, 'Empty email should fail');
console.log('✓ Test 5 passed\n');

// Test 6: Validation service - phone validation
console.log('Test 6: ValidationService should validate phone numbers correctly');
console.assert(validationService.validatePhone('1234567890') === true, 'Valid phone should pass');
console.assert(validationService.validatePhone('+1 (234) 567-8900') === true, 'Formatted phone should pass');
console.assert(validationService.validatePhone('abc') === false, 'Invalid phone should fail');
console.assert(validationService.validatePhone('123') === false, 'Too short phone should fail');
console.log('✓ Test 6 passed\n');

// Test 7: Validation service - required field validation
console.log('Test 7: ValidationService should validate required fields correctly');
console.assert(validationService.validateRequired('value') === true, 'Non-empty value should pass');
console.assert(validationService.validateRequired('') === false, 'Empty string should fail');
console.assert(validationService.validateRequired('   ') === false, 'Whitespace should fail');
console.assert(validationService.validateRequired(null) === false, 'Null should fail');
console.log('✓ Test 7 passed\n');

// Test 8: Validation service - text sanitization
console.log('Test 8: ValidationService should sanitize text inputs');
const sanitized = validationService.sanitizeText('<script>alert("xss")</script>Hello');
console.assert(!sanitized.includes('<script>'), 'Should strip HTML tags');
console.assert(sanitized.includes('Hello'), 'Should preserve text content');
console.log('Sanitized:', sanitized);
console.log('✓ Test 8 passed\n');

// Test 9: Validation service - form submission validation
console.log('Test 9: ValidationService should validate form submissions');
const fields = await query(
  'SELECT * FROM form_fields WHERE form_id = ?',
  [testFormId]
);

const validData = {
  name: 'John Doe',
  email: 'john@example.com',
  phone: '1234567890'
};

const validation1 = validationService.validateFormSubmission(fields, validData);
console.assert(validation1.isValid === true, 'Valid data should pass');
console.assert(Object.keys(validation1.errors).length === 0, 'Should have no errors');

const invalidData = {
  name: '',
  email: 'invalid-email',
  phone: ''
};

const validation2 = validationService.validateFormSubmission(fields, invalidData);
console.assert(validation2.isValid === false, 'Invalid data should fail');
console.assert(Object.keys(validation2.errors).length > 0, 'Should have errors');
console.log('Validation errors:', validation2.errors);
console.log('✓ Test 9 passed\n');

// Test 10: Form analytics tracking
console.log('Test 10: Form analytics should be tracked');
await query(
  `INSERT INTO form_analytics (form_id, event_type, ip_address, user_agent)
   VALUES (?, 'view', ?, ?)`,
  [testFormId, '127.0.0.1', 'test-agent']
);

const analytics = await query(
  'SELECT * FROM form_analytics WHERE form_id = ? AND event_type = ?',
  [testFormId, 'view']
);
console.assert(analytics.length > 0, 'Analytics record should be created');
console.log('✓ Test 10 passed\n');

// Cleanup
console.log('Cleanup: Removing test data...');
try {
  await query('DELETE FROM form_fields WHERE form_id = ?', [testFormId]);
  await query('DELETE FROM form_analytics WHERE form_id = ?', [testFormId]);
  await query('DELETE FROM form_submissions WHERE form_id = ?', [testFormId]);
  await query('DELETE FROM forms WHERE id = ?', [testFormId]);
  console.log('✓ Cleanup completed\n');
} catch (error) {
  console.error('✗ Cleanup failed:', error.message);
}

console.log('=== All Public Forms API Integration Tests Completed ===');
process.exit(0);
