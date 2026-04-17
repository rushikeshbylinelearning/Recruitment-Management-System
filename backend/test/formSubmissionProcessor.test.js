/**
 * Unit Tests for FormSubmissionProcessor
 * Tests specific examples and edge cases
 */

import formSubmissionProcessor from '../services/formSubmissionProcessor.js';

describe('FormSubmissionProcessor - Unit Tests', () => {
  describe('handleFileUpload', () => {
    it('should reject file exceeding 5MB', async () => {
      const mockFile = {
        originalname: 'large-resume.pdf',
        mimetype: 'application/pdf',
        size: 6 * 1024 * 1024, // 6MB
        buffer: Buffer.from('large content')
      };

      const result = await formSubmissionProcessor.handleFileUpload(mockFile, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('5MB limit');
    });

    it('should reject invalid file format', async () => {
      const mockFile = {
        originalname: 'resume.txt',
        mimetype: 'text/plain',
        size: 1024,
        buffer: Buffer.from('text content')
      };

      const result = await formSubmissionProcessor.handleFileUpload(mockFile, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid file format');
    });

    it('should accept PDF format under 5MB', async () => {
      const mockFile = {
        originalname: 'resume.pdf',
        mimetype: 'application/pdf',
        size: 2 * 1024 * 1024, // 2MB
        buffer: Buffer.from('pdf content')
      };

      const result = await formSubmissionProcessor.handleFileUpload(mockFile, {});

      // Should either succeed or fail with a specific error (not format/size)
      if (!result.success) {
        expect(result.error).not.toContain('5MB limit');
        expect(result.error).not.toContain('Invalid file format');
      }
    });

    it('should accept DOC format', async () => {
      const mockFile = {
        originalname: 'resume.doc',
        mimetype: 'application/msword',
        size: 1 * 1024 * 1024, // 1MB
        buffer: Buffer.from('doc content')
      };

      const result = await formSubmissionProcessor.handleFileUpload(mockFile, {});

      // Should either succeed or fail with a specific error (not format/size)
      if (!result.success) {
        expect(result.error).not.toContain('5MB limit');
        expect(result.error).not.toContain('Invalid file format');
      }
    });

    it('should accept DOCX format', async () => {
      const mockFile = {
        originalname: 'resume.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 1 * 1024 * 1024, // 1MB
        buffer: Buffer.from('docx content')
      };

      const result = await formSubmissionProcessor.handleFileUpload(mockFile, {});

      // Should either succeed or fail with a specific error (not format/size)
      if (!result.success) {
        expect(result.error).not.toContain('5MB limit');
        expect(result.error).not.toContain('Invalid file format');
      }
    });

    it('should reject file at exactly 5MB + 1 byte', async () => {
      const mockFile = {
        originalname: 'edge-case.pdf',
        mimetype: 'application/pdf',
        size: (5 * 1024 * 1024) + 1, // 5MB + 1 byte
        buffer: Buffer.from('content')
      };

      const result = await formSubmissionProcessor.handleFileUpload(mockFile, {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('5MB limit');
    });

    it('should accept file at exactly 5MB', async () => {
      const mockFile = {
        originalname: 'edge-case.pdf',
        mimetype: 'application/pdf',
        size: 5 * 1024 * 1024, // Exactly 5MB
        buffer: Buffer.from('content')
      };

      const result = await formSubmissionProcessor.handleFileUpload(mockFile, {});

      // Should either succeed or fail with a specific error (not size)
      if (!result.success) {
        expect(result.error).not.toContain('5MB limit');
      }
    });
  });

  describe('File Format Validation', () => {
    const testCases = [
      { ext: 'pdf', mime: 'application/pdf', shouldAccept: true },
      { ext: 'doc', mime: 'application/msword', shouldAccept: true },
      { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', shouldAccept: true },
      { ext: 'txt', mime: 'text/plain', shouldAccept: false },
      { ext: 'jpg', mime: 'image/jpeg', shouldAccept: false },
      { ext: 'png', mime: 'image/png', shouldAccept: false },
      { ext: 'zip', mime: 'application/zip', shouldAccept: false },
      { ext: 'exe', mime: 'application/x-msdownload', shouldAccept: false }
    ];

    testCases.forEach(({ ext, mime, shouldAccept }) => {
      it(`should ${shouldAccept ? 'accept' : 'reject'} .${ext} files`, async () => {
        const mockFile = {
          originalname: `resume.${ext}`,
          mimetype: mime,
          size: 1024 * 1024, // 1MB
          buffer: Buffer.from('content')
        };

        const result = await formSubmissionProcessor.handleFileUpload(mockFile, {});

        if (shouldAccept) {
          // Should either succeed or fail with a non-format error
          if (!result.success) {
            expect(result.error).not.toContain('Invalid file format');
          }
        } else {
          expect(result.success).toBe(false);
          // Accept either error message format
          expect(result.error.toLowerCase()).toMatch(/(not allowed|invalid file format)/);
        }
      });
    });
  });

  describe('Service Methods Exist', () => {
    it('should have processSubmission method', () => {
      expect(typeof formSubmissionProcessor.processSubmission).toBe('function');
    });

    it('should have createCandidateRecord method', () => {
      expect(typeof formSubmissionProcessor.createCandidateRecord).toBe('function');
    });

    it('should have storeSubmissionData method', () => {
      expect(typeof formSubmissionProcessor.storeSubmissionData).toBe('function');
    });

    it('should have handleFileUpload method', () => {
      expect(typeof formSubmissionProcessor.handleFileUpload).toBe('function');
    });

    it('should have sendNotifications method', () => {
      expect(typeof formSubmissionProcessor.sendNotifications).toBe('function');
    });
  });
});
