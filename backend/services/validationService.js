/**
 * ValidationService
 * 
 * Provides validation and sanitization methods for form inputs.
 * Used throughout the application for input validation and security.
 */

class ValidationService {
  /**
   * Validate email format using RFC 5322 regex pattern
   * @param {string} email - Email address to validate
   * @returns {boolean} - True if valid, false otherwise
   */
  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }
    
    // RFC 5322 compliant email regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    return emailRegex.test(email.trim());
  }

  /**
   * Validate phone number - checks for numeric characters and length
   * @param {string} phone - Phone number to validate
   * @returns {boolean} - True if valid, false otherwise
   */
  validatePhone(phone) {
    if (!phone || typeof phone !== 'string') {
      return false;
    }
    
    // Remove common formatting characters
    const cleanedPhone = phone.replace(/[\s\-\+\(\)]/g, '');
    
    // Check if contains only digits and has reasonable length (10-15 digits)
    const phoneRegex = /^\d{10,15}$/;
    
    return phoneRegex.test(cleanedPhone);
  }

  /**
   * Validate required field - checks for empty or whitespace-only values
   * @param {any} value - Value to validate
   * @returns {boolean} - True if valid (not empty), false otherwise
   */
  validateRequired(value) {
    if (value === null || value === undefined) {
      return false;
    }
    
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    
    // For non-string values, check if they exist
    return true;
  }

  /**
   * Sanitize text input - strips HTML tags and escapes special characters
   * @param {string} text - Text to sanitize
   * @returns {string} - Sanitized text
   */
  sanitizeText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    // Strip HTML tags
    let sanitized = text.replace(/<[^>]*>/g, '');
    
    // Remove javascript: protocol
    sanitized = sanitized.replace(/javascript:/gi, '');
    
    // Only strip dangerous characters, don't escape for HTML entities
    // This prevents breaking database inserts
    sanitized = sanitized
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    
    return sanitized.trim();
  }

  /**
   * Validate numeric field - checks for digits and optional decimal points
   * @param {string|number} value - Value to validate
   * @returns {boolean} - True if valid numeric, false otherwise
   */
  validateNumeric(value) {
    if (value === null || value === undefined || value === '') {
      return false;
    }
    
    // Convert to string for validation
    const strValue = String(value).trim();
    
    // Check if contains only digits and optional decimal point
    const numericRegex = /^-?\d+(\.\d+)?$/;
    
    return numericRegex.test(strValue);
  }

  /**
   * Validate text length - checks if text exceeds maximum length
   * @param {string} text - Text to validate
   * @param {number} maxLength - Maximum allowed length (default: 1000)
   * @returns {boolean} - True if within limit, false otherwise
   */
  validateTextLength(text, maxLength = 1000) {
    if (!text || typeof text !== 'string') {
      return true; // Empty or non-string values are considered valid
    }
    
    return text.length <= maxLength;
  }

  /**
   * Validate form submission - validates all fields according to their configuration
   * @param {Array} fields - Array of form field configurations
   * @param {Object} data - Form submission data
   * @returns {Object} - { isValid: boolean, errors: Object }
   */
  validateFormSubmission(fields, data, filesByFieldKey = {}) {
    const errors = {};
    let isValid = true;

    fields.forEach(field => {
      const uploadedFile = filesByFieldKey[field.field_key];
      const value = field.field_type === 'file'
        ? (uploadedFile || data[field.field_key])
        : data[field.field_key];
      const fieldErrors = [];

      // File fields: required check uses multer upload, not req.body
      if (field.field_type === 'file') {
        if (field.is_required && !uploadedFile) {
          fieldErrors.push(`${field.label} is required`);
          isValid = false;
        } else if (uploadedFile) {
          const fileValidation = this.validateFileUpload(uploadedFile);
          if (!fileValidation.isValid) {
            fieldErrors.push(...fileValidation.errors);
            isValid = false;
          }
        }
        if (fieldErrors.length > 0) {
          errors[field.field_key] = fieldErrors.join(', ');
        }
        return;
      }

      // Check required fields
      if (field.is_required && !this.validateRequired(value)) {
        fieldErrors.push(`${field.label} is required`);
        isValid = false;
      }

      // Skip further validation if field is empty and not required
      if (!value && !field.is_required) {
        return;
      }

      // Type-specific validation
      switch (field.field_type) {
        case 'email':
          if (value && !this.validateEmail(value)) {
            fieldErrors.push('Invalid email format');
            isValid = false;
          }
          break;

        case 'tel':
          if (value && !this.validatePhone(value)) {
            fieldErrors.push('Phone number must contain only digits');
            isValid = false;
          }
          break;

        case 'number':
          if (value && !this.validateNumeric(value)) {
            fieldErrors.push('Must be a valid number');
            isValid = false;
          }
          break;

        case 'text':
        case 'textarea':
          if (value && !this.validateTextLength(value)) {
            fieldErrors.push('Text exceeds maximum length of 1000 characters');
            isValid = false;
          }
          break;
      }

      // Store errors for this field
      if (fieldErrors.length > 0) {
        errors[field.field_key] = fieldErrors.join(', ');
      }
    });

    return { isValid, errors };
  }

  /**
   * Validate file upload
   * @param {Object} file - File object to validate
   * @param {Object} options - Validation options { allowedExtensions, maxSize }
   * @returns {Object} - { isValid: boolean, errors: Array }
   */
  validateFileUpload(file, options = {}) {
    const errors = [];
    const allowedExtensions = options.allowedExtensions || ['.pdf', '.doc', '.docx'];
    const maxSize = options.maxSize || 5 * 1024 * 1024; // 5MB default

    if (!file) {
      return { isValid: true, errors: [] }; // No file is valid if not required
    }

    // Check file extension
    const fileName = file.originalname || file.name || '';
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      errors.push(`File type not allowed. Allowed types: ${allowedExtensions.join(', ')}`);
    }

    // Check file size
    const fileSize = file.size || 0;
    if (fileSize > maxSize) {
      errors.push(`File size exceeds maximum of ${maxSize / (1024 * 1024)}MB`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export default new ValidationService();
