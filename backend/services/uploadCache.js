/**
 * Upload Cache Service
 * 
 * Simple in-memory cache for storing parsed upload data temporarily.
 * Uses TTL (Time To Live) to automatically clean up expired entries.
 * 
 * In production, this should be replaced with Redis or similar.
 */

import { v4 as uuidv4 } from 'uuid';

class UploadCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 30 * 60 * 1000; // 30 minutes in milliseconds
    
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Store data in cache with automatic expiration
   * @param {Object} data - Data to store
   * @returns {string} Upload ID
   */
  set(data) {
    const uploadId = uuidv4();
    const expiresAt = Date.now() + this.ttl;
    
    this.cache.set(uploadId, {
      data,
      expiresAt
    });
    
    return uploadId;
  }

  /**
   * Retrieve data from cache
   * @param {string} uploadId - Upload ID
   * @returns {Object|null} Cached data or null if not found/expired
   */
  get(uploadId) {
    const entry = this.cache.get(uploadId);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(uploadId);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Remove data from cache
   * @param {string} uploadId - Upload ID
   */
  delete(uploadId) {
    this.cache.delete(uploadId);
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [uploadId, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(uploadId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired upload cache entries`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      ttlMinutes: this.ttl / 60000
    };
  }
}

// Export singleton instance
export default new UploadCache();
