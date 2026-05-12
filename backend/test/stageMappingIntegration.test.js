/**
 * Stage Mapping Integration Tests
 * 
 * Tests the complete flow of stage detection during bulk import
 */

import assert from 'assert';
import { detectStage, getLegacyStage } from '../services/stageMappingService.js';

describe('Stage Mapping Integration Tests', () => {
  
  describe('detectStage() - Text Matching', () => {
    
    it('should detect exact text match with high confidence', () => {
      const result = detectStage({
        cellValue: 'Rejected',
        allowFuzzyMatch: true,
        confidenceThreshold: 0.7
      });
      
      assert.strictEqual(result.mainStage, 'rejected');
      assert.strictEqual(result.subStage, 'rejected');
      assert.strictEqual(result.confidence, 1.0);
      assert.strictEqual(result.matchMethod, 'exact');
      assert.strictEqual(result.legacyStage, 'Rejected');
    });
    
    it('should detect "On Hold" and map to rejected umbrella', () => {
      const result = detectStage({
        cellValue: 'On Hold',
        allowFuzzyMatch: true,
        confidenceThreshold: 0.7
      });
      
      assert.strictEqual(result.mainStage, 'rejected');
      assert.strictEqual(result.subStage, 'on-hold');
      assert.strictEqual(result.legacyStage, 'On Hold');
      assert.strictEqual(result.confidence, 1.0);
    });
    
    it('should detect interview sub-stages', () => {
      const result = detectStage({
        cellValue: 'Came down for interview',
        allowFuzzyMatch: true,
        confidenceThreshold: 0.7
      });
      
      assert.strictEqual(result.mainStage, 'interview');
      assert.strictEqual(result.subStage, 'came-down');
      assert.strictEqual(result.legacyStage, 'Interview');
    });
    
    it('should handle fuzzy matching for typos', () => {
      const result = detectStage({
        cellValue: 'Profil not matched', // typo
        allowFuzzyMatch: true,
        confidenceThreshold: 0.7
      });
      
      assert.strictEqual(result.mainStage, 'rejected');
      assert.strictEqual(result.subStage, 'profile-not-matched');
      assert.strictEqual(result.matchMethod, 'fuzzy');
      assert.ok(result.confidence >= 0.7 && result.confidence < 1.0);
    });
    
    it('should fallback to Applied for unrecognized text', () => {
      const result = detectStage({
        cellValue: 'Unknown Stage XYZ',
        allowFuzzyMatch: true,
        confidenceThreshold: 0.7
      });
      
      assert.strictEqual(result.mainStage, 'applied');
      assert.strictEqual(result.subStage, null);
      assert.strictEqual(result.matchMethod, 'fallback');
      assert.strictEqual(result.confidence, 0.3);
    });
  });
  
  describe('detectStage() - Color Matching', () => {
    
    it('should detect red color as Rejected', () => {
      const result = detectStage({
        cellValue: '',
        cellColor: '#FF0000',
        allowFuzzyMatch: true,
        confidenceThreshold: 0.7
      });
      
      assert.strictEqual(result.mainStage, 'rejected');
      assert.strictEqual(result.matchMethod, 'color');
      assert.strictEqual(result.confidence, 0.6);
    });
    
    it('should detect green color as Hired', () => {
      const result = detectStage({
        cellValue: '',
        cellColor: '#00FF00',
        allowFuzzyMatch: true,
        confidenceThreshold: 0.7
      });
      
      assert.strictEqual(result.mainStage, 'hired');
      assert.strictEqual(result.matchMethod, 'color');
    });
    
    it('should detect orange color as On Hold', () => {
      const result = detectStage({
        cellValue: '',
        cellColor: '#FFA500',
        allowFuzzyMatch: true,
        confidenceThreshold: 0.7
      });
      
      assert.strictEqual(result.mainStage, 'rejected');
      assert.strictEqual(result.subStage, 'on-hold');
    });
    
    it('should prioritize text over color', () => {
      const result = detectStage({
        cellValue: 'Applied',
        cellColor: '#FF0000', // Red (Rejected)
        allowFuzzyMatch: true,
        confidenceThreshold: 0.7
      });
      
      // Text match (confidence 1.0) should win over color (confidence 0.6)
      assert.strictEqual(result.mainStage, 'applied');
      assert.strictEqual(result.matchMethod, 'exact');
      assert.strictEqual(result.confidence, 1.0);
    });
  });
  
  describe('getLegacyStage()', () => {
    
    it('should convert rejected umbrella stages correctly', () => {
      assert.strictEqual(getLegacyStage('rejected', 'rejected'), 'Rejected');
      assert.strictEqual(getLegacyStage('rejected', 'on-hold'), 'On Hold');
      assert.strictEqual(getLegacyStage('rejected', 'profile-not-matched'), 'Profile Not Matched');
      assert.strictEqual(getLegacyStage('rejected', 'last-minute-back-out'), 'Last Minute Back Out');
    });
    
    it('should convert interview umbrella stages to Interview', () => {
      assert.strictEqual(getLegacyStage('interview', 'came-down'), 'Interview');
      assert.strictEqual(getLegacyStage('interview', 'no-show'), 'Interview');
      assert.strictEqual(getLegacyStage('interview', 'selected-interview'), 'Interview');
    });
    
    it('should convert regular stages correctly', () => {
      assert.strictEqual(getLegacyStage('applied', null), 'Applied');
      assert.strictEqual(getLegacyStage('follow-up', null), 'Follow Up');
      assert.strictEqual(getLegacyStage('screening', null), 'Screening');
      assert.strictEqual(getLegacyStage('offer', null), 'Offer');
      assert.strictEqual(getLegacyStage('hired', null), 'Hired');
    });
    
    it('should fallback to Applied for unknown stages', () => {
      assert.strictEqual(getLegacyStage('unknown', null), 'Applied');
    });
  });
  
  describe('Integration Scenarios', () => {
    
    it('should handle Excel row with stage text only', () => {
      const normalized = {
        name: 'John Doe',
        email: 'john@example.com',
        stage: 'On Hold',
        __cellColors: {}
      };
      
      const result = detectStage({
        cellValue: normalized.stage,
        cellColor: null,
        allowFuzzyMatch: true,
        confidenceThreshold: 0.7
      });
      
      assert.strictEqual(result.mainStage, 'rejected');
      assert.strictEqual(result.subStage, 'on-hold');
      assert.strictEqual(getLegacyStage(result.mainStage, result.subStage), 'On Hold');
    });
    
    it('should handle Excel row with color only', () => {
      const normalized = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        stage: '',
        __cellColors: { Stage: '#FF0000' }
      };
      
      const result = detectStage({
        cellValue: normalized.stage,
        cellColor: normalized.__cellColors.Stage,
        allowFuzzyMatch: true,
        confidenceThreshold: 0.7
      });
      
      assert.strictEqual(result.mainStage, 'rejected');
      assert.strictEqual(result.matchMethod, 'color');
    });
    
    it('should handle Excel row with no stage data', () => {
      const normalized = {
        name: 'Bob Johnson',
        email: 'bob@example.com',
        stage: '',
        __cellColors: {}
      };
      
      const result = detectStage({
        cellValue: normalized.stage,
        cellColor: null,
        allowFuzzyMatch: true,
        confidenceThreshold: 0.7
      });
      
      assert.strictEqual(result.mainStage, 'applied');
      assert.strictEqual(result.matchMethod, 'fallback');
      assert.strictEqual(result.confidence, 0.3);
    });
    
    it('should handle confidence threshold filtering', () => {
      const lowConfidenceResult = detectStage({
        cellValue: 'maybe rejected?',
        allowFuzzyMatch: true,
        confidenceThreshold: 0.7
      });
      
      // Should fallback because fuzzy match confidence is too low
      assert.strictEqual(lowConfidenceResult.matchMethod, 'fallback');
      assert.ok(lowConfidenceResult.confidence < 0.4);
    });
  });
  
  describe('Case Sensitivity and Normalization', () => {
    
    it('should handle uppercase text', () => {
      const result = detectStage({
        cellValue: 'REJECTED',
        allowFuzzyMatch: true,
        confidenceThreshold: 0.7
      });
      
      assert.strictEqual(result.mainStage, 'rejected');
      assert.strictEqual(result.confidence, 1.0);
    });
    
    it('should handle mixed case text', () => {
      const result = detectStage({
        cellValue: 'On HoLd',
        allowFuzzyMatch: true,
        confidenceThreshold: 0.7
      });
      
      assert.strictEqual(result.mainStage, 'rejected');
      assert.strictEqual(result.subStage, 'on-hold');
    });
    
    it('should handle extra whitespace', () => {
      const result = detectStage({
        cellValue: '  On Hold  ',
        allowFuzzyMatch: true,
        confidenceThreshold: 0.7
      });
      
      assert.strictEqual(result.mainStage, 'rejected');
      assert.strictEqual(result.subStage, 'on-hold');
    });
  });
});
