export interface PlannerFilters {
  assignedTo?: number;
  priority?: 'low' | 'medium' | 'high';
  status?: 'pending' | 'in_progress' | 'completed';
  labelId?: number;
  datePreset?: 'today' | 'tomorrow' | 'thisWeek' | 'thisMonth' | 'overdue' | 'upcoming';
  dueDateFrom?: string;
  dueDateTo?: string;
}

interface FilterPanelProps {
  filters: PlannerFilters;
  onChange: (f: PlannerFilters) => void;
  onClose: () => void;
}

const PRIORITIES: Array<{ value: PlannerFilters['priority']; label: string; cls: string }> = [
  { value: 'low', label: 'Low', cls: 'border-emerald-400 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' },
  { value: 'medium', label: 'Medium', cls: 'border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' },
  { value: 'high', label: 'High', cls: 'border-red-400 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20' },
];

const STATUSES: Array<{ value: PlannerFilters['status']; label: string; cls: string }> = [
  { value: 'pending', label: 'Pending', cls: 'border-gray-400 text-gray-600 dark:text-neutral-400 bg-gray-50 dark:bg-neutral-700/30' },
  { value: 'in_progress', label: 'In Progress', cls: 'border-blue-400 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' },
  { value: 'completed', label: 'Completed', cls: 'border-emerald-400 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' },
];

const DATE_PRESETS: Array<{ value: PlannerFilters['datePreset']; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'upcoming', label: 'Upcoming' },
];

export default function FilterPanel({ filters, onChange, onClose }: FilterPanelProps) {
  const toggle = <K extends keyof PlannerFilters>(key: K, val: PlannerFilters[K]) => {
    onChange({ ...filters, [key]: filters[key] === val ? undefined : val });
  };

  const handleReset = () => { onChange({}); onClose(); };

  return (
    <div className="absolute top-full right-0 mt-1 z-40 w-80 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl p-4 space-y-4">
      {/* Priority */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Priority</p>
        <div className="flex gap-2">
          {PRIORITIES.map(({ value, label, cls }) => (
            <button
              key={value}
              onClick={() => toggle('priority', value)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-all duration-150 ${
                filters.priority === value
                  ? cls
                  : 'border-gray-300 dark:border-neutral-600 text-gray-500 dark:text-neutral-400 hover:border-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Status</p>
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map(({ value, label, cls }) => (
            <button
              key={value}
              onClick={() => toggle('status', value)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-all duration-150 ${
                filters.status === value
                  ? cls
                  : 'border-gray-300 dark:border-neutral-600 text-gray-500 dark:text-neutral-400 hover:border-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Date presets */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Due Date</p>
        <div className="flex gap-1.5 flex-wrap">
          {DATE_PRESETS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => toggle('datePreset', value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-all duration-150 ${
                filters.datePreset === value
                  ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                  : 'border-gray-300 dark:border-neutral-600 text-gray-500 dark:text-neutral-400 hover:border-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-2">Custom Range</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-400 dark:text-neutral-500">From</label>
            <input
              type="date"
              value={filters.dueDateFrom || ''}
              onChange={(e) => onChange({ ...filters, dueDateFrom: e.target.value || undefined })}
              className="w-full mt-1 px-2 py-1 text-xs rounded border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-400 dark:text-neutral-500">To</label>
            <input
              type="date"
              value={filters.dueDateTo || ''}
              onChange={(e) => onChange({ ...filters, dueDateTo: e.target.value || undefined })}
              className="w-full mt-1 px-2 py-1 text-xs rounded border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-gray-200 dark:border-neutral-700">
        <button
          onClick={handleReset}
          className="flex-1 text-xs py-1.5 rounded border border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors duration-150"
        >
          Reset All
        </button>
        <button
          onClick={onClose}
          className="flex-1 text-xs py-1.5 rounded bg-red-600 text-white font-medium hover:bg-red-700 transition-colors duration-150"
        >
          Done
        </button>
      </div>
    </div>
  );
}
