type Status = 'pending' | 'in_progress' | 'completed';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const CONFIG: Record<Status, { label: string; cls: string }> = {
  pending: {
    label: 'Pending',
    cls: 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-neutral-400',
  },
  in_progress: {
    label: 'In Progress',
    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  completed: {
    label: 'Completed',
    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const { label, cls } = CONFIG[status] ?? CONFIG.pending;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full transition-all duration-150 ${cls} ${className}`}
      aria-label={`Status: ${label}`}
    >
      {label}
    </span>
  );
}

export default StatusBadge;
