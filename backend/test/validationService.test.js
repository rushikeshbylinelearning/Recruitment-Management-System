import validationService from '../services/validationService.js';

describe('ValidationService', () => {
  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      expect(validationService.validateEmail('test@example.com')).toBe(true);
      expect(validationService.validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validationService.validateEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validationService.validateEmail('invalid')).toBe(false);
      expect(validationService.validateEmail('test@')).toBe(false);
      expect(validationService.validateEmail('@example.com')).toBe(false);
      expect(validationService.validateEmail('')).toBe(false);
      expect(validationService.validateEmail(null)).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('should accept valid phone numbers', () => {
      expect(validationService.validatePhone('1234567890')).toBe(true);
      expect(validationService.validatePhone('+1 (234) 567-8900')).toBe(true);
      expect(validationService.validatePhone('123-456-7890')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validationService.validatePhone('123')).toBe(false);
      expect(validationService.validatePhone('abc1234567')).toBe(false);
      expect(validationService.validatePhone('')).toBe(false);
      expect(validationService.validatePhone(null)).toBe(false);
    });
  });

  describe('validateRequired', () => {
    it('should accept non-empty values', () => {
      expect(validationService.validateRequired('test')).toBe(true);
      expect(validationService.validateRequired('  test  ')).toBe(true);
      expect(validationService.validateRequired(123)).toBe(true);
      expect(validationService.validateRequired(0)).toBe(true);
    });

    it('should reject empty values', () => {
      expect(validationService.validateRequired('')).toBe(false);
      expect(validationService.validateRequired('   ')).toBe(false);
      expect(validationService.validateRequired(null)).toBe(false);
      expect(validationService.validateRequired(undefined)).toBe(false);
    });
  });

  describe('sanitizeText', () => {
    it('should strip HTML tags', () => {
      expect(validationService.sanitizeText('<script>alert("xss")</script>')).toBe('alert(&quot;xss&quot;)');
      expect(validationService.sanitizeText('<p>Hello</p>')).toBe('Hello');
      expect(validationService.sanitizeText('<img src=x onerror=alert(1)>')).toBe('');
    });

    it('should escape special characters', () => {
      expect(validationService.sanitizeText('Test & Co')).toBe('Test &amp; Co');
      expect(validationService.sanitizeText('5 < 10')).toBe('5 &lt; 10');
      expect(validationService.sanitizeText('10 > 5')).toBe('10 &gt; 5');
      expect(validationService.sanitizeText('"quoted"')).toBe('&quot;quoted&quot;');
    });

    it('should handle empty or null values', () => {
      expect(validationService.sanitizeText('')).toBe('');
      expect(validationService.sanitizeText(null)).toBe('');
      expect(validationService.sanitizeText(undefined)).toBe('');
    });
  });

  describe('validateNumeric', () => {
    it('should accept valid numeric values', () => {
      expect(validationService.validateNumeric('123')).toBe(true);
      expect(validationService.validateNumeric('123.45')).toBe(true);
      expect(validationService.validateNumeric('-123')).toBe(true);
      expect(validationService.validateNumeric(123)).toBe(true);
      expect(validationService.validateNumeric(0)).toBe(true);
    });

    it('should reject invalid numeric values', () => {
      expect(validationService.validateNumeric('abc')).toBe(false);
      expect(validationService.validateNumeric('12.34.56')).toBe(false);
      expect(validationService.validateNumeric('12a')).toBe(false);
      expect(validationService.validateNumeric('')).toBe(false);
      expect(validationService.validateNumeric(null)).toBe(false);
    });
  });

  describe('validateTextLength', () => {
    it('should accept text within length limit', () => {
      expect(validationService.validateTextLength('short text')).toBe(true);
      expect(validationService.validateTextLength('a'.repeat(1000))).toBe(true);
      expect(validationService.validateTextLength('test', 10)).toBe(true);
    });

    it('should reject text exceeding length limit', () => {
      expect(validationService.validateTextLength('a'.repeat(1001))).toBe(false);
      expect(validationService.validateTextLength('test', 3)).toBe(false);
    });

    it('should handle empty or null values', () => {
      expect(validationService.validateTextLength('')).toBe(true);
      expect(validationService.validateTextLength(null)).toBe(true);
    });
  });

  describe('validateFormSubmission', () => {
    it('should validate complete form submission', () => {
      const fields = [
        { field_key: 'name', label: 'Name', field_type: 'text', is_required: true },
        { field_key: 'email', label: 'Email', field_type: 'email', is_required: true },
        { field_key: 'phone', label: 'Phone', field_type: 'tel', is_required: false }
      ];

      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '1234567890'
      };

      const result = validationService.validateFormSubmission(fields, validData);
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('should detect missing required fields', () => {
      const fields = [
        { field_key: 'name', label: 'Name', field_type: 'text', is_required: true },
        { field_key: 'email', label: 'Email', field_type: 'email', is_required: true }
      ];

      const invalidData = {
        name: '',
        email: 'john@example.com'
      };

      const result = validationService.validateFormSubmission(fields, invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBeDefined();
    });

    it('should detect invalid field formats', () => {
      const fields = [
        { field_key: 'email', label: 'Email', field_type: 'email', is_required: true },
        { field_key: 'phone', label: 'Phone', field_type: 'tel', is_required: true }
      ];

      const invalidData = {
        email: 'invalid-email',
        phone: 'abc'
      };

      const result = validationService.validateFormSubmission(fields, invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBeDefined();
      expect(result.errors.phone).toBeDefined();
    });
  });

  describe('validateFileUpload', () => {
    it('should accept valid file uploads', () => {
      const file = {
        originalname: 'resume.pdf',
        size: 1024 * 1024 // 1MB
      };

      const result = validationService.validateFileUpload(file);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject files with invalid extensions', () => {
      const file = {
        originalname: 'resume.txt',
        size: 1024 * 1024
      };

      const result = validationService.validateFileUpload(file);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject files exceeding size limit', () => {
      const file = {
        originalname: 'resume.pdf',
        size: 10 * 1024 * 1024 // 10MB
      };

      const result = validationService.validateFileUpload(file);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle missing file', () => {
      const result = validationService.validateFileUpload(null);
      expect(result.isValid).toBe(true);
    });
  });
});
