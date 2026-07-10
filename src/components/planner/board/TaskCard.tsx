import { Calendar, CheckSquare, GripVertical, UserCheck } from 'lucide-react';
import type { TaskCard as TaskCardType } from '../../../services/plannerService';
import PriorityBadge from '../shared/PriorityBadge';
import LabelChip from '../shared/LabelChip';
import ProgressBar from '../shared/ProgressBar';
import { useAuth } from '../../../contexts/AuthContext';

interface TaskCardProps {
  task: TaskCardType;
  onClick: (taskId: number) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

function isOverdue(due_date: string | null): boolean {
  if (!due_date) return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}

function formatDate(due_date: string | null): string {
  if (!due_date) return '';
  return new Date(due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TaskCard({ task, onClick, dragHandleProps, isDragging }: TaskCardProps) {
  const { user } = useAuth();
  const overdue = task.status !== 'completed' && isOverdue(task.due_date);
  const checklistPct =
    task.checklist_total > 0
      ? Math.floor((task.checklist_checked / task.checklist_total) * 100)
      : 0;

  // Show "Created by X" when the creator is an Admin and the current viewer is not that admin
  const showCreator =
    task.created_by_name &&
    task.created_by !== task.assigned_to &&
    user?.id !== task.created_by;

  return (
    <div
      onClick={() => onClick(task.id)}
      className={`group relative bg-white dark:bg-neutral-800 rounded-xl border transition-all duration-150 cursor-pointer select-none ${
        isDragging
          ? 'border-red-400 shadow-lg rotate-1 opacity-90'
          : 'border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600 hover:shadow-md'
      }`}
    >
      {/* Drag handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
          className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-grab active:cursor-grabbing text-gray-300 dark:text-neutral-600 p-1"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}

      <div className="p-3 pl-5">
        {/* Title */}
        <p
          className={`text-sm font-medium leading-snug mb-2 line-clamp-2 ${
            task.status === 'completed'
              ? 'line-through text-gray-400 dark:text-neutral-500'
              : 'text-gray-800 dark:text-neutral-200'
          }`}
        >
          {task.title}
        </p>

        {/* "Created by" badge — shown when an admin created this task */}
        {showCreator && (
          <div className="flex items-center gap-1 mb-2">
            <UserCheck className="w-3 h-3 text-indigo-400 dark:text-indigo-400 shrink-0" />
            <span className="text-xs text-indigo-500 dark:text-indigo-400 truncate">
              {task.created_by_name}
            </span>
          </div>
        )}

        {/* Labels row */}
        {task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.labels.slice(0, 3).map((label) => (
              <LabelChip key={label.id} name={label.name} colour={label.colour} />
            ))}
            {task.labels.length > 3 && (
              <span className="text-xs text-gray-400 dark:text-neutral-500 self-center">
                +{task.labels.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Checklist mini progress */}
        {task.checklist_total > 0 && (
          <div className="flex items-center gap-1.5 mb-2">
            <CheckSquare className="w-3 h-3 text-gray-400 dark:text-neutral-500 shrink-0" />
            <ProgressBar value={checklistPct} size="sm" className="flex-1" />
            <span className="text-xs text-gray-400 dark:text-neutral-500 tabular-nums shrink-0">
              {task.checklist_checked}/{task.checklist_total}
            </span>
          </div>
        )}

        {/* Footer: priority + assignee + due date */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-1.5">
            {task.priority && <PriorityBadge priority={task.priority} />}
          </div>
          <div className="flex items-center gap-2">
            {/* Assignee avatar */}
            {task.assignee_name && (
              <div
                className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                title={`Assigned to: ${task.assignee_name}`}
                aria-label={`Assigned to ${task.assignee_name}`}
              >
                {task.assignee_avatar || task.assignee_name.charAt(0).toUpperCase()}
              </div>
            )}
            {/* Due date */}
            {task.due_date && (
              <span
                className={`flex items-center gap-0.5 text-xs tabular-nums ${
                  overdue
                    ? 'text-red-600 dark:text-red-400 font-medium'
                    : 'text-gray-400 dark:text-neutral-500'
                }`}
                title={overdue ? 'Overdue' : `Due ${formatDate(task.due_date)}`}
              >
                <Calendar className="w-3 h-3 shrink-0" />
                {formatDate(task.due_date)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
