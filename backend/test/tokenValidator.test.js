import { generateToken, validateToken, verifyFormToken } from '../middleware/tokenValidator.js';

// Mock the database module
jest.mock('../config/database.js', () => ({
  query: jest.fn()
}));

import { query } from '../config/database.js';

describe('TokenValidator', () => {
  describe('generateToken', () => {
    test('should generate a 32-character token', () => {
      const token = generateToken();
      expect(token).toHaveLength(32);
    });

    test('should generate alphanumeric tokens only', () => {
      const token = generateToken();
      const alphanumericRegex = /^[a-zA-Z0-9]+$/;
      expect(alphanumericRegex.test(token)).toBe(true);
    });

    test('should generate unique tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });

    test('should generate tokens with minimum 16 characters', () => {
      const token = generateToken();
      expect(token.length).toBeGreaterThanOrEqual(16);
    });
  });

  describe('validateToken middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        query: {},
        params: {}
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
      jest.clearAllMocks();
    });

    test('should return 401 when token is missing', async () => {
      req.params.slug = 'test-form';
      
      await validateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access token required'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 when token is too short', async () => {
      req.query.token = 'short';
      req.params.slug = 'test-form';

      await validateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token format'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 when token contains non-alphanumeric characters', async () => {
      req.query.token = 'invalid-token-with-dashes!@#';
      req.params.slug = 'test-form';

      await validateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token format'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 401 when token does not match database', async () => {
      req.query.token = 'validAlphanumeric1234567890';
      req.params.slug = 'test-form';
      query.mockResolvedValue([]);

      await validateToken(req, res, next);

      expect(query).toHaveBeenCalledWith(
        'SELECT id, name, slug, is_active, access_token FROM forms WHERE slug = ? AND access_token = ?',
        ['test-form', 'validAlphanumeric1234567890']
      );
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 403 when form is inactive', async () => {
      req.query.token = 'validAlphanumeric1234567890';
      req.params.slug = 'test-form';
      query.mockResolvedValue([{
        id: 1,
        name: 'Test Form',
        slug: 'test-form',
        is_active: false,
        access_token: 'validAlphanumeric1234567890'
      }]);

      await validateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'This form is no longer accepting submissions'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should call next() when token is valid and form is active', async () => {
      req.query.token = 'validAlphanumeric1234567890';
      req.params.slug = 'test-form';
      const mockForm = {
        id: 1,
        name: 'Test Form',
        slug: 'test-form',
        is_active: true,
        access_token: 'validAlphanumeric1234567890'
      };
      query.mockResolvedValue([mockForm]);

      await validateToken(req, res, next);

      expect(query).toHaveBeenCalledWith(
        'SELECT id, name, slug, is_active, access_token FROM forms WHERE slug = ? AND access_token = ?',
        ['test-form', 'validAlphanumeric1234567890']
      );
      expect(req.form).toEqual(mockForm);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should return 500 when database query fails', async () => {
      req.query.token = 'validAlphanumeric1234567890';
      req.params.slug = 'test-form';
      query.mockRejectedValue(new Error('Database error'));

      await validateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token validation failed'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('verifyFormToken utility', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should return null when token format is invalid', async () => {
      const result = await verifyFormToken('test-form', 'short');
      expect(result).toBeNull();
      expect(query).not.toHaveBeenCalled();
    });

    test('should return null when token contains non-alphanumeric characters', async () => {
      const result = await verifyFormToken('test-form', 'invalid-token!@#');
      expect(result).toBeNull();
      expect(query).not.toHaveBeenCalled();
    });

    test('should return null when no matching form found', async () => {
      query.mockResolvedValue([]);
      const result = await verifyFormToken('test-form', 'validAlphanumeric1234567890');
      
      expect(query).toHaveBeenCalledWith(
        'SELECT id, name, slug, is_active, access_token FROM forms WHERE slug = ? AND access_token = ?',
        ['test-form', 'validAlphanumeric1234567890']
      );
      expect(result).toBeNull();
    });

    test('should return null when form is inactive', async () => {
      query.mockResolvedValue([{
        id: 1,
        name: 'Test Form',
        slug: 'test-form',
        is_active: false,
        access_token: 'validAlphanumeric1234567890'
      }]);

      const result = await verifyFormToken('test-form', 'validAlphanumeric1234567890');
      expect(result).toBeNull();
    });

    test('should return form object when token is valid and form is active', async () => {
      const mockForm = {
        id: 1,
        name: 'Test Form',
        slug: 'test-form',
        is_active: true,
        access_token: 'validAlphanumeric1234567890'
      };
      query.mockResolvedValue([mockForm]);

      const result = await verifyFormToken('test-form', 'validAlphanumeric1234567890');
      
      expect(query).toHaveBeenCalledWith(
        'SELECT id, name, slug, is_active, access_token FROM forms WHERE slug = ? AND access_token = ?',
        ['test-form', 'validAlphanumeric1234567890']
      );
      expect(result).toEqual(mockForm);
    });

    test('should return null when database query fails', async () => {
      query.mockRejectedValue(new Error('Database error'));
      
      const result = await verifyFormToken('test-form', 'validAlphanumeric1234567890');
      expect(result).toBeNull();
    });
  });
});
