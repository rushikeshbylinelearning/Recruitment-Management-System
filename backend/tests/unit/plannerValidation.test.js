/**
 * Unit tests for plannerValidation.js utility functions
 * Tests boundary conditions and invalid inputs for all 5 exported validators
 */

import {
  validatePlanName,
  validateBucketName,
  validateTaskTitle,
  validateLabelName,
  validateChecklistItem,
} from '../../utils/plannerValidation.js';

// ─── validatePlanName ────────────────────────────────────────────────────────

describe('validatePlanName', () => {
  test('empty string returns false', () => {
    expect(validatePlanName('')).toBe(false);
  });

  test('whitespace-only string returns false', () => {
    expect(validatePlanName('   ')).toBe(false);
  });

  test('null returns false', () => {
    expect(validatePlanName(null)).toBe(false);
  });

  test('undefined returns false', () => {
    expect(validatePlanName(undefined)).toBe(false);
  });

  test('1 character returns true', () => {
    expect(validatePlanName('A')).toBe(true);
  });

  test('100 characters returns true', () => {
    expect(validatePlanName('A'.repeat(100))).toBe(true);
  });

  test('101 characters returns false', () => {
    expect(validatePlanName('A'.repeat(101))).toBe(false);
  });

  test('trimmed length of 1 (padded with spaces) returns true', () => {
    expect(validatePlanName('  X  ')).toBe(true);
  });
});

// ─── validateBucketName ─────────────────────────────────────────────────────

describe('validateBucketName', () => {
  test('empty string returns false', () => {
    expect(validateBucketName('')).toBe(false);
  });

  test('whitespace-only string returns false', () => {
    expect(validateBucketName('   ')).toBe(false);
  });

  test('null returns false', () => {
    expect(validateBucketName(null)).toBe(false);
  });

  test('1 character returns true', () => {
    expect(validateBucketName('B')).toBe(true);
  });

  test('100 characters returns true', () => {
    expect(validateBucketName('B'.repeat(100))).toBe(true);
  });

  test('101 characters returns false', () => {
    expect(validateBucketName('B'.repeat(101))).toBe(false);
  });

  test('trimmed length of 1 (padded with spaces) returns true', () => {
    expect(validateBucketName('  Y  ')).toBe(true);
  });
});

// ─── validateTaskTitle ──────────────────────────────────────────────────────

describe('validateTaskTitle', () => {
  test('empty string returns false', () => {
    expect(validateTaskTitle('')).toBe(false);
  });

  test('whitespace-only string returns false', () => {
    expect(validateTaskTitle('   ')).toBe(false);
  });

  test('null returns false', () => {
    expect(validateTaskTitle(null)).toBe(false);
  });

  test('1 character returns true', () => {
    expect(validateTaskTitle('T')).toBe(true);
  });

  test('255 characters returns true', () => {
    expect(validateTaskTitle('T'.repeat(255))).toBe(true);
  });

  test('256 characters returns false', () => {
    expect(validateTaskTitle('T'.repeat(256))).toBe(false);
  });
});

// ─── validateLabelName ──────────────────────────────────────────────────────

describe('validateLabelName', () => {
  test('empty string returns false', () => {
    expect(validateLabelName('')).toBe(false);
  });

  test('whitespace-only string returns false', () => {
    expect(validateLabelName('   ')).toBe(false);
  });

  test('null returns false', () => {
    expect(validateLabelName(null)).toBe(false);
  });

  test('1 character returns true', () => {
    expect(validateLabelName('L')).toBe(true);
  });

  test('50 characters returns true', () => {
    expect(validateLabelName('L'.repeat(50))).toBe(true);
  });

  test('51 characters returns false', () => {
    expect(validateLabelName('L'.repeat(51))).toBe(false);
  });
});

// ─── validateChecklistItem ──────────────────────────────────────────────────

describe('validateChecklistItem', () => {
  test('empty string returns false', () => {
    expect(validateChecklistItem('')).toBe(false);
  });

  test('whitespace-only string returns false', () => {
    expect(validateChecklistItem('   ')).toBe(false);
  });

  test('null returns false', () => {
    expect(validateChecklistItem(null)).toBe(false);
  });

  test('1 character returns true', () => {
    expect(validateChecklistItem('C')).toBe(true);
  });

  test('500 characters returns true', () => {
    expect(validateChecklistItem('C'.repeat(500))).toBe(true);
  });

  test('501 characters returns false', () => {
    expect(validateChecklistItem('C'.repeat(501))).toBe(false);
  });
});
