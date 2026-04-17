/**
 * Integration Test for Rate Limiter Middleware
 * Tests the middleware in a realistic Express context
 * Run with: node test/rateLimiter.integration.test.js
 */

import express from 'express';
import { formSubmissionLimiter, apiLimiter } from '../middleware/rateLimiter.js';

console.log('=== Rate Limiter Integration Tests ===\n');

// Create test Express app
const app = express();
app.use(express.json());

// Test endpoint with form submission rate limiter
app.post('/api/test/submit', formSubmissionLimiter, (req, res) => {
  res.json({ success: true, message: 'Form submitted' });
});

// Test endpoint with API rate limiter
app.get('/api/test/data', apiLimiter, (req, res) => {
  res.json({ success: true, data: 'test data' });
});

// Start test server
const server = app.listen(0, () => {
  const port = server.address().port;
  console.log(`Test server running on port ${port}\n`);
  runTests(port);
});

async function runTests(port) {
  const baseUrl = `http://localhost:${port}`;
  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Allow 5 requests within limit
  console.log('Test 1: Should allow 5 requests within rate limit');
  try {
    for (let i = 0; i < 5; i++) {
      const response = await fetch(`${baseUrl}/api/test/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' })
      });
      
      if (response.status !== 200) {
        throw new Error(`Request ${i + 1} failed with status ${response.status}`);
      }
    }
    console.log('✓ Test 1 passed - All 5 requests succeeded\n');
    testsPassed++;
  } catch (error) {
    console.log('✗ Test 1 failed:', error.message, '\n');
    testsFailed++;
  }

  // Wait a bit to reset for next test
  await new Promise(resolve => setTimeout(resolve, 100));

  // Test 2: Block 6th request with HTTP 429
  console.log('Test 2: Should block 6th request with HTTP 429');
  try {
    // Make 5 successful requests
    for (let i = 0; i < 5; i++) {
      await fetch(`${baseUrl}/api/test/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' })
      });
    }
    
    // 6th request should be blocked
    const response = await fetch(`${baseUrl}/api/test/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'test' })
    });
    
    if (response.status !== 429) {
      throw new Error(`Expected status 429, got ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.message || !data.message.includes('Too many')) {
      throw new Error('Response missing expected error message');
    }
    
    console.log('✓ Test 2 passed - 6th request blocked with 429\n');
    testsPassed++;
  } catch (error) {
    console.log('✗ Test 2 failed:', error.message, '\n');
    testsFailed++;
  }

  // Wait for rate limit window to reset
  await new Promise(resolve => setTimeout(resolve, 100));

  // Test 3: Check retry-after in response
  console.log('Test 3: Should include retryAfter in 429 response');
  try {
    // Exhaust rate limit
    for (let i = 0; i < 5; i++) {
      await fetch(`${baseUrl}/api/test/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' })
      });
    }
    
    // Check 429 response
    const response = await fetch(`${baseUrl}/api/test/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'test' })
    });
    
    const data = await response.json();
    if (!data.retryAfter || typeof data.retryAfter !== 'number') {
      throw new Error('Response missing retryAfter field');
    }
    
    console.log('✓ Test 3 passed - retryAfter included:', data.retryAfter, 'seconds\n');
    testsPassed++;
  } catch (error) {
    console.log('✗ Test 3 failed:', error.message, '\n');
    testsFailed++;
  }

  // Test 4: API limiter allows more requests
  console.log('Test 4: API limiter should allow more than 5 requests');
  try {
    // Make 10 requests (more than form limiter allows)
    for (let i = 0; i < 10; i++) {
      const response = await fetch(`${baseUrl}/api/test/data`);
      if (response.status !== 200) {
        throw new Error(`Request ${i + 1} failed with status ${response.status}`);
      }
    }
    console.log('✓ Test 4 passed - API limiter allows 10+ requests\n');
    testsPassed++;
  } catch (error) {
    console.log('✗ Test 4 failed:', error.message, '\n');
    testsFailed++;
  }

  // Test 5: Rate limit headers present
  console.log('Test 5: Should include RateLimit headers');
  try {
    const response = await fetch(`${baseUrl}/api/test/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'test' })
    });
    
    const hasLimitHeader = response.headers.has('ratelimit-limit');
    const hasRemainingHeader = response.headers.has('ratelimit-remaining');
    const hasResetHeader = response.headers.has('ratelimit-reset');
    
    if (!hasLimitHeader || !hasRemainingHeader || !hasResetHeader) {
      throw new Error('Missing required RateLimit headers');
    }
    
    console.log('✓ Test 5 passed - RateLimit headers present\n');
    testsPassed++;
  } catch (error) {
    console.log('✗ Test 5 failed:', error.message, '\n');
    testsFailed++;
  }

  // Summary
  console.log('=== Test Summary ===');
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  
  // Cleanup
  server.close();
  process.exit(testsFailed > 0 ? 1 : 0);
}
