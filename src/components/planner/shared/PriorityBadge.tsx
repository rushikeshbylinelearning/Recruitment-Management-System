interface PriorityBadgeProps {
  priority: 'low' | 'medium' | 'high';
  className?: string;
}

const COLOUR_MAP: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function PriorityBadge({ priority, className = '' }: PriorityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full transition-all duration-150 ${COLOUR_MAP[priority]} ${className}`}
      aria-label={`Priority: ${priority}`}
    >
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

export default PriorityBadge;
