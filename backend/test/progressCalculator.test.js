/**
 * Unit and Property-Based Tests for progressCalculator.js
 * 
 * Tests progress calculation functions for:
 * - Checklist items (R6)
 * - Bucket tasks (R2)
 */

import { calculateChecklistProgress, calculateBucketProgress } from '../utils/progressCalculator.js';
import fc from 'fast-check';

describe('progressCalculator - Unit Tests', () => {
  describe('calculateChecklistProgress', () => {
    test('should return 0 for empty array', () => {
      expect(calculateChecklistProgress([])).toBe(0);
    });

    test('should return 0 for null input', () => {
      expect(calculateChecklistProgress(null)).toBe(0);
    });

    test('should return 0 for undefined input', () => {
      expect(calculateChecklistProgress(undefined)).toBe(0);
    });

    test('should return 0 when no items are checked', () => {
      const items = [
        { id: 1, is_checked: false },
        { id: 2, is_checked: false }
      ];
      expect(calculateChecklistProgress(items)).toBe(0);
    });

    test('should return 100 when all items are checked', () => {
      const items = [
        { id: 1, is_checked: true },
        { id: 2, is_checked: true },
        { id: 3, is_checked: true }
      ];
      expect(calculateChecklistProgress(items)).toBe(100);
    });

    test('should return 50 when half items are checked', () => {
      const items = [
        { id: 1, is_checked: true },
        { id: 2, is_checked: false }
      ];
      expect(calculateChecklistProgress(items)).toBe(50);
    });

    test('should return 66 for 2 out of 3 checked (floor)', () => {
      const items = [
        { id: 1, is_checked: true },
        { id: 2, is_checked: false },
        { id: 3, is_checked: true }
      ];
      expect(calculateChecklistProgress(items)).toBe(66);
    });

    test('should return 33 for 1 out of 3 checked (floor)', () => {
      const items = [
        { id: 1, is_checked: true },
        { id: 2, is_checked: false },
        { id: 3, is_checked: false }
      ];
      expect(calculateChecklistProgress(items)).toBe(33);
    });

    test('should handle single checked item', () => {
      const items = [{ id: 1, is_checked: true }];
      expect(calculateChecklistProgress(items)).toBe(100);
    });

    test('should handle single unchecked item', () => {
      const items = [{ id: 1, is_checked: false }];
      expect(calculateChecklistProgress(items)).toBe(0);
    });

    test('should return 0 for non-array input', () => {
      expect(calculateChecklistProgress('not an array')).toBe(0);
      expect(calculateChecklistProgress(123)).toBe(0);
      expect(calculateChecklistProgress({})).toBe(0);
    });
  });

  describe('calculateBucketProgress', () => {
    test('should return 0 for empty array', () => {
      expect(calculateBucketProgress([])).toBe(0);
    });

    test('should return 0 for null input', () => {
      expect(calculateBucketProgress(null)).toBe(0);
    });

    test('should return 0 for undefined input', () => {
      expect(calculateBucketProgress(undefined)).toBe(0);
    });

    test('should return 0 when no tasks are completed', () => {
      const tasks = [
        { id: 1, status: 'pending' },
        { id: 2, status: 'in_progress' }
      ];
      expect(calculateBucketProgress(tasks)).toBe(0);
    });

    test('should return 100 when all tasks are completed', () => {
      const tasks = [
        { id: 1, status: 'completed' },
        { id: 2, status: 'completed' },
        { id: 3, status: 'completed' }
      ];
      expect(calculateBucketProgress(tasks)).toBe(100);
    });

    test('should return 50 when half tasks are completed', () => {
      const tasks = [
        { id: 1, status: 'completed' },
        { id: 2, status: 'pending' }
      ];
      expect(calculateBucketProgress(tasks)).toBe(50);
    });

    test('should return 66 for 2 out of 3 completed (floor)', () => {
      const tasks = [
        { id: 1, status: 'completed' },
        { id: 2, status: 'pending' },
        { id: 3, status: 'completed' }
      ];
      expect(calculateBucketProgress(tasks)).toBe(66);
    });

    test('should return 25 for 1 out of 4 completed (floor)', () => {
      const tasks = [
        { id: 1, status: 'completed' },
        { id: 2, status: 'pending' },
        { id: 3, status: 'in_progress' },
        { id: 4, status: 'pending' }
      ];
      expect(calculateBucketProgress(tasks)).toBe(25);
    });

    test('should handle single completed task', () => {
      const tasks = [{ id: 1, status: 'completed' }];
      expect(calculateBucketProgress(tasks)).toBe(100);
    });

    test('should handle single pending task', () => {
      const tasks = [{ id: 1, status: 'pending' }];
      expect(calculateBucketProgress(tasks)).toBe(0);
    });

    test('should only count completed status, not in_progress', () => {
      const tasks = [
        { id: 1, status: 'in_progress' },
        { id: 2, status: 'in_progress' }
      ];
      expect(calculateBucketProgress(tasks)).toBe(0);
    });

    test('should return 0 for non-array input', () => {
      expect(calculateBucketProgress('not an array')).toBe(0);
      expect(calculateBucketProgress(123)).toBe(0);
      expect(calculateBucketProgress({})).toBe(0);
    });
  });
});

