/**
 * Unit tests for FileParserService
 * Tests CSV and Excel parsing functionality
 */

import { describe, test, expect } from '@jest/globals';
import fileParserService from '../services/fileParserService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FileParserService', () => {
  describe('CSV Parsing', () => {
    test('should parse CSV file with comma delimiter', async () => {
      // Create a simple CSV test file
      const csvContent = 'name,email,phone\nJohn Doe,john@example.com,1234567890\nJane Smith,jane@example.com,0987654321';
      const buffer = Buffer.from(csvContent, 'utf-8');

      const result = await fileParserService.parseFile(buffer, 'test.csv');

      expect(result.fileType).toBe('csv');
      expect(result.headers).toEqual(['name', 'email', 'phone']);
      expect(result.totalRows).toBe(2);
      expect(result.rows[0].name).toBe('John Doe');
      expect(result.rows[0].email).toBe('john@example.com');
      expect(result.encoding).toBe('utf-8');
    });

    test('should parse CSV file with semicolon delimiter', async () => {
      const csvContent = 'name;email;phone\nJohn Doe;john@example.com;1234567890';
      const buffer = Buffer.from(csvContent, 'utf-8');

      const result = await fileParserService.parseFile(buffer, 'test.csv');

      expect(result.fileType).toBe('csv');
      expect(result.totalRows).toBe(1);
      expect(result.rows[0].name).toBe('John Doe');
    });

    test('should parse CSV file with tab delimiter', async () => {
      const csvContent = 'name\temail\tphone\nJohn Doe\tjohn@example.com\t1234567890';
      const buffer = Buffer.from(csvContent, 'utf-8');

      const result = await fileParserService.parseFile(buffer, 'test.csv');

      expect(result.fileType).toBe('csv');
      expect(result.totalRows).toBe(1);
      expect(result.rows[0].name).toBe('John Doe');
    });

    test('should skip completely empty rows', async () => {
      const csvContent = 'name,email,phone\nJohn Doe,john@example.com,1234567890\n,,\nJane Smith,jane@example.com,0987654321';
      const buffer = Buffer.from(csvContent, 'utf-8');

      const result = await fileParserService.parseFile(buffer, 'test.csv');

      expect(result.totalRows).toBe(2);
      expect(result.rows.length).toBe(2);
    });

    test('should trim whitespace from headers and values', async () => {
      const csvContent = ' name , email , phone \n John Doe , john@example.com , 1234567890 ';
      const buffer = Buffer.from(csvContent, 'utf-8');

      const result = await fileParserService.parseFile(buffer, 'test.csv');

      expect(result.headers).toEqual(['name', 'email', 'phone']);
      expect(result.rows[0].name).toBe('John Doe');
      expect(result.rows[0].email).toBe('john@example.com');
    });
  });

  describe('Delimiter Detection', () => {
    test('should detect comma delimiter', () => {
      const csvContent = 'name,email,phone\nJohn,john@example.com,123';
      const delimiter = fileParserService.detectDelimiter(csvContent);
      expect(delimiter).toBe(',');
    });

    test('should detect semicolon delimiter', () => {
      const csvContent = 'name;email;phone\nJohn;john@example.com;123';
      const delimiter = fileParserService.detectDelimiter(csvContent);
      expect(delimiter).toBe(';');
    });

    test('should detect tab delimiter', () => {
      const csvContent = 'name\temail\tphone\nJohn\tjohn@example.com\t123';
      const delimiter = fileParserService.detectDelimiter(csvContent);
      expect(delimiter).toBe('\t');
    });

    test('should default to comma when no clear delimiter', () => {
      const csvContent = 'name email phone';
      const delimiter = fileParserService.detectDelimiter(csvContent);
      expect(delimiter).toBe(',');
    });
  });

  describe('File Type Detection', () => {
    test('should detect CSV file type', async () => {
      const csvContent = 'name,email\nJohn,john@example.com';
      const buffer = Buffer.from(csvContent, 'utf-8');

      const result = await fileParserService.parseFile(buffer, 'test.csv');
      expect(result.fileType).toBe('csv');
    });

    test('should reject unsupported file formats', async () => {
      const buffer = Buffer.from('test', 'utf-8');

      await expect(
        fileParserService.parseFile(buffer, 'test.txt')
      ).rejects.toThrow('Unsupported file format');
    });
  });

  describe('Excel Parsing', () => {
    test('should parse real xlsx files with sheet names and colors', async () => {
      const templatePath = path.join(__dirname, '../../Bulk_Upload_Template.xlsx');
      const buffer = fs.readFileSync(templatePath);

      const result = await fileParserService.parseFile(buffer, 'Bulk_Upload_Template.xlsx');

      expect(result.fileType).toBe('xlsx');
      expect(result).toHaveProperty('sheetNames');
      expect(Array.isArray(result.sheetNames)).toBe(true);
      expect(result.headers.length).toBeGreaterThan(0);
      expect(result.totalRows).toBeGreaterThan(0);
    });
  });
});
