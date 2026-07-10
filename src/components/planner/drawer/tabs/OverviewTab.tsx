import { useState, useEffect } from 'react';
import { plannerService } from '../../../../services/plannerService';
import PriorityBadge from '../../shared/PriorityBadge';
import StatusBadge from '../../shared/StatusBadge';

interface OverviewTabProps {
  task: Record<string, unknown>;
  onUpdated: (updates?: Record<string, unknown>) => void;
}

export default function OverviewTab({ task, onUpdated }: OverviewTabProps) {
  const [saving, setSaving] = useState(false);
  const [completionPct, setCompletionPct] = useState(() => (task.completion_percentage as number) ?? 0);
  const [isDraggingCompletion, setIsDraggingCompletion] = useState(false);

  useEffect(() => {
    if (!isDraggingCompletion) {
      setCompletionPct((task.completion_percentage as number) ?? 0);
    }
  }, [task.completion_percentage, isDraggingCompletion]);

  const handleFieldChange = async (field: string, value: unknown) => {
    setSaving(true);
    try {
      await plannerService.updateTask(task.id as number, { [field]: value });
      onUpdated({ [field]: value });
    } finally {
      setSaving(false);
    }
  };

  const handleCompletionCommit = async (value: number) => {
    if (value === (task.completion_percentage as number)) return;
    await handleFieldChange('completion_percentage', value);
  };

  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      {saving && (
        <p className="text-xs text-gray-400 dark:text-neutral-500 text-right animate-pulse">Saving…</p>
      )}

      {/* Title */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Title</label>
        <input
          type="text"
          defaultValue={task.title as string}
          onBlur={(e) => {
            if (e.target.value !== task.title) handleFieldChange('title', e.target.value);
          }}
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Description</label>
        <textarea
          defaultValue={(task.description as string) ?? ''}
          rows={3}
          onBlur={(e) => {
            if (e.target.value !== task.description) handleFieldChange('description', e.target.value);
          }}
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          placeholder="Add a description…"
        />
      </div>

      {/* Priority + Status row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Priority</label>
          <select
            value={(task.priority as string) ?? ''}
            onChange={(e) => handleFieldChange('priority', e.target.value || null)}
            className="w-full text-sm px-2 py-1.5 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="">None</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Status</label>
          <select
            value={task.status as string}
            onChange={(e) => handleFieldChange('status', e.target.value)}
            className="w-full text-sm px-2 py-1.5 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Due date */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Due Date</label>
        <input
          type="date"
          defaultValue={(task.due_date as string) ?? ''}
          onBlur={(e) => handleFieldChange('due_date', e.target.value || null)}
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      {/* Completion percentage */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">
          Completion: {completionPct}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={completionPct}
          onChange={(e) => setCompletionPct(parseInt(e.target.value, 10))}
          onPointerDown={() => setIsDraggingCompletion(true)}
          onPointerUp={(e) => {
            setIsDraggingCompletion(false);
            const val = parseInt((e.target as HTMLInputElement).value, 10);
            handleCompletionCommit(val);
          }}
          className="w-full accent-red-600"
        />
      </div>

      {/* Assigned to / by */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Assigned To</p>
          <p className="text-gray-700 dark:text-neutral-300">{(task.assignee_name as string) ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Assigned By</p>
          <p className="text-gray-700 dark:text-neutral-300">{(task.assigner_name as string) ?? '—'}</p>
        </div>
      </div>

      {/* Estimated time */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Estimated Time</label>
        <input
          type="text"
          defaultValue={(task.estimated_time as string) ?? ''}
          onBlur={(e) => handleFieldChange('estimated_time', e.target.value || null)}
          placeholder="e.g. 2h 30m"
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>
    </div>
  );
}