describe('progressCalculator - Property-Based Tests', () => {
  describe('Property 5: Checklist progress percentage is always correct', () => {
    test('checklist progress calculation is correct for any boolean array', () => {
      fc.assert(
        fc.property(
          fc.array(fc.boolean(), { minLength: 0, maxLength: 50 }),
          (checkStates) => {
            const items = checkStates.map((is_checked, idx) => ({
              id: idx + 1,
              is_checked
            }));

            const progress = calculateChecklistProgress(items);

            // For empty array, progress should be 0
            if (items.length === 0) {
              return progress === 0;
            }

            // Calculate expected progress
            const checkedCount = items.filter(item => item.is_checked).length;
            const expected = Math.floor((checkedCount / items.length) * 100);

            return progress === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('checklist progress is always between 0 and 100', () => {
      fc.assert(
        fc.property(
          fc.array(fc.boolean(), { minLength: 0, maxLength: 100 }),
          (checkStates) => {
            const items = checkStates.map((is_checked, idx) => ({
              id: idx + 1,
              is_checked
            }));

            const progress = calculateChecklistProgress(items);

            return progress >= 0 && progress <= 100;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('checklist progress returns 0 for all unchecked items', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          (count) => {
            const items = Array.from({ length: count }, (_, idx) => ({
              id: idx + 1,
              is_checked: false
            }));

            return calculateChecklistProgress(items) === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('checklist progress returns 100 for all checked items', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          (count) => {
            const items = Array.from({ length: count }, (_, idx) => ({
              id: idx + 1,
              is_checked: true
            }));

            return calculateChecklistProgress(items) === 100;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: Bucket progress percentage is always correct', () => {
    test('bucket progress calculation is correct for any status array', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom('pending', 'in_progress', 'completed'),
            { minLength: 0, maxLength: 50 }
          ),
          (statuses) => {
            const tasks = statuses.map((status, idx) => ({
              id: idx + 1,
              status
            }));

            const progress = calculateBucketProgress(tasks);

            // For empty array, progress should be 0
            if (tasks.length === 0) {
              return progress === 0;
            }

            // Calculate expected progress
            const completedCount = tasks.filter(task => task.status === 'completed').length;
            const expected = Math.floor((completedCount / tasks.length) * 100);

            return progress === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('bucket progress is always between 0 and 100', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.constantFrom('pending', 'in_progress', 'completed'),
            { minLength: 0, maxLength: 100 }
          ),
          (statuses) => {
            const tasks = statuses.map((status, idx) => ({
              id: idx + 1,
              status
            }));

            const progress = calculateBucketProgress(tasks);

            return progress >= 0 && progress <= 100;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('bucket progress returns 0 when no tasks are completed', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.constantFrom('pending', 'in_progress'),
          (count, status) => {
            const tasks = Array.from({ length: count }, (_, idx) => ({
              id: idx + 1,
              status
            }));

            return calculateBucketProgress(tasks) === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('bucket progress returns 100 when all tasks are completed', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          (count) => {
            const tasks = Array.from({ length: count }, (_, idx) => ({
              id: idx + 1,
              status: 'completed'
            }));

            return calculateBucketProgress(tasks) === 100;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
