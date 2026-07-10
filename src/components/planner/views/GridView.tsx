import { useState, useEffect, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { plannerService, Bucket, TaskCard } from '../../../services/plannerService';
import PriorityBadge from '../shared/PriorityBadge';
import StatusBadge from '../shared/StatusBadge';

type SortKey = 'title' | 'priority' | 'status' | 'assignee_name' | 'due_date' | 'created_at';
type SortDir = 'asc' | 'desc';

interface GridViewProps {
  planId: number;
  onTaskClick: (taskId: number) => void;
  refreshKey?: number;
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const STATUS_ORDER: Record<string, number> = { in_progress: 0, pending: 1, completed: 2 };

function sortTasks(tasks: TaskCard[], key: SortKey, dir: SortDir): TaskCard[] {
  return [...tasks].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case 'priority':
        cmp = (PRIORITY_ORDER[a.priority ?? ''] ?? 3) - (PRIORITY_ORDER[b.priority ?? ''] ?? 3);
        break;
      case 'status':
        cmp = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
        break;
      case 'due_date':
        cmp = (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999');
        break;
      case 'assignee_name':
        cmp = (a.assignee_name ?? '').localeCompare(b.assignee_name ?? '');
        break;
      default:
        cmp = String(a[key] ?? '').localeCompare(String(b[key] ?? ''));
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

export default function GridView({ planId, onTaskClick, refreshKey }: GridViewProps) {
  const [allTasks, setAllTasks] = useState<TaskCard[]>([]);
  const [bucketMap, setBucketMap] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const buckets: Bucket[] = await plannerService.getBuckets(planId);
      const bMap: Record<number, string> = {};
      const taskArrays = await Promise.all(
        buckets.map(async (b) => {
          bMap[b.id] = b.name;
          return plannerService.getTasks(b.id);
        })
      );
      setBucketMap(bMap);
      setAllTasks(taskArrays.flat());
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [planId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (refreshKey != null && refreshKey > 0) fetchData(true);
  }, [refreshKey, fetchData]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />
    ) : null;

  const sorted = sortTasks(allTasks, sortKey, sortDir);

  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:hover:text-neutral-200 transition-colors duration-150';

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse h-10 rounded bg-gray-200 dark:bg-neutral-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-white dark:bg-neutral-900 z-10 border-b border-gray-200 dark:border-neutral-700">
            <tr>
              <th className={thCls} onClick={() => handleSort('title')}>
                Title <SortIcon col="title" />
              </th>
              <th className={thCls} onClick={() => handleSort('priority')}>
                Priority <SortIcon col="priority" />
              </th>
              <th className={thCls} onClick={() => handleSort('status')}>
                Status <SortIcon col="status" />
              </th>
              <th className={thCls} onClick={() => handleSort('assignee_name')}>
                Assigned To <SortIcon col="assignee_name" />
              </th>
              <th className={thCls} onClick={() => handleSort('due_date')}>
                Due Date <SortIcon col="due_date" />
              </th>
              <th className={thCls}>Bucket</th>
              <th className={thCls}>Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
            {sorted.map((task) => (
              <tr
                key={task.id}
                onClick={() => onTaskClick(task.id)}
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800/60 transition-colors duration-150"
              >
                <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-neutral-200 max-w-xs truncate">
                  {task.title}
                </td>
                <td className="px-3 py-2.5">
                  {task.priority ? <PriorityBadge priority={task.priority} /> : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={task.status} />
                </td>
                <td className="px-3 py-2.5 text-gray-600 dark:text-neutral-400">
                  {task.assignee_name ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-gray-600 dark:text-neutral-400 tabular-nums whitespace-nowrap">
                  {task.due_date
                    ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : '—'}
                </td>
                <td className="px-3 py-2.5 text-gray-500 dark:text-neutral-500 text-xs">
                  {bucketMap[task.id] ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-gray-500 dark:text-neutral-500 text-xs tabular-nums">
                  {task.completion_percentage}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <p className="text-center py-12 text-gray-400 dark:text-neutral-500 text-sm">
            No tasks found.
          </p>
        )}
      </div>
    </div>
  );
}
