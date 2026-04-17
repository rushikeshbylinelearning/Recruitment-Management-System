/**
 * Tests for Task 17.1: Handle duplicate prevention
 * 
 * Tests duplicate candidate prevention by phone and email
 */

import { jest } from '@jest/globals';

// Create mock functions
const mockQuery = jest.fn();

// Mock the database module
jest.unstable_mockModule('../config/database.js', () => ({
  query: mockQuery,
  transaction: jest.fn()
}));

// Import services after mocking
const {
  findCandidateByPhone,
  findCandidateByEmail,
  checkForDuplicateCandidate,
  createCandidateFromInteraction
} = await import('../services/integrationService.js');

describe('Duplicate Prevention - Task 17.1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockClear();
  });

  describe('checkForDuplicateCandidate', () => {
    it('should detect duplicate by phone', async () => {
      const mockCandidate = {
        id: 'test-uuid-1',
        name: 'John Doe',
        phone: '1234567890',
        email: 'john@example.com',
        stage: 'Applied'
      };

      mockQuery.mockResolvedValueOnce([mockCandidate]); // findCandidateByPhone

      const result = await checkForDuplicateCandidate('1234567890', 'different@example.com');

      expect(result).not.toBeNull();
      expect(result.matchedBy).toBe('phone');
      expect(result.candidate.id).toBe('test-uuid-1');
    });

    it('should detect duplicate by email', async () => {
      const mockCandidate = {
        id: 'test-uuid-2',
        name: 'Jane Doe',
        phone: '9876543210',
        email: 'jane@example.com',
        stage: 'Screening'
      };

      mockQuery.mockResolvedValueOnce([]); // findCandidateByPhone - no match
      mockQuery.mockResolvedValueOnce([mockCandidate]); // findCandidateByEmail

      const result = await checkForDuplicateCandidate('0000000000', 'jane@example.com');

      expect(result).not.toBeNull();
      expect(result.matchedBy).toBe('email');
      expect(result.candidate.id).toBe('test-uuid-2');
    });

    it('should return null when no duplicate found', async () => {
      mockQuery.mockResolvedValueOnce([]); // findCandidateByPhone
      mockQuery.mockResolvedValueOnce([]); // findCandidateByEmail

      const result = await checkForDuplicateCandidate('1111111111', 'new@example.com');

      expect(result).toBeNull();
    });

    it('should prioritize phone match over email', async () => {
      const mockCandidateByPhone = {
        id: 'test-uuid-phone',
        name: 'Phone Match',
        phone: '1234567890',
        email: 'phone@example.com',
        stage: 'Applied'
      };

      mockQuery.mockResolvedValueOnce([mockCandidateByPhone]); // findCandidateByPhone

      const result = await checkForDuplicateCandidate('1234567890', 'email@example.com');

      expect(result).not.toBeNull();
      expect(result.matchedBy).toBe('phone');
      expect(result.candidate.id).toBe('test-uuid-phone');
    });

    it('should handle missing email gracefully', async () => {
      mockQuery.mockResolvedValueOnce([]); // findCandidateByPhone

      const result = await checkForDuplicateCandidate('1234567890', null);

      expect(result).toBeNull();
      expect(mockQuery).toHaveBeenCalledTimes(1); // Only phone check
    });
  });

  describe('createCandidateFromInteraction with duplicate check', () => {
    it('should throw error when duplicate found by phone', async () => {
      const mockCandidate = {
        id: 'existing-uuid',
        name: 'Existing Candidate',
        phone: '1234567890',
        email: 'existing@example.com',
        stage: 'Applied'
      };

      mockQuery.mockResolvedValueOnce([mockCandidate]); // checkForDuplicateCandidate - phone match

      const interactionData = {
        name: 'New Candidate',
        phone: '1234567890',
        email: 'new@example.com',
        source: 'Manual'
      };

      await expect(
        createCandidateFromInteraction(interactionData, 'Interested', false)
      ).rejects.toThrow('Candidate already exists with the same phone');
    });

    it('should throw error when duplicate found by email', async () => {
      const mockCandidate = {
        id: 'existing-uuid',
        name: 'Existing Candidate',
        phone: '9876543210',
        email: 'duplicate@example.com',
        stage: 'Screening'
      };

      mockQuery.mockResolvedValueOnce([]); // checkForDuplicateCandidate - no phone match
      mockQuery.mockResolvedValueOnce([mockCandidate]); // checkForDuplicateCandidate - email match

      const interactionData = {
        name: 'New Candidate',
        phone: '1234567890',
        email: 'duplicate@example.com',
        source: 'Manual'
      };

      await expect(
        createCandidateFromInteraction(interactionData, 'Interested', false)
      ).rejects.toThrow('Candidate already exists with the same email');
    });

    it('should create candidate when no duplicate found', async () => {
      const mockUuid = 'new-candidate-uuid';

      mockQuery.mockResolvedValueOnce([]); // checkForDuplicateCandidate - no phone match
      mockQuery.mockResolvedValueOnce([]); // checkForDuplicateCandidate - no email match
      mockQuery.mockResolvedValueOnce([{ uuid: mockUuid }]); // Generate UUID
      mockQuery.mockResolvedValueOnce({ insertId: 1 }); // INSERT candidate

      const interactionData = {
        name: 'New Candidate',
        phone: '1234567890',
        email: 'new@example.com',
        source: 'Manual'
      };

      const result = await createCandidateFromInteraction(interactionData, 'Interested', false);

      expect(result).toBe(mockUuid);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO candidates'),
        expect.arrayContaining([mockUuid, 'New Candidate', 'new@example.com', '1234567890'])
      );
    });

    it('should skip duplicate check when skipDuplicateCheck is true', async () => {
      const mockUuid = 'new-candidate-uuid';

      mockQuery.mockResolvedValueOnce([{ uuid: mockUuid }]); // Generate UUID
      mockQuery.mockResolvedValueOnce({ insertId: 1 }); // INSERT candidate

      const interactionData = {
        name: 'New Candidate',
        phone: '1234567890',
        email: 'new@example.com',
        source: 'Manual'
      };

      const result = await createCandidateFromInteraction(interactionData, 'Interested', true);

      expect(result).toBe(mockUuid);
      // Should not call checkForDuplicateCandidate (no phone/email lookup queries)
      expect(mockQuery).toHaveBeenCalledTimes(2); // Only UUID generation and INSERT
    });
  });

  describe('Error object structure', () => {
    it('should include proper error details for duplicate by phone', async () => {
      const mockCandidate = {
        id: 'existing-uuid',
        name: 'Existing Candidate',
        phone: '1234567890',
        email: 'existing@example.com',
        stage: 'Applied'
      };

      mockQuery.mockResolvedValueOnce([mockCandidate]);

      const interactionData = {
        name: 'New Candidate',
        phone: '1234567890',
        email: 'new@example.com',
        source: 'Manual'
      };

      try {
        await createCandidateFromInteraction(interactionData, 'Interested', false);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.code).toBe('DUPLICATE_CANDIDATE');
        expect(error.matchedBy).toBe('phone');
        expect(error.existingCandidate).toEqual(mockCandidate);
      }
    });

    it('should include proper error details for duplicate by email', async () => {
      const mockCandidate = {
        id: 'existing-uuid',
        name: 'Existing Candidate',
        phone: '9876543210',
        email: 'duplicate@example.com',
        stage: 'Screening'
      };

      mockQuery.mockResolvedValueOnce([]); // No phone match
      mockQuery.mockResolvedValueOnce([mockCandidate]); // Email match

      const interactionData = {
        name: 'New Candidate',
        phone: '1234567890',
        email: 'duplicate@example.com',
        source: 'Manual'
      };

      try {
        await createCandidateFromInteraction(interactionData, 'Interested', false);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.code).toBe('DUPLICATE_CANDIDATE');
        expect(error.matchedBy).toBe('email');
        expect(error.existingCandidate).toEqual(mockCandidate);
      }
    });
  });
});
