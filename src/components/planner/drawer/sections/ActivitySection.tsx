/**
 * ActivitySection — Sections 6 & 7 of the left panel (lazy-loaded)
 *
 * Timeline design with:
 *   - Grouped by date (Today, Yesterday, older dates)
 *   - Color-coded action icons
 *   - User avatar + name + action description + time
 *   - Admin "History" mode shows full audit trail with more detail
 *
 * Uses existing plannerService.getActivity (no API changes).
 */

import { useState, useEffect, memo } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  ArrowRight,
  UserPlus,
  CheckCircle2,
  Upload,
  MessageSquare,
  Tag,
  RefreshCw,
  AlertCircle,
  CheckSquare,
  RotateCcw,
} from 'lucide-react';
import { plannerService } from '../../../../services/plannerService';
import { getInitials } from '../TaskDetailModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityEntry {
  id: number;
  action_type: string;
  user_name: string;
  created_at: string;
  action_details?: Record<string, unknown>;
}

interface ActivitySectionProps {
  taskId: number;
  adminOnly?: boolean;
}

// ─── Action config ────────────────────────────────────────────────────────────

interface ActionConfig {
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
}

const ACTION_CONFIG: Record<string, ActionConfig> = {
  task_created: {
    label: 'created this task',
    icon: <Plus className="w-3 h-3" />,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  task_edited: {
    label: 'updated task details',
    icon: <Edit3 className="w-3 h-3" />,
    colorClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
  },
  task_moved: {
    label: 'moved this task',
    icon: <ArrowRight className="w-3 h-3" />,
    colorClass: 'text-violet-600 dark:text-violet-400',
    bgClass: 'bg-violet-100 dark:bg-violet-900/30',
  },
  task_assigned: {
    label: 'assigned this task',
    icon: <UserPlus className="w-3 h-3" />,
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
  },
  task_completed: {
    label: 'marked as completed',
    icon: <CheckCircle2 className="w-3 h-3" />,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  task_deleted: {
    label: 'deleted this task',
    icon: <Trash2 className="w-3 h-3" />,
    colorClass: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
  },
  task_restored: {
    label: 'restored this task',
    icon: <RotateCcw className="w-3 h-3" />,
    colorClass: 'text-teal-600 dark:text-teal-400',
    bgClass: 'bg-teal-100 dark:bg-teal-900/30',
  },
  priority_changed: {
    label: 'changed priority',
    icon: <AlertCircle className="w-3 h-3" />,
    colorClass: 'text-orange-600 dark:text-orange-400',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
  },
  status_changed: {
    label: 'changed status',
    icon: <RefreshCw className="w-3 h-3" />,
    colorClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
  },
  checklist_updated: {
    label: 'updated checklist',
    icon: <CheckSquare className="w-3 h-3" />,
    colorClass: 'text-indigo-600 dark:text-indigo-400',
    bgClass: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
  file_uploaded: {
    label: 'uploaded a file',
    icon: <Upload className="w-3 h-3" />,
    colorClass: 'text-violet-600 dark:text-violet-400',
    bgClass: 'bg-violet-100 dark:bg-violet-900/30',
  },
  file_deleted: {
    label: 'deleted a file',
    icon: <Trash2 className="w-3 h-3" />,
    colorClass: 'text-red-500 dark:text-red-400',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
  },
  comment_added: {
    label: 'added a comment',
    icon: <MessageSquare className="w-3 h-3" />,
    colorClass: 'text-sky-600 dark:text-sky-400',
    bgClass: 'bg-sky-100 dark:bg-sky-900/30',
  },
  label_changed: {
    label: 'changed labels',
    icon: <Tag className="w-3 h-3" />,
    colorClass: 'text-pink-600 dark:text-pink-400',
    bgClass: 'bg-pink-100 dark:bg-pink-900/30',
  },
  bucket_moved: {
    label: 'moved to a different bucket',
    icon: <ArrowRight className="w-3 h-3" />,
    colorClass: 'text-violet-600 dark:text-violet-400',
    bgClass: 'bg-violet-100 dark:bg-violet-900/30',
  },
};

const DEFAULT_ACTION: ActionConfig = {
  label: '',
  icon: <Edit3 className="w-3 h-3" />,
  colorClass: 'text-gray-500 dark:text-neutral-400',
  bgClass: 'bg-gray-100 dark:bg-neutral-700',
};

// ─── Date grouping helpers ────────────────────────────────────────────────────

function getDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function groupByDate(entries: ActivityEntry[]): Array<{ group: string; items: ActivityEntry[] }> {
  const map = new Map<string, ActivityEntry[]>();
  for (const entry of entries) {
    const key = getDateGroup(entry.created_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default memo(function ActivitySection({ taskId, adminOnly = false }: ActivitySectionProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    plannerService.getActivity(taskId).then((data) => {
      setEntries(data ?? []);
      setIsLoading(false);
    });
  }, [taskId]);

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-6 h-6 bg-gray-100 dark:bg-neutral-800 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-gray-100 dark:bg-neutral-800 rounded w-3/4" />
              <div className="h-3 bg-gray-100 dark:bg-neutral-800 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-neutral-500 italic text-center py-4">
        No activity recorded yet.
      </p>
    );
  }

  const groups = groupByDate(entries);

  return (
    <div className="space-y-5">
      {adminOnly && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
            Full Audit Trail
          </span>
        </div>
      )}

      {groups.map(({ group, items }) => (
        <div key={group}>
          {/* Date group header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-px bg-gray-100 dark:bg-neutral-800" />
            <span className="text-xs font-semibold text-gray-400 dark:text-neutral-500 whitespace-nowrap">
              {group}
            </span>
            <div className="flex-1 h-px bg-gray-100 dark:bg-neutral-800" />
          </div>

          {/* Timeline items */}
          <ul className="space-y-3">
            {items.map((entry, i) => {
              const cfg = ACTION_CONFIG[entry.action_type] ?? DEFAULT_ACTION;
              const label = cfg.label || entry.action_type.replace(/_/g, ' ');
              const initials = getInitials(entry.user_name);
              const time = new Date(entry.created_at).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              });

              return (
                <li key={entry.id} className="flex gap-3 items-start group">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center shrink-0">
                    {/* Action icon */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${cfg.bgClass} ${cfg.colorClass}`}
                      aria-hidden="true"
                    >
                      {cfg.icon}
                    </div>
                    {/* Connector line */}
                    {i < items.length - 1 && (
                      <div className="w-px flex-1 bg-gray-100 dark:bg-neutral-800 mt-1 mb-1 min-h-[12px]" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-start gap-2 flex-wrap">
                      {/* User avatar */}
                      <span
                        className="inline-flex w-5 h-5 rounded-full bg-red-600 text-white text-[9px] font-bold items-center justify-center shrink-0 mt-0.5"
                        title={entry.user_name}
                        aria-label={entry.user_name}
                      >
                        {initials}
                      </span>

                      <span className="text-sm text-gray-800 dark:text-neutral-200 font-medium">
                        {entry.user_name}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-neutral-400">
                        {label}
                      </span>
                    </div>

                    {/* Time */}
                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5 ml-7">
                      {time}
                    </p>

                    {/* Details (admin mode) */}
                    {adminOnly && entry.action_details && Object.keys(entry.action_details).length > 0 && (
                      <details className="mt-1 ml-7">
                        <summary className="text-xs text-gray-400 dark:text-neutral-500 cursor-pointer hover:text-gray-600 dark:hover:text-neutral-400 select-none">
                          View details
                        </summary>
                        <pre className="mt-1.5 text-xs bg-gray-50 dark:bg-neutral-800 rounded-lg p-2 overflow-auto max-h-32 text-gray-600 dark:text-neutral-400">
                          {JSON.stringify(entry.action_details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
});
