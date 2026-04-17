/**
 * Field Mapper Service Tests
 * 
 * Tests for the Field Mapper Service that maps uploaded column names
 * to system schema fields using fuzzy matching and synonyms.
 */

import fieldMapperService from '../services/fieldMapperService.js';

describe('FieldMapperService', () => {
  describe('calculateConfidence', () => {
    test('should return 1.0 for exact matches', () => {
      const confidence = fieldMapperService.calculateConfidence('name', 'name');
      expect(confidence).toBe(1.0);
    });

    test('should return 1.0 for exact matches with different casing', () => {
      const confidence = fieldMapperService.calculateConfidence('Name', 'name');
      expect(confidence).toBe(1.0);
    });

    test('should return 1.0 for exact matches with whitespace', () => {
      const confidence = fieldMapperService.calculateConfidence('  email  ', 'email');
      expect(confidence).toBe(1.0);
    });

    test('should return high confidence for similar strings', () => {
      const confidence = fieldMapperService.calculateConfidence('phone', 'phon');
      expect(confidence).toBeGreaterThan(0.7);
    });

    test('should return low confidence for dissimilar strings', () => {
      const confidence = fieldMapperService.calculateConfidence('xyz', 'name');
      expect(confidence).toBeLessThan(0.5);
    });

    test('should return 0.0 for empty source column', () => {
      const confidence = fieldMapperService.calculateConfidence('', 'name');
      expect(confidence).toBe(0.0);
    });

    test('should return 0.0 for empty target field', () => {
      const confidence = fieldMapperService.calculateConfidence('name', '');
      expect(confidence).toBe(0.0);
    });

    test('should return value between 0.0 and 1.0', () => {
      const confidence = fieldMapperService.calculateConfidence('candidate_name', 'name');
      expect(confidence).toBeGreaterThanOrEqual(0.0);
      expect(confidence).toBeLessThanOrEqual(1.0);
    });
  });

  describe('getSynonyms', () => {
    test('should return synonyms for name field', () => {
      const synonyms = fieldMapperService.getSynonyms('name');
      expect(synonyms).toContain('full_name');
      expect(synonyms).toContain('candidate_name');
      expect(synonyms).toContain('applicant_name');
    });

    test('should return synonyms for email field', () => {
      const synonyms = fieldMapperService.getSynonyms('email');
      expect(synonyms).toContain('email_address');
      expect(synonyms).toContain('e-mail');
      expect(synonyms).toContain('mail');
    });

    test('should return synonyms for phone field', () => {
      const synonyms = fieldMapperService.getSynonyms('phone');
      expect(synonyms).toContain('phone_number');
      expect(synonyms).toContain('mobile');
      expect(synonyms).toContain('contact');
    });

    test('should return empty array for non-existent field', () => {
      const synonyms = fieldMapperService.getSynonyms('nonexistent');
      expect(synonyms).toEqual([]);
    });
  });

  describe('mapFields', () => {
    test('should map exact match columns', () => {
      const headers = ['name', 'email', 'phone'];
      const result = fieldMapperService.mapFields(headers);
      
      expect(result.mappings).toHaveLength(3);
      expect(result.mappings[0]).toMatchObject({
        sourceColumn: 'name',
        targetField: 'name',
        confidence: 1.0,
        method: 'exact'
      });
      expect(result.unmappedColumns).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
    });

    test('should map synonym columns', () => {
      const headers = ['full_name', 'email_address', 'mobile'];
      const result = fieldMapperService.mapFields(headers);
      
      expect(result.mappings).toHaveLength(3);
      
      const nameMapping = result.mappings.find(m => m.targetField === 'name');
      expect(nameMapping).toMatchObject({
        sourceColumn: 'full_name',
        targetField: 'name',
        confidence: 1.0,
        method: 'synonym'
      });
      
      const emailMapping = result.mappings.find(m => m.targetField === 'email');
      expect(emailMapping).toMatchObject({
        sourceColumn: 'email_address',
        targetField: 'email',
        confidence: 1.0,
        method: 'synonym'
      });
      
      const phoneMapping = result.mappings.find(m => m.targetField === 'phone');
      expect(phoneMapping).toMatchObject({
        sourceColumn: 'mobile',
        targetField: 'phone',
        confidence: 1.0,
        method: 'synonym'
      });
    });

    test('should map fuzzy match columns above threshold', () => {
      const headers = ['nam', 'emai', 'phon'];
      const result = fieldMapperService.mapFields(headers);
      
      // These should map with fuzzy matching
      expect(result.mappings.length).toBeGreaterThan(0);
      result.mappings.forEach(mapping => {
        expect(mapping.confidence).toBeGreaterThanOrEqual(0.70);
        expect(mapping.method).toBe('fuzzy');
      });
    });

    test('should flag columns below confidence threshold as unmapped', () => {
      const headers = ['xyz', 'abc', 'def'];
      const result = fieldMapperService.mapFields(headers);
      
      // These dissimilar columns should be unmapped
      expect(result.unmappedColumns.length).toBeGreaterThan(0);
    });

    test('should detect conflicts when multiple columns map to same field', () => {
      const headers = ['name', 'full_name', 'candidate_name'];
      const result = fieldMapperService.mapFields(headers);
      
      // All three should try to map to 'name' field
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].targetField).toBe('name');
      expect(result.conflicts[0].candidates.length).toBeGreaterThanOrEqual(2);
    });

    test('should select highest confidence match in conflicts', () => {
      const headers = ['name', 'nam'];
      const result = fieldMapperService.mapFields(headers);
      
      // Should keep 'name' (exact match, confidence 1.0) over 'nam' (fuzzy match)
      const nameMapping = result.mappings.find(m => m.targetField === 'name');
      expect(nameMapping.sourceColumn).toBe('name');
      expect(nameMapping.confidence).toBe(1.0);
    });

    test('should apply saved mappings when provided', () => {
      const headers = ['custom_name_column', 'custom_email_column'];
      const savedMappings = [
        { sourceColumn: 'custom_name_column', targetField: 'name' },
        { sourceColumn: 'custom_email_column', targetField: 'email' }
      ];
      
      const result = fieldMapperService.mapFields(headers, savedMappings);
      
      expect(result.mappings).toHaveLength(2);
      expect(result.mappings[0]).toMatchObject({
        sourceColumn: 'custom_name_column',
        targetField: 'name',
        confidence: 1.0,
        method: 'manual'
      });
      expect(result.mappings[1]).toMatchObject({
        sourceColumn: 'custom_email_column',
        targetField: 'email',
        confidence: 1.0,
        method: 'manual'
      });
    });

    test('should handle mixed case headers', () => {
      const headers = ['Name', 'EMAIL', 'PhOnE'];
      const result = fieldMapperService.mapFields(headers);
      
      expect(result.mappings).toHaveLength(3);
      expect(result.mappings.every(m => m.confidence === 1.0)).toBe(true);
    });

    test('should handle headers with whitespace', () => {
      const headers = ['  name  ', '  email  ', '  phone  '];
      const result = fieldMapperService.mapFields(headers);
      
      expect(result.mappings).toHaveLength(3);
      expect(result.mappings.every(m => m.confidence === 1.0)).toBe(true);
    });

    test('should return empty mappings for empty headers array', () => {
      const result = fieldMapperService.mapFields([]);
      
      expect(result.mappings).toHaveLength(0);
      expect(result.unmappedColumns).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
    });

    test('should map all standard system fields', () => {
      const headers = [
        'name', 'email', 'phone', 'position', 'experience',
        'location', 'source', 'skills', 'notes'
      ];
      const result = fieldMapperService.mapFields(headers);
      
      expect(result.mappings).toHaveLength(headers.length);
      expect(result.unmappedColumns).toHaveLength(0);
    });

    test('should handle partial matches with some unmapped columns', () => {
      const headers = ['name', 'email', 'unknown_column', 'random_field'];
      const result = fieldMapperService.mapFields(headers);
      
      expect(result.mappings.length).toBeGreaterThanOrEqual(2);
      expect(result.unmappedColumns.length).toBeGreaterThan(0);
    });
  });

  describe('Integration scenarios', () => {
    test('should handle typical HR upload file', () => {
      const headers = [
        'Candidate Name',
        'Email Address',
        'Mobile Number',
        'Position Applied',
        'Years of Experience',
        'Current Location',
        'Source'
      ];
      
      const result = fieldMapperService.mapFields(headers);
      
      // Should map most or all columns
      expect(result.mappings.length).toBeGreaterThanOrEqual(5);
      
      // Check specific mappings
      const nameMapping = result.mappings.find(m => m.targetField === 'name');
      expect(nameMapping).toBeDefined();
      
      const emailMapping = result.mappings.find(m => m.targetField === 'email');
      expect(emailMapping).toBeDefined();
      
      const phoneMapping = result.mappings.find(m => m.targetField === 'phone');
      expect(phoneMapping).toBeDefined();
    });

    test('should handle file with non-standard column names', () => {
      const headers = [
        'Full Name of Applicant',
        'Contact Email',
        'Phone No.',
        'Job Title',
        'Work Experience (Years)'
      ];
      
      const result = fieldMapperService.mapFields(headers);
      
      // Should still map some columns via fuzzy matching
      expect(result.mappings.length).toBeGreaterThan(0);
    });

    test('should prioritize exact matches over fuzzy matches', () => {
      const headers = ['name', 'nam'];
      const result = fieldMapperService.mapFields(headers);
      
      const nameMapping = result.mappings.find(m => m.targetField === 'name');
      expect(nameMapping.sourceColumn).toBe('name');
      expect(nameMapping.method).toBe('exact');
    });
  });
});
