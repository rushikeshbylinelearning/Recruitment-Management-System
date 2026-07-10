/**
 * TaskInfoSection — Section 1 of the left panel
 *
 * Shows all core task fields with inline editing:
 *   Title, Description, Priority, Status, Start Date, Due Date,
 *   Estimated Time, Completion %, Progress Slider, Labels
 *
 * All saves go through plannerService.updateTask (existing PUT /api/planner/tasks/:id).
 * No schema changes required.
 */

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  Flag,
  Calendar,
  Clock,
  Tag,
  CheckCircle2,
  AlertTriangle,
  Plus,
  X,
} from 'lucide-react';
import { plannerService } from '../../../../services/plannerService';
import type { TaskDetail } from '../../../../services/plannerService';
import { ProgressBar } from '../../shared/ProgressBar';

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<
  string,
  { label: string; dotClass: string; badgeClass: string }
> = {
  low: {
    label: 'Low',
    dotClass: 'bg-emerald-500',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  },
  medium: {
    label: 'Medium',
    dotClass: 'bg-amber-500',
    badgeClass:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  },
  high: {
    label: 'High',
    dotClass: 'bg-orange-500',
    badgeClass:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800',
  },
  critical: {
    label: 'Critical',
    dotClass: 'bg-red-600',
    badgeClass:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
  },
};

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; dotClass: string; badgeClass: string }
> = {
  pending: {
    label: 'Pending',
    dotClass: 'bg-gray-400',
    badgeClass:
      'bg-gray-100 text-gray-600 border-gray-200 dark:bg-neutral-700 dark:text-neutral-400 dark:border-neutral-600',
  },
  in_progress: {
    label: 'In Progress',
    dotClass: 'bg-blue-500',
    badgeClass:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  },
  review: {
    label: 'Review',
    dotClass: 'bg-purple-500',
    badgeClass:
      'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
  },
  completed: {
    label: 'Completed',
    dotClass: 'bg-emerald-500',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  },
  rejected: {
    label: 'Rejected',
    dotClass: 'bg-red-500',
    badgeClass:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
  },
};

// ─── Styled field label ───────────────────────────────────────────────────────

function FieldLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-gray-400 dark:text-neutral-500">{icon}</span>
      <span className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
        {text}
      </span>
    </div>
  );
}

// ─── Floating-label input ─────────────────────────────────────────────────────

