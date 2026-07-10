/**
 * Progress Calculator Utility
 * 
 * Provides functions to calculate progress percentages for:
 * - Checklist items within tasks (R6)
 * - Tasks within buckets (R2)
 */

/**
 * Calculate checklist progress percentage
 * 
 * @param {Array} items - Array of checklist items with is_checked boolean field
 * @returns {number} Progress percentage (0-100), returns 0 for empty array
 * 
 * Formula: Math.floor(checkedCount / totalCount * 100)
 * 
 * @example
 * calculateChecklistProgress([
 *   { id: 1, is_checked: true },
 *   { id: 2, is_checked: false },
 *   { id: 3, is_checked: true }
 * ]) // Returns 66
 */
function calculateChecklistProgress(items) {
  // Handle null, undefined, or empty array
  if (!items || !Array.isArray(items) || items.length === 0) {
    return 0;
  }

  const checkedCount = items.filter(item => item.is_checked === true).length;
  return Math.floor((checkedCount / items.length) * 100);
}

/**
 * Calculate bucket progress percentage based on completed tasks
 * 
 * @param {Array} tasks - Array of task objects with status field
 * @returns {number} Progress percentage (0-100), returns 0 for empty array
 * 
 * Formula: Math.floor(completedCount / totalCount * 100)
 * 
 * @example
 * calculateBucketProgress([
 *   { id: 1, status: 'completed' },
 *   { id: 2, status: 'pending' },
 *   { id: 3, status: 'completed' },
 *   { id: 4, status: 'in_progress' }
 * ]) // Returns 50
 */
function calculateBucketProgress(tasks) {
  // Handle null, undefined, or empty array
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return 0;
  }

  const completedCount = tasks.filter(task => task.status === 'completed').length;
  return Math.floor((completedCount / tasks.length) * 100);
}

export {
  calculateChecklistProgress,
  calculateBucketProgress
};
