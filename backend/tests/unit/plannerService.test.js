/**
 * Unit tests for plannerService.js
 * Tests role-based assignment permissions and activity logging
 */

import { jest } from '@jest/globals';
import {
  checkAssignmentPermission,
  logActivity,
  checkTaskOwnership,
  checkPlanAccess,
  checkCrossPlanMove
} from '../../services/plannerService.js';

// Mock database connection
const createMockDb = (mockData) => ({
  query: jest.fn((sql, params) => {
    return Promise.resolve(mockData);
  })
});

describe('plannerService - checkAssignmentPermission', () => {
  test('Admin can assign to any active user', async () => {
    const mockDb = createMockDb([{ id: 42, role: 'Recruiter', status: 'Active' }]);
    const assigner = { id: 1, role: 'Admin' };
    
    const result = await checkAssignmentPermission(assigner, 42, mockDb);
    
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test('Recruiter can assign to self', async () => {
    const mockDb = createMockDb([{ id: 5, role: 'Recruiter', status: 'Active' }]);
    const assigner = { id: 5, role: 'Recruiter' };
    
    const result = await checkAssignmentPermission(assigner, 5, mockDb);
    
    expect(result.allowed).toBe(true);
  });

  test('Recruiter can assign to HR Intern', async () => {
    const mockDb = createMockDb([{ id: 10, role: 'HR Intern', status: 'Active' }]);
    const assigner = { id: 5, role: 'Recruiter' };
    
    const result = await checkAssignmentPermission(assigner, 10, mockDb);
    
    expect(result.allowed).toBe(true);
  });

  test('Recruiter cannot assign to another Recruiter', async () => {
    const mockDb = createMockDb([{ id: 6, role: 'Recruiter', status: 'Active' }]);
    const assigner = { id: 5, role: 'Recruiter' };
    
    const result = await checkAssignmentPermission(assigner, 6, mockDb);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Recruiter can only assign to self or HR Interns');
  });

  test('HR Intern can only assign to self', async () => {
    const mockDb = createMockDb([{ id: 10, role: 'HR Intern', status: 'Active' }]);
    const assigner = { id: 10, role: 'HR Intern' };
    
    const result = await checkAssignmentPermission(assigner, 10, mockDb);
    
    expect(result.allowed).toBe(true);
  });

  test('HR Intern cannot assign to another user', async () => {
    const mockDb = createMockDb([{ id: 5, role: 'Recruiter', status: 'Active' }]);
    const assigner = { id: 10, role: 'HR Intern' };
    
    const result = await checkAssignmentPermission(assigner, 5, mockDb);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Intern can only assign to self');
  });

  test('Cannot assign to non-existent user', async () => {
    const mockDb = createMockDb([]);
    const assigner = { id: 1, role: 'Admin' };
    
    const result = await checkAssignmentPermission(assigner, 999, mockDb);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('User not found');
  });

  test('Cannot assign to inactive user', async () => {
    const mockDb = createMockDb([{ id: 42, role: 'Recruiter', status: 'Inactive' }]);
    const assigner = { id: 1, role: 'Admin' };
    
    const result = await checkAssignmentPermission(assigner, 42, mockDb);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('User not active');
  });
});

describe('plannerService - logActivity', () => {
  test('should insert activity log with correct parameters', async () => {
    const mockDb = createMockDb([]);
    const mockQuery = jest.fn(() => Promise.resolve());
    mockDb.query = mockQuery;
    
    await logActivity(100, 5, 'task_assigned', { assignee_id: 42 }, mockDb);
    
    expect(mockQuery).toHaveBeenCalledWith(
      'INSERT INTO task_activity_logs (task_id, user_id, action_type, action_details) VALUES (?, ?, ?, ?)',
      [100, 5, 'task_assigned', '{"assignee_id":42}']
    );
  });

  test('should handle empty details object', async () => {
    const mockDb = createMockDb([]);
    const mockQuery = jest.fn(() => Promise.resolve());
    mockDb.query = mockQuery;
    
    await logActivity(100, 5, 'task_created', {}, mockDb);
    
    expect(mockQuery).toHaveBeenCalledWith(
      'INSERT INTO task_activity_logs (task_id, user_id, action_type, action_details) VALUES (?, ?, ?, ?)',
      [100, 5, 'task_created', '{}']
    );
  });

  test('should handle no details parameter (defaults to empty object)', async () => {
    const mockDb = createMockDb([]);
    const mockQuery = jest.fn(() => Promise.resolve());
    mockDb.query = mockQuery;
    
    await logActivity(100, 5, 'task_deleted', undefined, mockDb);
    
    expect(mockQuery).toHaveBeenCalledWith(
      'INSERT INTO task_activity_logs (task_id, user_id, action_type, action_details) VALUES (?, ?, ?, ?)',
      [100, 5, 'task_deleted', '{}']
    );
  });
});

describe('plannerService - checkTaskOwnership', () => {
  test('Admin has access to any task', async () => {
    const mockDb = createMockDb([]);
    
    const result = await checkTaskOwnership(100, 1, 'Admin', mockDb);
    
    expect(result).toBe(true);
  });

  test('User has access to task they created', async () => {
    const mockDb = createMockDb([{ id: 100 }]);
    
    const result = await checkTaskOwnership(100, 5, 'Recruiter', mockDb);
    
    expect(result).toBe(true);
  });

  test('User has access to task assigned to them', async () => {
    const mockDb = createMockDb([{ id: 100 }]);
    
    const result = await checkTaskOwnership(100, 5, 'Recruiter', mockDb);
    
    expect(result).toBe(true);
  });

  test('User does not have access to unrelated task', async () => {
    const mockDb = createMockDb([]);
    
    const result = await checkTaskOwnership(100, 5, 'Recruiter', mockDb);
    
    expect(result).toBe(false);
  });
});

describe('plannerService - checkPlanAccess', () => {
  test('Admin has access to any plan', async () => {
    const mockDb = createMockDb([]);
    
    const result = await checkPlanAccess(10, 1, 'Admin', mockDb);
    
    expect(result).toBe(true);
  });

  test('Plan owner has access', async () => {
    const mockDb = createMockDb([{ id: 10 }]);
    
    const result = await checkPlanAccess(10, 5, 'Recruiter', mockDb);
    
    expect(result).toBe(true);
  });

  test('Plan member has access', async () => {
    // First query returns empty (not owner), second query returns membership
    let callCount = 0;
    const mockDb = {
      query: jest.fn(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve([]); // Not owner
        return Promise.resolve([{ id: 1 }]); // Is member
      })
    };
    
    const result = await checkPlanAccess(10, 5, 'Recruiter', mockDb);
    
    expect(result).toBe(true);
  });

  test('Non-member has no access', async () => {
    const mockDb = createMockDb([]);
    
    const result = await checkPlanAccess(10, 5, 'Recruiter', mockDb);
    
    expect(result).toBe(false);
  });
});

describe('plannerService - checkCrossPlanMove', () => {
  test('Move within same plan is allowed', async () => {
    let callCount = 0;
    const mockDb = {
      query: jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          // Task query - task in plan 1
          return Promise.resolve([{ id: 100, bucket_id: 5, current_plan_id: 1 }]);
        }
        // Target bucket query - bucket in plan 1
        return Promise.resolve([{ id: 6, plan_id: 1 }]);
      })
    };
    
    const result = await checkCrossPlanMove(100, 6, mockDb);
    
    expect(result.allowed).toBe(true);
  });

  test('Move across plans is not allowed', async () => {
    let callCount = 0;
    const mockDb = {
      query: jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          // Task query - task in plan 1
          return Promise.resolve([{ id: 100, bucket_id: 5, current_plan_id: 1 }]);
        }
        // Target bucket query - bucket in plan 2
        return Promise.resolve([{ id: 6, plan_id: 2 }]);
      })
    };
    
    const result = await checkCrossPlanMove(100, 6, mockDb);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Cannot move task across plans');
  });

  test('Non-existent task returns error', async () => {
    const mockDb = createMockDb([]);
    
    const result = await checkCrossPlanMove(999, 6, mockDb);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Task not found');
  });

  test('Non-existent target bucket returns error', async () => {
    let callCount = 0;
    const mockDb = {
      query: jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          // Task query - task exists
          return Promise.resolve([{ id: 100, bucket_id: 5, current_plan_id: 1 }]);
        }
        // Target bucket query - bucket doesn't exist
        return Promise.resolve([]);
      })
    };
    
    const result = await checkCrossPlanMove(100, 999, mockDb);
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Target bucket not found');
  });
});
