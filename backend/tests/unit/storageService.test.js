/**
 * Unit tests for storageService.js
 * Tests validateFileUpload method of the StorageService singleton
 */

import storageService from '../../services/storageService.js';

describe('storageService - validateFileUpload', () => {
  // ─── Valid file types ──────────────────────────────────────────────────────

  test('valid PDF file returns { valid: true }', () => {
    const result = storageService.validateFileUpload('document.pdf', 'application/pdf');
    expect(result.valid).toBe(true);
  });

  test('valid PNG image returns { valid: true }', () => {
    const result = storageService.validateFileUpload('image.png', 'image/png');
    expect(result.valid).toBe(true);
  });

  test('valid JPEG image returns { valid: true }', () => {
    const result = storageService.validateFileUpload('photo.jpg', 'image/jpeg');
    expect(result.valid).toBe(true);
  });

  test('valid DOCX file returns { valid: true }', () => {
    const result = storageService.validateFileUpload(
      'report.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(result.valid).toBe(true);
  });

  test('valid XLSX file returns { valid: true }', () => {
    const result = storageService.validateFileUpload(
      'data.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(result.valid).toBe(true);
  });

  // ─── Invalid MIME type ────────────────────────────────────────────────────

  test('disallowed MIME type (PHP script) returns { valid: false }', () => {
    const result = storageService.validateFileUpload('script.php', 'application/x-php');
    expect(result.valid).toBe(false);
  });

  test('disallowed MIME type (executable) returns { valid: false }', () => {
    const result = storageService.validateFileUpload('program.exe', 'application/x-msdownload');
    expect(result.valid).toBe(false);
  });

  // ─── Mismatched extension / MIME type ────────────────────────────────────

  test('extension .pdf with MIME type image/png returns { valid: false }', () => {
    // .pdf extension doesn't match image/png expected extensions (.png)
    const result = storageService.validateFileUpload('image.pdf', 'image/png');
    expect(result.valid).toBe(false);
  });

  test('extension .txt with MIME type application/pdf returns { valid: false }', () => {
    const result = storageService.validateFileUpload('document.txt', 'application/pdf');
    expect(result.valid).toBe(false);
  });

  // ─── No extension ─────────────────────────────────────────────────────────

  test('filename with no extension returns { valid: false }', () => {
    const result = storageService.validateFileUpload('filename', 'application/pdf');
    expect(result.valid).toBe(false);
  });

  // ─── File size validation ─────────────────────────────────────────────────

  test('file size exceeding 10MB (10485761 bytes) returns { valid: false }', () => {
    const result = storageService.validateFileUpload('doc.pdf', 'application/pdf', 10485761);
    expect(result.valid).toBe(false);
  });

  test('file size exactly 10MB (10485760 bytes) returns { valid: true }', () => {
    const result = storageService.validateFileUpload('doc.pdf', 'application/pdf', 10485760);
    expect(result.valid).toBe(true);
  });

  test('file size under limit returns { valid: true }', () => {
    const result = storageService.validateFileUpload('doc.pdf', 'application/pdf', 1024);
    expect(result.valid).toBe(true);
  });

  test('file size of 0 bytes returns { valid: true }', () => {
    // Zero-byte file is within size limit; extension/MIME still valid
    const result = storageService.validateFileUpload('doc.pdf', 'application/pdf', 0);
    expect(result.valid).toBe(true);
  });

  // ─── Edge cases for filename/MIME inputs ──────────────────────────────────

  test('missing filename returns { valid: false }', () => {
    const result = storageService.validateFileUpload(null, 'application/pdf');
    expect(result.valid).toBe(false);
  });

  test('missing MIME type returns { valid: false }', () => {
    const result = storageService.validateFileUpload('document.pdf', null);
    expect(result.valid).toBe(false);
  });

  // ─── Valid result includes category ──────────────────────────────────────

  test('valid PDF result includes category field', () => {
    const result = storageService.validateFileUpload('document.pdf', 'application/pdf');
    expect(result.valid).toBe(true);
    expect(result.category).toBe('pdf');
  });

  test('valid PNG result includes category "images"', () => {
    const result = storageService.validateFileUpload('image.png', 'image/png');
    expect(result.valid).toBe(true);
    expect(result.category).toBe('images');
  });
});
