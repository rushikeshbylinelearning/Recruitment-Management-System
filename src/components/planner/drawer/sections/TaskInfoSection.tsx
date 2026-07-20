/**
 * TaskInfoSection — compact task fields for the detail modal.
 * Daily repeat, due time, and stopwatch are first-class but kept light.
 */

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  Tag,
  CheckCircle2,
  AlertTriangle,
  X,
  Repeat,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';
import { plannerService } from '../../../../services/plannerService';
import type { TaskDetail } from '../../../../services/plannerService';

function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function toTimeInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const str = String(value);
  return str.length >= 5 ? str.slice(0, 5) : str;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Done' },
] as const;

const PRIORITY_OPTIONS = [
  { value: '', label: 'No priority' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;

const input =
  'w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 ' +
  'bg-white dark:bg-neutral-800 text-gray-800 dark:text-neutral-200 ' +
  'placeholder-gray-400 dark:placeholder-neutral-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-400';

const labelCls = 'block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1';

interface TaskInfoSectionProps {
  task: TaskDetail;
  onUpdated: (updates?: Record<string, unknown>) => void;
}

export default memo(function TaskInfoSection({ task, onUpdated }: TaskInfoSectionProps) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [localTitle, setLocalTitle] = useState(task.title ?? '');
  const [localDesc, setLocalDesc] = useState((task.description as string) ?? '');
  const [completion, setCompletion] = useState((task.completion_percentage as number) ?? 0);
  const [isDragging, setIsDragging] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const descTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(task.timer_elapsed_seconds ?? 0);
  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(task.timer_started_at ?? null);
  const [timerBusy, setTimerBusy] = useState(false);
  const [displaySeconds, setDisplaySeconds] = useState(task.timer_elapsed_seconds ?? 0);

  const isDaily = (task.recurrence_type ?? 'none') === 'daily';

  useEffect(() => {
    setLocalTitle(task.title ?? '');
    setLocalDesc((task.description as string) ?? '');
    if (!isDragging) setCompletion((task.completion_percentage as number) ?? 0);
    setTimerElapsed(task.timer_elapsed_seconds ?? 0);
    setTimerStartedAt(task.timer_started_at ?? null);
  }, [
    task.title,
    task.description,
    task.completion_percentage,
    task.timer_elapsed_seconds,
    task.timer_started_at,
    isDragging,
  ]);

  useEffect(() => {
    const tick = () => {
      if (!timerStartedAt) {
        setDisplaySeconds(timerElapsed);
        return;
      }
      const started = new Date(timerStartedAt).getTime();
      const extra = Number.isNaN(started) ? 0 : Math.floor((Date.now() - started) / 1000);
      setDisplaySeconds(timerElapsed + Math.max(0, extra));
    };
    tick();
    if (!timerStartedAt) return undefined;
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [timerStartedAt, timerElapsed]);

  const save = useCallback(
    async (field: string, value: unknown) => {
      setSaving(true);
      setSaveError(null);
      try {
        await plannerService.updateTask(task.id, { [field]: value });
        onUpdated({ [field]: value });
      } catch {
        setSaveError('Could not save. Try again.');
      } finally {
        setSaving(false);
      }
    },
    [task.id, onUpdated]
  );

  const applyTimerState = (state: {
    timer_elapsed_seconds: number;
    timer_started_at: string | null;
  }) => {
    setTimerElapsed(state.timer_elapsed_seconds);
    setTimerStartedAt(state.timer_started_at);
    onUpdated({
      timer_elapsed_seconds: state.timer_elapsed_seconds,
      timer_started_at: state.timer_started_at,
    });
  };

  const handleDescChange = (val: string) => {
    setLocalDesc(val);
    if (descTimerRef.current) clearTimeout(descTimerRef.current);
    descTimerRef.current = setTimeout(() => save('description', val), 1200);
  };

  useEffect(() => () => {
    if (descTimerRef.current) clearTimeout(descTimerRef.current);
  }, []);

  // Labels
  const [availableLabels, setAvailableLabels] = useState<
    Array<{ id: number; name: string; colour: string }>
  >([]);
  const [taskLabels, setTaskLabels] = useState(task.labels ?? []);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const labelPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTaskLabels(task.labels ?? []);
  }, [task.labels]);

  const loadLabels = useCallback(async () => {
    if (availableLabels.length === 0) {
      setAvailableLabels(await plannerService.getLabels());
    }
    setShowLabelPicker(true);
  }, [availableLabels.length]);

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

  return (
    <div className="space-y-4">
      {(saving || saveError) && (
        <div
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg ${
            saveError
              ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
              : 'text-gray-500 dark:text-neutral-400'
          }`}
        >
          {saveError ? (
            <>
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {saveError}
            </>
          ) : (
            'Saving…'
          )}
        </div>
      )}

      {/* Title + description — no heavy field chrome */}
      <div className="space-y-2">
        <input
          type="text"
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={() => {
            if (localTitle.trim() && localTitle.trim() !== task.title) {
              save('title', localTitle.trim());
            }
          }}
          maxLength={255}
          placeholder="Task title"
          className={`${input} text-base font-medium`}
          aria-label="Task title"
        />
        <textarea
          value={localDesc}
          onChange={(e) => handleDescChange(e.target.value)}
          rows={2}
          placeholder="Add a note…"
          className={`${input} resize-none`}
          aria-label="Description"
        />
      </div>

      {/* Status + Priority — selects only, no duplicate pills */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Status</label>
          <select
            value={task.status as string}
            onChange={(e) => save('status', e.target.value)}
            className={input}
            aria-label="Status"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Priority</label>
          <select
            value={(task.priority as string) ?? ''}
            onChange={(e) => save('priority', e.target.value || null)}
            className={input}
            aria-label="Priority"
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value || 'none'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Due — date + time together */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Due date</label>
          <input
            type="date"
            defaultValue={(task.due_date as string) ?? ''}
            onBlur={(e) => save('due_date', e.target.value || null)}
            className={input}
            aria-label="Due date"
          />
        </div>
        <div>
          <label className={labelCls}>Due time</label>
          <input
            type="time"
            defaultValue={toTimeInputValue(task.due_time)}
            onBlur={(e) => save('due_time', e.target.value || null)}
            className={input}
            aria-label="Due time"
          />
        </div>
      </div>

      {/* Daily + Timer — one compact strip */}
      <div className="flex flex-wrap items-center gap-2 py-1">
        <button
          type="button"
          role="switch"
          aria-checked={isDaily}
          aria-label="Repeats daily"
          onClick={() => save('recurrence_type', isDaily ? 'none' : 'daily')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            isDaily
              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700'
          }`}
        >
          <Repeat className="w-3.5 h-3.5" />
          Daily
        </button>

        <div className="inline-flex items-center gap-1.5 ml-auto">
          <span
            className={`text-sm font-semibold tabular-nums min-w-[3.25rem] text-right ${
              timerStartedAt ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-neutral-200'
            }`}
          >
            {formatElapsed(displaySeconds)}
          </span>
          {timerStartedAt ? (
            <button
              type="button"
              disabled={timerBusy}
              onClick={async () => {
                setTimerBusy(true);
                try {
                  applyTimerState(await plannerService.pauseTimer(task.id));
                } catch {
                  setSaveError('Could not pause timer.');
                } finally {
                  setTimerBusy(false);
                }
              }}
              className="p-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
              aria-label="Pause timer"
              title="Pause"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={timerBusy || task.status === 'completed'}
              onClick={async () => {
                setTimerBusy(true);
                try {
                  applyTimerState(await plannerService.startTimer(task.id));
                } catch {
                  setSaveError('Could not start timer.');
                } finally {
                  setTimerBusy(false);
                }
              }}
              className="p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50"
              aria-label="Start timer"
              title="Start"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            disabled={timerBusy || (displaySeconds === 0 && !timerStartedAt)}
            onClick={async () => {
              setTimerBusy(true);
              try {
                applyTimerState(await plannerService.resetTimer(task.id));
              } catch {
                setSaveError('Could not reset timer.');
              } finally {
                setTimerBusy(false);
              }
            }}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 disabled:opacity-50"
            aria-label="Reset timer"
            title="Reset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Labels — compact chips */}
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          {taskLabels.map((lbl) => (
            <span
              key={lbl.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: lbl.colour }}
            >
              {lbl.name}
              <button
                type="button"
                onClick={() => toggleLabel(lbl)}
                className="hover:bg-white/20 rounded-full p-0.5"
                aria-label={`Remove ${lbl.name}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          <div className="relative" ref={labelPickerRef}>
            <button
              type="button"
              onClick={loadLabels}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-dashed border-gray-300 dark:border-neutral-600 text-gray-500 hover:border-red-400 hover:text-red-600"
              aria-label="Add label"
            >
              <Tag className="w-3 h-3" />
              Label
            </button>
            {showLabelPicker && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 shadow-lg z-20 overflow-hidden">
                <div className="p-1.5 max-h-40 overflow-y-auto">
                  {availableLabels.length === 0 ? (
                    <p className="text-xs text-gray-400 p-2 text-center">No labels</p>
                  ) : (
                    availableLabels.map((lbl) => {
                      const active = taskLabels.some((l) => l.id === lbl.id);
                      return (
                        <button
                          key={lbl.id}
                          type="button"
                          onClick={() => toggleLabel(lbl)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm ${
                            active
                              ? 'bg-gray-50 dark:bg-neutral-700'
                              : 'hover:bg-gray-50 dark:hover:bg-neutral-700/50'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: lbl.colour }}
                          />
                          <span className="flex-1 text-left text-gray-700 dark:text-neutral-300">
                            {lbl.name}
                          </span>
                          {active && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
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

      {/* Optional extras — collapsed by default */}
      <div>
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="text-xs font-medium text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200"
        >
          {showMore ? 'Hide extra' : 'More options'}
        </button>
        {showMore && (
          <div className="mt-3 space-y-3">
            <div>
              <label className={labelCls}>Estimated time</label>
              <input
                type="text"
                defaultValue={(task.estimated_time as string) ?? ''}
                onBlur={(e) => save('estimated_time', e.target.value || null)}
                placeholder="e.g. 30m"
                className={input}
                aria-label="Estimated time"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + ' mb-0'}>Progress</label>
                <span className="text-xs tabular-nums text-gray-500">{completion}%</span>
              </div>
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
                className="w-full h-1.5 accent-red-500 cursor-pointer"
                aria-label={`Progress ${completion}%`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
