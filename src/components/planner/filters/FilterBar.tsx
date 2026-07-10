import { X } from 'lucide-react';
import { PlannerFilters } from './FilterPanel';

interface FilterBarProps {
  filters: PlannerFilters;
  onRemove: (key: keyof PlannerFilters) => void;
  onReset: () => void;
}

const LABELS: Partial<Record<keyof PlannerFilters, (val: string) => string>> = {
  priority: (v) => `Priority: ${v.charAt(0).toUpperCase() + v.slice(1)}`,
  status: (v) => `Status: ${{ pending: 'Pending', in_progress: 'In Progress', completed: 'Completed' }[v] ?? v}`,
  datePreset: (v) => `Date: ${{ today: 'Today', tomorrow: 'Tomorrow', thisWeek: 'This Week', thisMonth: 'This Month', overdue: 'Overdue', upcoming: 'Upcoming' }[v] ?? v}`,
  dueDateFrom: (v) => `From: ${v}`,
  dueDateTo: (v) => `To: ${v}`,
};

export default function FilterBar({ filters, onRemove, onReset }: FilterBarProps) {
  const activeKeys = (Object.keys(filters) as Array<keyof PlannerFilters>).filter(
    (k) => filters[k] !== undefined
  );

  if (activeKeys.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-700 flex-wrap">
      {activeKeys.map((key) => {
        const val = String(filters[key]);
        const labelFn = LABELS[key];
        const label = labelFn ? labelFn(val) : `${key}: ${val}`;
        return (
          <span
            key={key}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
          >
            {label}
            <button
              onClick={() => onRemove(key)}
              className="ml-0.5 rounded-full hover:bg-red-200 dark:hover:bg-red-800/40 transition-colors duration-150"
              aria-label={`Remove ${label} filter`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        );
      })}
      <button
        onClick={onReset}
        className="ml-auto text-xs text-gray-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-150 underline underline-offset-2"
      >
        Reset all
      </button>
    </div>
  );
}
