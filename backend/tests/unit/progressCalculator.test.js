/**
 * Unit tests for progressCalculator.js utility functions
 * Tests calculateChecklistProgress and calculateBucketProgress
 */

import {
  calculateChecklistProgress,
  calculateBucketProgress,
} from '../../utils/progressCalculator.js';

// ─── calculateChecklistProgress ─────────────────────────────────────────────

describe('calculateChecklistProgress', () => {
  test('empty array returns 0', () => {
    expect(calculateChecklistProgress([])).toBe(0);
  });

  test('null returns 0', () => {
    expect(calculateChecklistProgress(null)).toBe(0);
  });

  test('undefined returns 0', () => {
    expect(calculateChecklistProgress(undefined)).toBe(0);
  });

  test('all items checked returns 100', () => {
    const items = [
      { id: 1, is_checked: true },
      { id: 2, is_checked: true },
      { id: 3, is_checked: true },
    ];
    expect(calculateChecklistProgress(items)).toBe(100);
  });

  test('no items checked returns 0', () => {
    const items = [
      { id: 1, is_checked: false },
      { id: 2, is_checked: false },
    ];
    expect(calculateChecklistProgress(items)).toBe(0);
  });

  test('half checked returns 50', () => {
    const items = [
      { id: 1, is_checked: true },
      { id: 2, is_checked: false },
      { id: 3, is_checked: true },
      { id: 4, is_checked: false },
    ];
    expect(calculateChecklistProgress(items)).toBe(50);
  });

  test('two-thirds checked returns 66 (floor)', () => {
    const items = [
      { id: 1, is_checked: true },
      { id: 2, is_checked: true },
      { id: 3, is_checked: false },
    ];
    // floor(2/3 * 100) = floor(66.666) = 66
    expect(calculateChecklistProgress(items)).toBe(66);
  });

  test('single item checked returns 100', () => {
    const items = [{ id: 1, is_checked: true }];
    expect(calculateChecklistProgress(items)).toBe(100);
  });

  test('single item not checked returns 0', () => {
    const items = [{ id: 1, is_checked: false }];
    expect(calculateChecklistProgress(items)).toBe(0);
  });
});

// ─── calculateBucketProgress ────────────────────────────────────────────────

describe('calculateBucketProgress', () => {
  test('empty array returns 0', () => {
    expect(calculateBucketProgress([])).toBe(0);
  });

  test('null returns 0', () => {
    expect(calculateBucketProgress(null)).toBe(0);
  });

  test('undefined returns 0', () => {
    expect(calculateBucketProgress(undefined)).toBe(0);
  });

  test('all tasks completed returns 100', () => {
    const tasks = [
      { id: 1, status: 'completed' },
      { id: 2, status: 'completed' },
      { id: 3, status: 'completed' },
    ];
    expect(calculateBucketProgress(tasks)).toBe(100);
  });

  test('no tasks completed returns 0', () => {
    const tasks = [
      { id: 1, status: 'pending' },
      { id: 2, status: 'in_progress' },
    ];
    expect(calculateBucketProgress(tasks)).toBe(0);
  });

  test('half completed returns 50', () => {
    const tasks = [
      { id: 1, status: 'completed' },
      { id: 2, status: 'pending' },
      { id: 3, status: 'completed' },
      { id: 4, status: 'in_progress' },
    ];
    expect(calculateBucketProgress(tasks)).toBe(50);
  });

  test('two-thirds completed returns 66 (floor)', () => {
    const tasks = [
      { id: 1, status: 'completed' },
      { id: 2, status: 'completed' },
      { id: 3, status: 'pending' },
    ];
    // floor(2/3 * 100) = 66
    expect(calculateBucketProgress(tasks)).toBe(66);
  });

  test('single task completed returns 100', () => {
    const tasks = [{ id: 1, status: 'completed' }];
    expect(calculateBucketProgress(tasks)).toBe(100);
  });

  test('single task not completed returns 0', () => {
    const tasks = [{ id: 1, status: 'in_progress' }];
    expect(calculateBucketProgress(tasks)).toBe(0);
  });

  test('mixed statuses — only "completed" counts', () => {
    const tasks = [
      { id: 1, status: 'completed' },
      { id: 2, status: 'in_progress' },
      { id: 3, status: 'pending' },
      { id: 4, status: 'completed' },
    ];
    // floor(2/4 * 100) = 50
    expect(calculateBucketProgress(tasks)).toBe(50);
  });
});
