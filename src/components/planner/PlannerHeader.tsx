import { useState } from 'react';
import { LayoutGrid, Table2, Calendar, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SearchBar from './filters/SearchBar';
import FilterPanel, { PlannerFilters } from './filters/FilterPanel';
import FilterBar from './filters/FilterBar';
import AdminMonitorMode from './admin/AdminMonitorMode';

export type ViewMode = 'board' | 'grid' | 'calendar';

interface PlannerHeaderProps {
  planName: string;
  viewMode: ViewMode;
  onViewChange: (v: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filters: PlannerFilters;
  onFiltersChange: (f: PlannerFilters) => void;
  onViewingUserChange?: (userId: number | null) => void;
}

const VIEW_BUTTONS: Array<{ mode: ViewMode; icon: React.ElementType; label: string }> = [
  { mode: 'board', icon: LayoutGrid, label: 'Board view' },
  { mode: 'grid', icon: Table2, label: 'Grid view' },
  { mode: 'calendar', icon: Calendar, label: 'Calendar view' },
];

export default function PlannerHeader({
  planName,
  viewMode,
  onViewChange,
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  onViewingUserChange,
}: PlannerHeaderProps) {
  const { user } = useAuth();
  const [filterOpen, setFilterOpen] = useState(false);

  const activeFilterCount = Object.values(filters).filter((v) => v !== undefined).length;

  const handleRemoveFilter = (key: keyof PlannerFilters) => {
    const updated = { ...filters };
    delete updated[key];
    onFiltersChange(updated);
  };

  return (
    <div className="shrink-0">
      {/* Main header bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-700">
        {/* Left: Plan name */}
        <h2 className="text-lg font-semibold text-gray-800 dark:text-neutral-200 truncate min-w-0 flex-1">
          {planName}
        </h2>

        {/* Center: View toggles */}
        <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-neutral-800 rounded-lg p-0.5">
          {VIEW_BUTTONS.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => onViewChange(mode)}
              aria-label={label}
              aria-pressed={viewMode === mode}
              className={`p-1.5 rounded-md transition-all duration-150 ${
                viewMode === mode
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-gray-500 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-700'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Right: Search + Filter */}
        <div className="flex items-center gap-2">
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search tasks…"
          />

          {/* Filter button */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              aria-label="Toggle filters"
              aria-expanded={filterOpen}
              className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-all duration-150 ${
                filterOpen || activeFilterCount > 0
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                  : 'border border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Filters</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {filterOpen && (
              <FilterPanel
                filters={filters}
                onChange={onFiltersChange}
                onClose={() => setFilterOpen(false)}
              />
            )}
          </div>

          {/* Admin user-switcher */}
          {user?.role === 'Admin' && onViewingUserChange && (
            <AdminMonitorMode
              currentUserId={user.id as number}
              onViewingUserChange={onViewingUserChange}
            />
          )}
        </div>
      </div>

      {/* Active filter chips bar */}
      <FilterBar
        filters={filters}
        onRemove={handleRemoveFilter}
        onReset={() => onFiltersChange({})}
      />
    </div>
  );
}
