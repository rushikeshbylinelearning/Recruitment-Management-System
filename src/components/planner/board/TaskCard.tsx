import { Calendar, CheckSquare, GripVertical, UserCheck, Repeat, Timer, Clock } from 'lucide-react';
import type { TaskCard as TaskCardType } from '../../../services/plannerService';
import PriorityBadge from '../shared/PriorityBadge';
import LabelChip from '../shared/LabelChip';
import ProgressBar from '../shared/ProgressBar';
import { useAuth } from '../../../contexts/AuthContext';

interface TaskCardProps {
  task: TaskCardType;
  onClick: (taskId: number) => void;
  onToggleComplete?: (taskId: number, completed: boolean) => void;
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

function formatDueTime(due_time: string | null | undefined): string {
  if (!due_time) return '';
  const parts = String(due_time).split(':');
  if (parts.length < 2) return String(due_time);
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function liveElapsed(task: TaskCardType): number {
  const base = task.timer_elapsed_seconds ?? 0;
  if (!task.timer_started_at) return base;
  const started = new Date(task.timer_started_at).getTime();
  if (Number.isNaN(started)) return base;
  return base + Math.max(0, Math.floor((Date.now() - started) / 1000));
}

export default function TaskCard({
  task,
  onClick,
  onToggleComplete,
  dragHandleProps,
  isDragging,
}: TaskCardProps) {
  const { user } = useAuth();
  const overdue = task.status !== 'completed' && isOverdue(task.due_date);
  const checklistPct =
    task.checklist_total > 0
      ? Math.floor((task.checklist_checked / task.checklist_total) * 100)
      : 0;
  const isDaily = (task.recurrence_type ?? 'none') === 'daily';
  const elapsed = liveElapsed(task);
  const showTimer = elapsed > 0 || Boolean(task.timer_started_at);

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
        {/* Title row with complete checkbox */}
        <div className="flex items-start gap-2 mb-2">
          {onToggleComplete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleComplete(task.id, task.status !== 'completed');
              }}
              className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                task.status === 'completed'
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'border-gray-300 dark:border-neutral-600 hover:border-emerald-500'
              }`}
              aria-label={task.status === 'completed' ? 'Mark incomplete' : 'Mark complete'}
              title={task.status === 'completed' ? 'Mark incomplete' : 'Mark complete'}
            >
              {task.status === 'completed' && (
                <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 6l3 3 5-5" />
                </svg>
              )}
            </button>
          )}
          <p
            className={`text-sm font-medium leading-snug line-clamp-2 flex-1 min-w-0 ${
              task.status === 'completed'
                ? 'line-through text-gray-400 dark:text-neutral-500'
                : 'text-gray-800 dark:text-neutral-200'
            }`}
          >
            {task.title}
          </p>
        </div>

        {/* Badges: daily / timer / due time */}
        {(isDaily || showTimer || task.due_time) && (
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {isDaily && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
                <Repeat className="w-2.5 h-2.5" />
                Daily
              </span>
            )}
            {task.due_time && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-50 text-gray-600 border border-gray-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700">
                <Clock className="w-2.5 h-2.5" />
                {formatDueTime(task.due_time)}
              </span>
            )}
            {showTimer && (
              <span
                className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md tabular-nums border ${
                  task.timer_started_at
                    ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
                    : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700'
                }`}
              >
                <Timer className="w-2.5 h-2.5" />
                {formatElapsed(elapsed)}
              </span>
            )}
          </div>
        )}

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
