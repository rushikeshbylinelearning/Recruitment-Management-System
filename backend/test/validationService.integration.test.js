import validationService from '../services/validationService.js';

describe('ValidationService Integration Tests', () => {
  describe('Real-world form validation scenarios', () => {
    it('should validate a complete candidate intake form submission', () => {
      const formFields = [
        { field_key: 'name', label: 'Full Name', field_type: 'text', is_required: true },
        { field_key: 'email', label: 'Email Address', field_type: 'email', is_required: true },
        { field_key: 'phone', label: 'Phone Number', field_type: 'tel', is_required: true },
        { field_key: 'position', label: 'Position Applied', field_type: 'text', is_required: true },
        { field_key: 'experience', label: 'Years of Experience', field_type: 'number', is_required: true },
        { field_key: 'current_ctc', label: 'Current CTC', field_type: 'number', is_required: false },
        { field_key: 'expected_ctc', label: 'Expected CTC', field_type: 'number', is_required: true },
        { field_key: 'notice_period', label: 'Notice Period (days)', field_type: 'number', is_required: true },
        { field_key: 'notes', label: 'Additional Notes', field_type: 'textarea', is_required: false }
      ];

      const validSubmission = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1-234-567-8900',
        position: 'Software Engineer',
        experience: '5',
        current_ctc: '80000',
        expected_ctc: '100000',
        notice_period: '30',
        notes: 'I am very interested in this position and have relevant experience.'
      };

      const result = validationService.validateFormSubmission(formFields, validSubmission);
      
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('should detect multiple validation errors in a single submission', () => {
      const formFields = [
        { field_key: 'name', label: 'Full Name', field_type: 'text', is_required: true },
        { field_key: 'email', label: 'Email Address', field_type: 'email', is_required: true },
        { field_key: 'phone', label: 'Phone Number', field_type: 'tel', is_required: true },
        { field_key: 'experience', label: 'Years of Experience', field_type: 'number', is_required: true }
      ];

      const invalidSubmission = {
        name: '',
        email: 'invalid-email',
        phone: 'abc123',
        experience: 'not-a-number'
      };

      const result = validationService.validateFormSubmission(formFields, invalidSubmission);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBeDefined();
      expect(result.errors.email).toBeDefined();
      expect(result.errors.phone).toBeDefined();
      expect(result.errors.experience).toBeDefined();
    });

    it('should handle optional fields correctly', () => {
      const formFields = [
        { field_key: 'name', label: 'Full Name', field_type: 'text', is_required: true },
        { field_key: 'email', label: 'Email Address', field_type: 'email', is_required: true },
        { field_key: 'phone', label: 'Phone Number', field_type: 'tel', is_required: false },
        { field_key: 'notes', label: 'Notes', field_type: 'textarea', is_required: false }
      ];

      const submissionWithoutOptionals = {
        name: 'Jane Smith',
        email: 'jane@example.com'
      };

      const result = validationService.validateFormSubmission(formFields, submissionWithoutOptionals);
      
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors).length).toBe(0);
    });
  });

  describe('Security validation scenarios', () => {
    it('should sanitize XSS attack attempts', () => {
      const xssAttempts = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert(1)>',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        'javascript:alert("XSS")'
      ];

      xssAttempts.forEach(attempt => {
        const sanitized = validationService.sanitizeText(attempt);
        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('<img');
        expect(sanitized).not.toContain('<iframe');
        expect(sanitized).not.toContain('javascript:');
      });
    });

    it('should sanitize SQL injection attempts', () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users--"
      ];

      sqlInjectionAttempts.forEach(attempt => {
        const sanitized = validationService.sanitizeText(attempt);
        // Should escape quotes and special characters
        expect(sanitized).not.toContain("'");
        expect(sanitized).toContain('&#x27;');
      });
    });
  });

  describe('File upload validation scenarios', () => {
    it('should validate resume uploads with correct format and size', () => {
      const validResume = {
        originalname: 'john_doe_resume.pdf',
        size: 2 * 1024 * 1024 // 2MB
      };

      const result = validationService.validateFileUpload(validResume);
      
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject oversized resume files', () => {
      const oversizedResume = {
        originalname: 'large_resume.pdf',
        size: 10 * 1024 * 1024 // 10MB
      };

      const result = validationService.validateFileUpload(oversizedResume);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('size exceeds');
    });

    it('should reject invalid file formats', () => {
      const invalidFormats = [
        { originalname: 'resume.exe', size: 1024 },
        { originalname: 'resume.txt', size: 1024 },
        { originalname: 'resume.jpg', size: 1024 }
      ];

      invalidFormats.forEach(file => {
        const result = validationService.validateFileUpload(file);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('File type not allowed');
      });
    });

    it('should accept all valid resume formats', () => {
      const validFormats = [
        { originalname: 'resume.pdf', size: 1024 },
        { originalname: 'resume.doc', size: 1024 },
        { originalname: 'resume.docx', size: 1024 },
        { originalname: 'RESUME.PDF', size: 1024 } // Test case insensitivity
      ];

      validFormats.forEach(file => {
        const result = validationService.validateFileUpload(file);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle very long text inputs', () => {
      const longText = 'a'.repeat(1001);
      expect(validationService.validateTextLength(longText)).toBe(false);
      
      const maxLengthText = 'a'.repeat(1000);
      expect(validationService.validateTextLength(maxLengthText)).toBe(true);
    });

    it('should handle international phone numbers', () => {
      const internationalNumbers = [
        '+44 20 7946 0958', // UK
        '+91 98765 43210', // India
        '+86 138 0013 8000', // China
        '+1 (555) 123-4567' // US
      ];

      internationalNumbers.forEach(number => {
        expect(validationService.validatePhone(number)).toBe(true);
      });
    });

    it('should handle various email formats', () => {
      const validEmails = [
        'simple@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user_name@example-domain.com',
        'user123@test.example.com'
      ];

      validEmails.forEach(email => {
        expect(validationService.validateEmail(email)).toBe(true);
      });
    });

    it('should handle numeric edge cases', () => {
      expect(validationService.validateNumeric('0')).toBe(true);
      expect(validationService.validateNumeric('-1')).toBe(true);
      expect(validationService.validateNumeric('0.0')).toBe(true);
      expect(validationService.validateNumeric('123.456')).toBe(true);
      expect(validationService.validateNumeric('-123.456')).toBe(true);
    });
  });
});
