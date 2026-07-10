import { useEffect, useState } from 'react';
import { plannerService } from '../../../services/plannerService';
import ProgressBar from '../shared/ProgressBar';

interface Stats {
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  completion_percentage: number;
}

interface UserStatsPanelProps {
  userId: number;
}

export default function UserStatsPanel({ userId }: UserStatsPanelProps) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    plannerService.getAdminStats(userId).then(setStats).catch(() => {});
  }, [userId]);

  if (!stats) return null;

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-800 text-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-gray-500 dark:text-neutral-400">Tasks:</span>
        <span className="font-semibold text-gray-700 dark:text-neutral-300">{stats.total_tasks}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{stats.completed_tasks} done</span>
      </div>
      {stats.overdue_tasks > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-red-600 dark:text-red-400 font-medium">{stats.overdue_tasks} overdue</span>
        </div>
      )}
      <div className="flex items-center gap-2 flex-1 max-w-32">
        <ProgressBar value={stats.completion_percentage} showLabel size="sm" />
      </div>
    </div>
  );
}
