/**
 * TaskDrawer — entry-point wrapper
 *
 * This file is kept for backward compatibility so that all existing consumers
 * (PlannerWorkspace, board cards, etc.) that import TaskDrawer continue to work
 * without any changes.
 *
 * The actual modal UI is now TaskDetailModal — a Planner-style split-layout
 * implementation that replaces the old tabbed drawer. All existing props are
 * preserved. The `activeTab` and `onTabChange` props are accepted but no longer
 * used (the new design uses scrollable sections, not tabs).
 *
 * Existing features preserved:
 *   ✔ Task CRUD via existing APIs
 *   ✔ Authentication & permissions
 *   ✔ Checklist, Notes, Attachments, Comments, Activity, History
 *   ✔ Admin-only History section
 *   ✔ Escape key closes modal
 *   ✔ onTaskUpdated callback
 */

import TaskDetailModal from './TaskDetailModal';
import type { DrawerTab } from '../../../hooks/useTaskDrawer';

interface TaskDrawerProps {
  isOpen: boolean;
  taskId: number | null;
  /** @deprecated - tabs are now scrollable sections; prop kept for compatibility */
  activeTab?: DrawerTab;
  /** @deprecated - tabs are now scrollable sections; prop kept for compatibility */
  onTabChange?: (tab: DrawerTab) => void;
  onClose: () => void;
  onTaskUpdated?: () => void;
}

export default function TaskDrawer({
  isOpen,
  taskId,
  onClose,
  onTaskUpdated,
}: TaskDrawerProps) {
  return (
    <TaskDetailModal
      isOpen={isOpen}
      taskId={taskId}
      onClose={onClose}
      onTaskUpdated={onTaskUpdated}
    />
  );
}
