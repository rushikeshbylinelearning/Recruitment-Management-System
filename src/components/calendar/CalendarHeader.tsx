import { memo, useState, useRef, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Search, SlidersHorizontal,
  LayoutGrid, Columns3, Square, List,
} from 'lucide-react';
import type { CalendarViewMode } from './constants';
import type { CalendarFilters } from '../../services/calendarService';

interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  onViewChange: (mode: CalendarViewMode) => void;
  onNavigate: (dir: 'prev' | 'next' | 'today') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filters: CalendarFilters;
  onFiltersChange: (f: CalendarFilters) => void;
  onNewEvent: () => void;
  onNewNote: () => void;
  onNewTask: () => void;
  showFilters: boolean;
  onToggleFilters: () => void;
}

const VIEW_OPTIONS: { mode: CalendarViewMode; label: string; icon: React.ElementType }[] = [
  { mode: 'month', label: 'Month', icon: LayoutGrid },
  { mode: 'week', label: 'Week', icon: Columns3 },
  { mode: 'day', label: 'Day', icon: Square },
  { mode: 'agenda', label: 'Agenda', icon: List },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatTitle(date: Date, viewMode: CalendarViewMode): string {
  if (viewMode === 'day') {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  if (viewMode === 'week') {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    if (start.getMonth() === end.getMonth()) {
      return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${MONTH_NAMES[start.getMonth()]} ${start.getDate()} – ${MONTH_NAMES[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function CalendarHeaderInner({
  currentDate,
  viewMode,
  onViewChange,
  onNavigate,
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  onNewEvent,
  onNewNote,
  onNewTask,
  showFilters,
  onToggleFilters,
}: CalendarHeaderProps) {
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!newMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setNewMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [newMenuOpen]);

  const handleNew = (fn: () => void) => {
    setNewMenuOpen(false);
    fn();
  };

  const activeFilterCount = [
    filters.types,
    filters.highPriority,
    filters.showCompleted === false,
  ].filter(Boolean).length;

  return (
    <header className="shrink-0 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
        {/* Today button */}
        <button
          onClick={() => onNavigate('today')}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors duration-100 text-gray-700 dark:text-neutral-300"
        >
          Today
        </button>

        {/* Prev / Next */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onNavigate('prev')}
            aria-label="Previous"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors duration-100 text-gray-500 dark:text-neutral-400"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => onNavigate('next')}
            aria-label="Next"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors duration-100 text-gray-500 dark:text-neutral-400"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Current period label */}
        <h1 className="text-base font-semibold text-gray-900 dark:text-white min-w-0 mr-auto">
          {formatTitle(currentDate, viewMode)}
        </h1>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white placeholder-gray-400 w-44 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>

        {/* Filters toggle */}
        <button
          onClick={onToggleFilters}
          aria-label="Filters"
          className={`relative p-1.5 rounded-lg border transition-colors duration-100 ${
            showFilters || activeFilterCount > 0
              ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
              : 'border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-400'
          }`}
        >
          <SlidersHorizontal size={16} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* View switcher */}
        <div className="flex rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
          {VIEW_OPTIONS.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => onViewChange(mode)}
              title={label}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors duration-100 ${
                viewMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-600 dark:text-neutral-300'
              }`}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* New button with click dropdown */}
        <div className="relative" ref={newMenuRef}>
          <button
            onClick={() => setNewMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition-colors duration-100 shadow-sm"
          >
            <Plus size={15} />
            New
          </button>
          {newMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-gray-150 dark:border-neutral-700 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
              <button
                onClick={() => handleNew(onNewEvent)}
                className="w-full text-left px-3.5 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-200 flex items-center gap-2.5 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Create Event
              </button>
              <button
                onClick={() => handleNew(onNewNote)}
                className="w-full text-left px-3.5 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-200 flex items-center gap-2.5 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                Quick Note
              </button>
              <button
                onClick={() => handleNew(onNewTask)}
                className="w-full text-left px-3.5 py-2 text-sm hover:bg-gray-50 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-200 flex items-center gap-2.5 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Planner Task
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter row */}
      {showFilters && (
        <div className="px-4 pb-2.5 pt-1.5 flex flex-wrap gap-2 items-center border-t border-gray-100 dark:border-neutral-800">
          <span className="text-xs font-medium text-gray-500 dark:text-neutral-400 mr-1">Show:</span>
          {[
            { key: 'planner_task', label: 'Tasks', color: 'bg-blue-500' },
            { key: 'note', label: 'Notes', color: 'bg-purple-500' },
            { key: 'meeting', label: 'Meetings', color: 'bg-green-500' },
            { key: 'reminder', label: 'Reminders', color: 'bg-orange-500' },
            { key: 'deadline', label: 'Deadlines', color: 'bg-red-500' },
          ].map(({ key, label, color }) => {
            const active = !filters.types || filters.types.split(',').includes(key);
            return (
              <button
                key={key}
                onClick={() => {
                  const current = filters.types?.split(',').filter(Boolean) ?? [];
                  const next = current.includes(key)
                    ? current.filter((t) => t !== key)
                    : [...current, key];
                  onFiltersChange({ ...filters, types: next.length ? next.join(',') : undefined });
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-colors duration-100 ${
                  active
                    ? 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 shadow-sm'
                    : 'border-gray-200 dark:border-neutral-700 text-gray-400 opacity-50'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
                {label}
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-neutral-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filters.showCompleted !== false}
                onChange={(e) => onFiltersChange({ ...filters, showCompleted: e.target.checked || undefined })}
                className="rounded text-blue-600"
              />
              Show completed
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-neutral-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!filters.highPriority}
                onChange={(e) => onFiltersChange({ ...filters, highPriority: e.target.checked || undefined })}
                className="rounded text-blue-600"
              />
              High priority only
            </label>
          </div>
        </div>
      )}
    </header>
  );
}

export default memo(CalendarHeaderInner);
