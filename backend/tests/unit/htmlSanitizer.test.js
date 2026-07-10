/**
 * Unit tests for htmlSanitizer.js utility functions
 * Tests XSS prevention, script removal, and filename sanitization
 */

import { sanitizeHtml, sanitizeFilename } from '../../utils/htmlSanitizer.js';

describe('htmlSanitizer - sanitizeHtml', () => {
  test('should remove <script> tags completely', () => {
    const input = '<p>Hello</p><script>alert("XSS")</script><p>World</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  test('should remove onerror attribute', () => {
    const input = '<img src="x" onerror="alert(\'XSS\')" />';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert');
  });

  test('should remove javascript: protocol URLs', () => {
    const input = '<a href="javascript:alert(\'XSS\')">Click me</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('alert');
  });

  test('should remove onload attribute', () => {
    const input = '<body onload="alert(\'XSS\')">Content</body>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onload');
    expect(result).not.toContain('alert');
  });

  test('should preserve safe formatting tags', () => {
    const input = '<p>This is <strong>bold</strong> and <em>italic</em> text</p>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<strong>');
    expect(result).toContain('<em>');
    expect(result).toContain('bold');
    expect(result).toContain('italic');
  });

  test('should preserve lists', () => {
    const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
    expect(result).toContain('Item 1');
  });

  test('should preserve safe links', () => {
    const input = '<a href="https://example.com">Safe link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<a');
    expect(result).toContain('href');
    expect(result).toContain('https://example.com');
  });

  test('should preserve headings', () => {
    const input = '<h1>Title</h1><h2>Subtitle</h2>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<h1>');
    expect(result).toContain('<h2>');
  });

  test('should handle null input gracefully', () => {
    const result = sanitizeHtml(null);
    expect(result).toBe('');
  });

  test('should handle undefined input gracefully', () => {
    const result = sanitizeHtml(undefined);
    expect(result).toBe('');
  });

  test('should handle empty string', () => {
    const result = sanitizeHtml('');
    expect(result).toBe('');
  });

  test('should remove inline event handlers (onclick)', () => {
    const input = '<button onclick="alert(\'XSS\')">Click</button>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('alert');
  });

  test('should remove style tags', () => {
    const input = '<style>body { background: red; }</style><p>Content</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<style');
    expect(result).toContain('Content');
  });

  test('should remove iframe tags', () => {
    const input = '<iframe src="https://evil.com"></iframe>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<iframe');
  });
});

describe('htmlSanitizer - sanitizeFilename', () => {
  test('should use path.basename to strip directory components', () => {
    const input = '/var/www/uploads/../../etc/passwd';
    const result = sanitizeFilename(input);
    expect(result).toBe('passwd');
  });

  test('should remove .. sequences', () => {
    const input = 'file..name.txt';
    const result = sanitizeFilename(input);
    expect(result).toBe('filename.txt');
  });

  test('should remove leading slashes', () => {
    const input = '/filename.txt';
    const result = sanitizeFilename(input);
    expect(result).toBe('filename.txt');
  });

  test('should remove trailing slashes', () => {
    const input = 'filename.txt/';
    const result = sanitizeFilename(input);
    expect(result).toBe('filename.txt');
  });

  test('should handle Windows path with backslashes', () => {
    const input = 'C:\\Windows\\System32\\config.sys';
    const result = sanitizeFilename(input);
    expect(result).toBe('config.sys');
  });

  test('should replace multiple spaces with single space', () => {
    const input = 'my    file    name.txt';
    const result = sanitizeFilename(input);
    expect(result).toBe('my file name.txt');
  });

  test('should trim leading and trailing whitespace', () => {
    const input = '  filename.txt  ';
    const result = sanitizeFilename(input);
    expect(result).toBe('filename.txt');
  });

  test('should handle null input gracefully', () => {
    const result = sanitizeFilename(null);
    expect(result).toBe('');
  });

  test('should handle undefined input gracefully', () => {
    const result = sanitizeFilename(undefined);
    expect(result).toBe('');
  });

  test('should handle empty string', () => {
    const result = sanitizeFilename('');
    expect(result).toBe('');
  });

  test('should preserve normal filenames', () => {
    const input = 'document.pdf';
    const result = sanitizeFilename(input);
    expect(result).toBe('document.pdf');
  });

  test('should handle complex attack path', () => {
    const input = '../../../etc/passwd';
    const result = sanitizeFilename(input);
    expect(result).toBe('passwd');
  });

  test('should remove embedded slashes', () => {
    const input = 'file/name.txt';
    const result = sanitizeFilename(input);
    // path.basename() treats 'file/' as directory path, returns only 'name.txt'
    // This is safer - reject any attempt to embed directory separators
    expect(result).toBe('name.txt');
  });

  test('should handle filename with only dots and slashes', () => {
    const input = '../../..';
    const result = sanitizeFilename(input);
    expect(result).toBe('');
  });
});