const inputBase =
  'w-full text-sm px-3 py-2.5 rounded-xl border bg-white dark:bg-neutral-800 text-gray-800 dark:text-neutral-200 ' +
  'placeholder-gray-400 dark:placeholder-neutral-500 transition-all duration-150 ' +
  'focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-400 dark:focus:border-red-500 ' +
  'border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskInfoSectionProps {
  task: TaskDetail;
  onUpdated: (updates?: Record<string, unknown>) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default memo(function TaskInfoSection({ task, onUpdated }: TaskInfoSectionProps) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [localTitle, setLocalTitle] = useState(task.title ?? '');
  const [localDesc, setLocalDesc] = useState((task.description as string) ?? '');
  const [completion, setCompletion] = useState((task.completion_percentage as number) ?? 0);
  const [isDragging, setIsDragging] = useState(false);
  const descTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local state in sync when task prop changes (e.g. after optimistic update)
  useEffect(() => {
    setLocalTitle(task.title ?? '');
    setLocalDesc((task.description as string) ?? '');
    if (!isDragging) setCompletion((task.completion_percentage as number) ?? 0);
  }, [task.title, task.description, task.completion_percentage, isDragging]);

  const save = useCallback(
    async (field: string, value: unknown) => {
      setSaving(true);
      setSaveError(null);
      try {
        await plannerService.updateTask(task.id, { [field]: value });
        onUpdated({ [field]: value });
      } catch {
        setSaveError('Failed to save. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [task.id, onUpdated]
  );

  // Debounced description save
  const handleDescChange = (val: string) => {
    setLocalDesc(val);
    if (descTimerRef.current) clearTimeout(descTimerRef.current);
    descTimerRef.current = setTimeout(() => {
      save('description', val);
    }, 1200);
  };

  useEffect(() => {
    return () => {
      if (descTimerRef.current) clearTimeout(descTimerRef.current);
    };
  }, []);

  // ── Completion slider ──────────────────────────────────────────────────

  const completionColor =
    completion < 34
      ? 'accent-red-500'
      : completion < 67
      ? 'accent-amber-500'
      : 'accent-emerald-500';

  const completionBadgeClass =
    completion === 100
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
      : completion >= 67
      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
      : 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-neutral-400';

  // ── Labels management ──────────────────────────────────────────────────

  const [availableLabels, setAvailableLabels] = useState<
    Array<{ id: number; name: string; colour: string }>
  >([]);
  const [taskLabels, setTaskLabels] = useState<
    Array<{ id: number; name: string; colour: string }>
  >(task.labels ?? []);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const labelPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTaskLabels(task.labels ?? []);
  }, [task.labels]);

  const loadLabels = useCallback(async () => {
    if (availableLabels.length === 0) {
      const all = await plannerService.getLabels();
      setAvailableLabels(all);
    }
    setShowLabelPicker(true);
  }, [availableLabels.length]);

  // Close label picker on outside click
  useEffect(() => {
    if (!showLabelPicker) return;
    const handler = (e: MouseEvent) => {
      if (labelPickerRef.current && !labelPickerRef.current.contains(e.target as Node)) {
        setShowLabelPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLabelPicker]);

  const toggleLabel = async (label: { id: number; name: string; colour: string }) => {
    const has = taskLabels.some((l) => l.id === label.id);
    if (has) {
      setTaskLabels((prev) => prev.filter((l) => l.id !== label.id));
      await plannerService.removeLabel(task.id, label.id);
    } else {
      setTaskLabels((prev) => [...prev, label]);
      await plannerService.applyLabel(task.id, label.id);
    }
    onUpdated();
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Save indicator */}
      {(saving || saveError) && (
        <div
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ${
            saveError
              ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
              : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 animate-pulse'
          }`}
        >
          {saveError ? (
            <>
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {saveError}
            </>
          ) : (
            <>
              <span className="w-3 h-3 shrink-0 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              Saving…
            </>
          )}
        </div>
      )}

      {/* Title */}
      <div>
        <FieldLabel icon={<span className="w-3.5 h-3.5 text-xs font-bold">T</span>} text="Title" />
        <input
          type="text"
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={() => {
            if (localTitle.trim() !== task.title && localTitle.trim()) {
              save('title', localTitle.trim());
            }
          }}
          maxLength={255}
          placeholder="Task title…"
          className={inputBase}
          aria-label="Task title"
        />
      </div>

      {/* Description */}
      <div>
        <FieldLabel icon={<AlignLeftIcon />} text="Description" />
        <textarea
          value={localDesc}
          onChange={(e) => handleDescChange(e.target.value)}
          rows={4}
          placeholder="Add a description…"
          className={`${inputBase} resize-none font-normal leading-relaxed`}
          aria-label="Task description"
        />
      </div>

      {/* Priority + Status */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel icon={<Flag className="w-3.5 h-3.5" />} text="Priority" />
          <div className="relative">
            <select
              value={(task.priority as string) ?? ''}
              onChange={(e) => save('priority', e.target.value || null)}
              className={`${inputBase} pr-8 appearance-none cursor-pointer`}
              aria-label="Task priority"
            >
              <option value="">None</option>
              {Object.entries(PRIORITY_CONFIG).map(([value, cfg]) => (
                <option key={value} value={value}>
                  {cfg.label}
                </option>
              ))}
            </select>
            {task.priority && PRIORITY_CONFIG[task.priority as string] && (
              <span
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${
                  PRIORITY_CONFIG[task.priority as string].dotClass
                }`}
              />
            )}
          </div>
          {/* Priority pill */}
          {task.priority && PRIORITY_CONFIG[task.priority as string] && (
            <span
              className={`inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full border ${
                PRIORITY_CONFIG[task.priority as string].badgeClass
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  PRIORITY_CONFIG[task.priority as string].dotClass
                }`}
              />
              {PRIORITY_CONFIG[task.priority as string].label}
            </span>
          )}
        </div>

        <div>
          <FieldLabel icon={<CheckCircle2 className="w-3.5 h-3.5" />} text="Status" />
          <div className="relative">
            <select
              value={task.status as string}
              onChange={(e) => save('status', e.target.value)}
              className={`${inputBase} pr-8 appearance-none cursor-pointer`}
              aria-label="Task status"
            >
              {Object.entries(STATUS_CONFIG).map(([value, cfg]) => (
                <option key={value} value={value}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>
          {/* Status pill */}
          {task.status && STATUS_CONFIG[task.status as string] && (
            <span
              className={`inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full border ${
                STATUS_CONFIG[task.status as string].badgeClass
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  STATUS_CONFIG[task.status as string].dotClass
                }`}
              />
              {STATUS_CONFIG[task.status as string].label}
            </span>
          )}
        </div>
      </div>

      {/* Due date + Estimated time */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel icon={<Calendar className="w-3.5 h-3.5" />} text="Due Date" />
          <input
            type="date"
            defaultValue={(task.due_date as string) ?? ''}
            onBlur={(e) => save('due_date', e.target.value || null)}
            className={inputBase}
            aria-label="Due date"
          />
        </div>
        <div>
          <FieldLabel icon={<Clock className="w-3.5 h-3.5" />} text="Estimated Time" />
          <input
            type="text"
            defaultValue={(task.estimated_time as string) ?? ''}
            onBlur={(e) => save('estimated_time', e.target.value || null)}
            placeholder="e.g. 2h 30m"
            className={inputBase}
            aria-label="Estimated time"
          />
        </div>
      </div>

      {/* Completion */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel icon={<CheckCircle2 className="w-3.5 h-3.5" />} text="Progress" />
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums ${completionBadgeClass}`}
          >
            {completion}%
            {completion === 100 && ' ✓'}
          </span>
        </div>
        <ProgressBar value={completion} size="md" className="mb-2" />
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={completion}
          onChange={(e) => setCompletion(parseInt(e.target.value, 10))}
          onPointerDown={() => setIsDragging(true)}
          onPointerUp={(e) => {
            setIsDragging(false);
            const val = parseInt((e.target as HTMLInputElement).value, 10);
            if (val !== task.completion_percentage) {
              save('completion_percentage', val);
            }
          }}
          className={`w-full h-1.5 rounded-full cursor-pointer ${completionColor}`}
          aria-label={`Completion: ${completion}%`}
          aria-valuenow={completion}
          aria-valuemin={0}
          aria-valuemax={100}
        />
        <div className="flex justify-between text-xs text-gray-400 dark:text-neutral-500 mt-1">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Labels */}
      <div>
        <FieldLabel icon={<Tag className="w-3.5 h-3.5" />} text="Labels" />
        <div className="flex flex-wrap gap-1.5 mb-2">
          {taskLabels.map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: label.colour }}
            >
              {label.name}
              <button
                onClick={() => toggleLabel(label)}
                className="ml-0.5 hover:bg-white/20 rounded-full p-0.5 transition-colors"
                aria-label={`Remove ${label.name}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}

          {/* Add label button */}
          <div className="relative" ref={labelPickerRef}>
            <button
              onClick={loadLabels}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-dashed border-gray-300 dark:border-neutral-600 text-gray-500 dark:text-neutral-400 hover:border-red-400 hover:text-red-600 dark:hover:text-red-400 transition-all duration-150"
              aria-label="Add label"
              aria-expanded={showLabelPicker}
            >
              <Plus className="w-3 h-3" />
              Add label
            </button>

            {showLabelPicker && (
              <div className="absolute left-0 top-full mt-1.5 w-52 bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 shadow-lg z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-2 max-h-48 overflow-y-auto">
                  {availableLabels.length === 0 ? (
                    <p className="text-xs text-gray-400 p-2 text-center">No labels available</p>
                  ) : (
                    availableLabels.map((label) => {
                      const active = taskLabels.some((l) => l.id === label.id);
                      return (
                        <button
                          key={label.id}
                          onClick={() => toggleLabel(label)}
                          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors duration-100 ${
                            active
                              ? 'bg-gray-50 dark:bg-neutral-700'
                              : 'hover:bg-gray-50 dark:hover:bg-neutral-700/50'
                          }`}
                        >
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: label.colour }}
                          />
                          <span className="flex-1 text-left text-gray-700 dark:text-neutral-300">
                            {label.name}
                          </span>
                          {active && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// Tiny inline icon to avoid importing AlignLeft name collision
function AlignLeftIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="15" y1="12" x2="3" y2="12" />
      <line x1="17" y1="18" x2="3" y2="18" />
    </svg>
  );
}
