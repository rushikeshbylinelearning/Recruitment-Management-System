/**
 * Candidate Import API Tests
 * 
 * Tests for the Intelligent Candidate Import System endpoints
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import uploadCache from '../services/uploadCache.js';

describe('Candidate Import API', () => {
  test('Upload cache service should store and retrieve data', () => {
    const testData = {
      filename: 'test.csv',
      rows: [{ name: 'John Doe', email: 'john@example.com' }]
    };
    
    const uploadId = uploadCache.set(testData);
    expect(uploadId).toBeDefined();
    expect(typeof uploadId).toBe('string');
    
    const retrieved = uploadCache.get(uploadId);
    expect(retrieved).toEqual(testData);
    
    uploadCache.delete(uploadId);
    const afterDelete = uploadCache.get(uploadId);
    expect(afterDelete).toBeNull();
  });

  test('Upload cache should expire entries after TTL', () => {
    const testData = { test: 'data' };
    const uploadId = uploadCache.set(testData);
    
    // Manually expire the entry
    const entry = uploadCache.cache.get(uploadId);
    entry.expiresAt = Date.now() - 1000; // Set to past
    
    const retrieved = uploadCache.get(uploadId);
    expect(retrieved).toBeNull();
  });

  test('Upload cache cleanup should remove expired entries', () => {
    const testData = { test: 'data' };
    const uploadId = uploadCache.set(testData);
    
    // Manually expire the entry
    const entry = uploadCache.cache.get(uploadId);
    entry.expiresAt = Date.now() - 1000;
    
    const sizeBefore = uploadCache.cache.size;
    uploadCache.cleanup();
    const sizeAfter = uploadCache.cache.size;
    
    expect(sizeAfter).toBeLessThan(sizeBefore);
  });
});
