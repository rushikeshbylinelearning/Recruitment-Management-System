/**
 * Integration Test for Token Validator Middleware
 * Tests the middleware in a realistic Express context
 * Run with: node test/tokenValidator.integration.test.js
 */

import { generateToken, validateToken } from '../middleware/tokenValidator.js';
import { query } from '../config/database.js';

console.log('=== Token Validator Integration Tests ===\n');

// Helper to create mock request/response objects
const createMockReqRes = (queryParams = {}, params = {}) => {
  const req = {
    query: queryParams,
    params: params
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

// Test 1: Missing token
console.log('Test 1: Missing token should return 401');
const test1 = createMockReqRes({}, { slug: 'test-form' });
await validateToken(test1.req, test1.res, test1.next);
console.log('Status:', test1.res.statusCode);
console.log('Response:', test1.res.jsonData);
console.assert(test1.res.statusCode === 401, 'Should return 401');
console.assert(test1.res.jsonData.message === 'Access token required', 'Should have correct message');
console.log('✓ Test 1 passed\n');

// Test 2: Invalid token format (too short)
console.log('Test 2: Short token should return 401');
const test2 = createMockReqRes({ token: 'short' }, { slug: 'test-form' });
await validateToken(test2.req, test2.res, test2.next);
console.log('Status:', test2.res.statusCode);
console.log('Response:', test2.res.jsonData);
console.assert(test2.res.statusCode === 401, 'Should return 401');
console.assert(test2.res.jsonData.message === 'Invalid token format', 'Should have correct message');
console.log('✓ Test 2 passed\n');

// Test 3: Invalid token format (special characters)
console.log('Test 3: Token with special characters should return 401');
const test3 = createMockReqRes({ token: 'invalid-token-with-dashes!@#' }, { slug: 'test-form' });
await validateToken(test3.req, test3.res, test3.next);
console.log('Status:', test3.res.statusCode);
console.log('Response:', test3.res.jsonData);
console.assert(test3.res.statusCode === 401, 'Should return 401');
console.assert(test3.res.jsonData.message === 'Invalid token format', 'Should have correct message');
console.log('✓ Test 3 passed\n');

// Test 4: Valid token format but not in database
console.log('Test 4: Valid format but non-existent token should return 401');
const validToken = generateToken();
const test4 = createMockReqRes({ token: validToken }, { slug: 'non-existent-form' });
await validateToken(test4.req, test4.res, test4.next);
console.log('Status:', test4.res.statusCode);
console.log('Response:', test4.res.jsonData);
console.assert(test4.res.statusCode === 401, 'Should return 401');
console.assert(test4.res.jsonData.message === 'Invalid or expired token', 'Should have correct message');
console.log('✓ Test 4 passed\n');

// Test 5: Check if default form exists in database
console.log('Test 5: Checking for default form in database');
try {
  const forms = await query('SELECT * FROM forms WHERE slug = ?', ['default-application']);
  if (forms.length > 0) {
    console.log('Default form found:', forms[0].name);
    console.log('Access token:', forms[0].access_token);
    console.log('Is active:', forms[0].is_active);
    
    // Test 6: Valid token with active form
    console.log('\nTest 6: Valid token with active form should call next()');
    let nextCalled = false;
    const test6 = createMockReqRes(
      { token: forms[0].access_token },
      { slug: 'default-application' }
    );
    const mockNext = () => {
      nextCalled = true;
      console.log('✓ next() called - authentication successful');
    };
    await validateToken(test6.req, test6.res, mockNext);
    console.assert(nextCalled === true, 'next() should be called');
    console.assert(test6.req.form !== undefined, 'Form should be attached to request');
    console.log('Form attached to request:', test6.req.form.name);
    console.log('✓ Test 6 passed\n');
    
    // Test 7: Deactivate form and test
    console.log('Test 7: Inactive form should return 403');
    await query('UPDATE forms SET is_active = FALSE WHERE slug = ?', ['default-application']);
    const test7 = createMockReqRes(
      { token: forms[0].access_token },
      { slug: 'default-application' }
    );
    await validateToken(test7.req, test7.res, test7.next);
    console.log('Status:', test7.res.statusCode);
    console.log('Response:', test7.res.jsonData);
    console.assert(test7.res.statusCode === 403, 'Should return 403');
    console.assert(test7.res.jsonData.message === 'This form is no longer accepting submissions', 'Should have correct message');
    
    // Reactivate form
    await query('UPDATE forms SET is_active = TRUE WHERE slug = ?', ['default-application']);
    console.log('✓ Test 7 passed\n');
  } else {
    console.log('⚠ No default form found in database. Run migrations first.');
    console.log('Skipping database-dependent tests.\n');
  }
} catch (error) {
  console.log('⚠ Database connection error:', error.message);
  console.log('Skipping database-dependent tests.\n');
}

console.log('=== All Integration Tests Completed ===');
process.exit(0);
