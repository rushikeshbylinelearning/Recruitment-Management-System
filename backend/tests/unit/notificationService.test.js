/**
 * Unit tests for notificationService
 * 
 * Tests the notification email template generation functions.
 */

import { 
  buildTaskAssignmentEmailTemplate, 
  buildPlainTextFallback 
} from '../../services/notificationService.js';

describe('notificationService', () => {
  const mockTask = {
    id: 123,
    title: 'Review candidate applications',
    description: 'Review all applications received for the Software Engineer position',
    priority: 'high',
    status: 'pending',
    due_date: '2026-12-31'
  };

  const mockAssigner = {
    id: 1,
    name: 'Admin User',
    role: 'Admin'
  };

  describe('buildTaskAssignmentEmailTemplate', () => {
    test('should generate valid HTML email template', () => {
      const html = buildTaskAssignmentEmailTemplate(mockTask, mockAssigner);
      
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
      expect(html).toContain(mockTask.title);
      expect(html).toContain(mockTask.description);
      expect(html).toContain(mockAssigner.name);
    });

    test('should include priority badge with correct color', () => {
      const html = buildTaskAssignmentEmailTemplate(mockTask, mockAssigner);
      expect(html).toContain('#EF4444'); // high priority red color
    });

    test('should handle missing description gracefully', () => {
      const taskWithoutDesc = { ...mockTask, description: null };
      const html = buildTaskAssignmentEmailTemplate(taskWithoutDesc, mockAssigner);
      expect(html).toContain('No description provided');
    });

    test('should handle missing due date gracefully', () => {
      const taskWithoutDueDate = { ...mockTask, due_date: null };
      const html = buildTaskAssignmentEmailTemplate(taskWithoutDueDate, mockAssigner);
      expect(html).toContain('No due date');
    });

    test('should format due date correctly', () => {
      const html = buildTaskAssignmentEmailTemplate(mockTask, mockAssigner);
      expect(html).toContain('December 31, 2026');
    });

    test('should include all priority levels with correct colors', () => {
      const lowPriorityTask = { ...mockTask, priority: 'low' };
      const mediumPriorityTask = { ...mockTask, priority: 'medium' };
      const highPriorityTask = { ...mockTask, priority: 'high' };

      const lowHtml = buildTaskAssignmentEmailTemplate(lowPriorityTask, mockAssigner);
      const mediumHtml = buildTaskAssignmentEmailTemplate(mediumPriorityTask, mockAssigner);
      const highHtml = buildTaskAssignmentEmailTemplate(highPriorityTask, mockAssigner);

      expect(lowHtml).toContain('#10B981'); // green
      expect(mediumHtml).toContain('#F59E0B'); // amber
      expect(highHtml).toContain('#EF4444'); // red
    });

    test('should display all status types correctly', () => {
      const pendingTask = { ...mockTask, status: 'pending' };
      const inProgressTask = { ...mockTask, status: 'in_progress' };
      const completedTask = { ...mockTask, status: 'completed' };

      const pendingHtml = buildTaskAssignmentEmailTemplate(pendingTask, mockAssigner);
      const inProgressHtml = buildTaskAssignmentEmailTemplate(inProgressTask, mockAssigner);
      const completedHtml = buildTaskAssignmentEmailTemplate(completedTask, mockAssigner);

      expect(pendingHtml).toContain('Pending');
      expect(inProgressHtml).toContain('In Progress');
      expect(completedHtml).toContain('Completed');
    });
  });

  describe('buildPlainTextFallback', () => {
    test('should generate valid plain text email', () => {
      const text = buildPlainTextFallback(mockTask, mockAssigner);
      
      expect(text).toContain('NEW TASK ASSIGNED');
      expect(text).toContain(mockTask.title);
      expect(text).toContain(mockTask.description);
      expect(text).toContain(mockAssigner.name);
    });

    test('should include all task details in plain text', () => {
      const text = buildPlainTextFallback(mockTask, mockAssigner);
      
      expect(text).toContain('Title:');
      expect(text).toContain('Description:');
      expect(text).toContain('Priority:');
      expect(text).toContain('Status:');
      expect(text).toContain('Due Date:');
      expect(text).toContain('Assigned By:');
    });

    test('should handle missing description in plain text', () => {
      const taskWithoutDesc = { ...mockTask, description: null };
      const text = buildPlainTextFallback(taskWithoutDesc, mockAssigner);
      expect(text).toContain('No description provided');
    });

    test('should handle missing due date in plain text', () => {
      const taskWithoutDueDate = { ...mockTask, due_date: null };
      const text = buildPlainTextFallback(taskWithoutDueDate, mockAssigner);
      expect(text).toContain('No due date');
    });

    test('should format due date correctly in plain text', () => {
      const text = buildPlainTextFallback(mockTask, mockAssigner);
      expect(text).toContain('December 31, 2026');
    });

    test('should capitalize priority correctly', () => {
      const lowPriorityTask = { ...mockTask, priority: 'low' };
      const mediumPriorityTask = { ...mockTask, priority: 'medium' };
      const highPriorityTask = { ...mockTask, priority: 'high' };

      expect(buildPlainTextFallback(lowPriorityTask, mockAssigner)).toContain('Priority: Low');
      expect(buildPlainTextFallback(mediumPriorityTask, mockAssigner)).toContain('Priority: Medium');
      expect(buildPlainTextFallback(highPriorityTask, mockAssigner)).toContain('Priority: High');
    });

    test('should not contain HTML tags in plain text', () => {
      const text = buildPlainTextFallback(mockTask, mockAssigner);
      expect(text).not.toContain('<');
      expect(text).not.toContain('>');
      expect(text).not.toContain('<html');
      expect(text).not.toContain('<body');
    });
  });

  describe('edge cases', () => {
    test('should handle empty task title', () => {
      const taskWithEmptyTitle = { ...mockTask, title: '' };
      const html = buildTaskAssignmentEmailTemplate(taskWithEmptyTitle, mockAssigner);
      const text = buildPlainTextFallback(taskWithEmptyTitle, mockAssigner);
      
      expect(html).toBeDefined();
      expect(text).toBeDefined();
    });

    test('should handle very long descriptions', () => {
      const longDescription = 'A'.repeat(5000);
      const taskWithLongDesc = { ...mockTask, description: longDescription };
      const html = buildTaskAssignmentEmailTemplate(taskWithLongDesc, mockAssigner);
      const text = buildPlainTextFallback(taskWithLongDesc, mockAssigner);
      
      expect(html).toContain(longDescription);
      expect(text).toContain(longDescription);
    });

    test('should handle special characters in task details', () => {
      const specialTask = {
        ...mockTask,
        title: 'Task with <special> & "characters"',
        description: 'Description with\'s apostrophes & ampersands'
      };
      
      const html = buildTaskAssignmentEmailTemplate(specialTask, mockAssigner);
      const text = buildPlainTextFallback(specialTask, mockAssigner);
      
      expect(html).toContain(specialTask.title);
      expect(text).toContain(specialTask.title);
    });

    test('should handle missing priority', () => {
      const taskWithoutPriority = { ...mockTask, priority: null };
      const html = buildTaskAssignmentEmailTemplate(taskWithoutPriority, mockAssigner);
      const text = buildPlainTextFallback(taskWithoutPriority, mockAssigner);
      
      expect(html).toContain('Not set');
      expect(text).toContain('Not set');
    });

    test('should handle unknown status', () => {
      const taskWithUnknownStatus = { ...mockTask, status: 'custom_status' };
      const html = buildTaskAssignmentEmailTemplate(taskWithUnknownStatus, mockAssigner);
      
      expect(html).toContain('custom_status');
    });
  });
});
