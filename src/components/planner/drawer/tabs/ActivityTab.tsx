import { useState, useEffect } from 'react';
import { plannerService } from '../../../../services/plannerService';

interface ActivityEntry {
  id: number;
  action_type: string;
  user_name: string;
  created_at: string;
  action_details?: Record<string, unknown>;
}

interface ActivityTabProps {
  taskId: number;
  adminOnly?: boolean;
}

function formatAction(entry: ActivityEntry): string {
  const labels: Record<string, string> = {
    task_created: 'created this task',
    task_edited: 'updated task details',
    task_moved: 'moved this task',
    priority_changed: 'changed priority',
    task_assigned: 'assigned this task',
    task_completed: 'marked as completed',
    checklist_updated: 'updated checklist',
    file_uploaded: 'uploaded a file',
    file_deleted: 'deleted a file',
    comment_added: 'added a comment',
    label_changed: 'changed labels',
    status_changed: 'changed status',
    bucket_moved: 'moved to a different bucket',
    task_deleted: 'deleted this task',
    task_restored: 'restored this task',
  };
  return labels[entry.action_type] ?? entry.action_type;
}

export default function ActivityTab({ taskId, adminOnly = false }: ActivityTabProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    plannerService.getActivity(taskId).then((data) => {
      setEntries(data ?? []);
      setIsLoading(false);
    });
  }, [taskId]);

  if (isLoading) {
    return <div className="p-4 animate-pulse space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-200 dark:bg-neutral-700 rounded" />)}</div>;
  }

  if (entries.length === 0) {
    return <p className="p-4 text-sm text-gray-400 dark:text-neutral-500">No activity yet.</p>;
  }

  return (
    <div className="p-4 space-y-3 overflow-y-auto">
      {adminOnly && (
        <p className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wider">
          Full Audit Trail
        </p>
      )}
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li key={entry.id} className="flex gap-2.5 text-sm">
            <div className="w-6 h-6 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              {entry.user_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-gray-700 dark:text-neutral-300">{entry.user_name}</span>{' '}
              <span className="text-gray-500 dark:text-neutral-400">{formatAction(entry)}</span>
              <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                {new Date(entry.created_at).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
