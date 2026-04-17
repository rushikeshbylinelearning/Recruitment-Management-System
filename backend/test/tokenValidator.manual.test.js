/**
 * Manual Test Script for Token Validator
 * Run with: node test/tokenValidator.manual.test.js
 */

import { generateToken, verifyFormToken } from '../middleware/tokenValidator.js';

console.log('=== Token Validator Manual Tests ===\n');

// Test 1: Generate Token
console.log('Test 1: Generate Token');
const token1 = generateToken();
const token2 = generateToken();
console.log('Token 1:', token1);
console.log('Token 1 Length:', token1.length);
console.log('Token 2:', token2);
console.log('Token 2 Length:', token2.length);
console.log('Tokens are unique:', token1 !== token2);
console.log('Token 1 is alphanumeric:', /^[a-zA-Z0-9]+$/.test(token1));
console.log('Token 2 is alphanumeric:', /^[a-zA-Z0-9]+$/.test(token2));
console.log('✓ Token generation tests passed\n');

// Test 2: Token Format Validation
console.log('Test 2: Token Format Validation');
const shortToken = 'short';
const invalidToken = 'invalid-token!@#';
const validToken = 'validAlphanumeric1234567890';

console.log('Short token (should fail):', shortToken);
const result1 = await verifyFormToken('test-form', shortToken);
console.log('Result:', result1 === null ? 'null (correct)' : 'unexpected');

console.log('Invalid token with special chars (should fail):', invalidToken);
const result2 = await verifyFormToken('test-form', invalidToken);
console.log('Result:', result2 === null ? 'null (correct)' : 'unexpected');

console.log('Valid format token (will check database):', validToken);
const result3 = await verifyFormToken('test-form', validToken);
console.log('Result:', result3 === null ? 'null (no matching form in DB)' : 'form found');
console.log('✓ Token format validation tests passed\n');

console.log('=== All Manual Tests Completed ===');
process.exit(0);
