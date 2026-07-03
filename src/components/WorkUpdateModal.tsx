/**
 * WorkUpdateModal — EOD / Daily Work Update submission
 * Shown via FAB on the Tasks page for Recruiter and HR Intern roles.
 * Renders a portal-based modal with task dropdown + 4 text areas.
 */
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, ClipboardList, ChevronDown, CheckCircle, AlertCircle, Loader2,
  FileText, Zap, Shield, ArrowRight,
} from 'lucide-react';
import { tasksAPI, taskUpdatesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { Task } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkUpdateModalProps {
  onClose: () => void;
  /** Pre-select a task when opened from a task card */
  preselectedTaskId?: number | null;
}

interface FormState {
  taskId: number | '';
  workSummary: string;
  todayProgress: string;
  blockers: string;
  nextPlan: string;
}

interface FormErrors {
  taskId?: string;
  workSummary?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_SUMMARY_CHARS = 10;

const EMPTY_FORM: FormState = {
  taskId: '',
  workSummary: '',
  todayProgress: '',
  blockers: '',
  nextPlan: '',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ label, required, hint }: { label: string; required?: boolean; hint?: string }) {
  return (
    <div className="flex items-baseline gap-1 mb-1.5">
      <label className="text-xs font-semibold text-gray-700 tracking-wide">{label}</label>
      {required && <span className="text-red-500 text-xs">*</span>}
      {hint && <span className="text-[10px] text-gray-400 ml-auto">{hint}</span>}
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
      <AlertCircle size={10} /> {msg}
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WorkUpdateModal({ onClose, preselectedTaskId }: WorkUpdateModalProps) {
  const { user } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const [form, setForm] = useState<FormState>({
    ...EMPTY_FORM,
    taskId: preselectedTaskId ?? '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Lock body scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ── ESC to close ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Load tasks assigned to this user ────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await tasksAPI.getTasks({ page: 1, limit: 100 });
      if (res.success && res.data) {
        // Show only tasks that are not yet Completed — user can still submit for Completed ones
        setTasks(res.data.tasks || []);
      }
    } catch {
      // non-fatal
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // ── Form helpers ─────────────────────────────────────────────────────────────
  function set(key: keyof FormState, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
    setSubmitError('');
  }

  function validate(): boolean {
    const e: FormErrors = {};
    if (form.workSummary.trim().length < MIN_SUMMARY_CHARS)
      e.workSummary = `Summary must be at least ${MIN_SUMMARY_CHARS} characters`;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await taskUpdatesAPI.createUpdate({
        ...(form.taskId ? { taskId: Number(form.taskId) } : {}),
        workSummary: form.workSummary.trim(),
        todayProgress: form.todayProgress.trim() || undefined,
        blockers: form.blockers.trim() || undefined,
        nextPlan: form.nextPlan.trim() || undefined,
      });
      if (res.success) {
        setSubmitted(true);
        setTimeout(onClose, 2000);
      } else {
        setSubmitError((res as any).message || 'Submission failed. Please try again.');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.[0]?.message ||
        'Submission failed. Please try again.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Selected task label ──────────────────────────────────────────────────────
  const selectedTask = tasks.find(t => t.id === Number(form.taskId));

  // ── Summary char count colour ────────────────────────────────────────────────
  const summaryLen = form.workSummary.trim().length;
  const summaryOk = summaryLen >= MIN_SUMMARY_CHARS;

  // ─── Input base styles (match existing design system) ────────────────────────
  const inputBase =
    'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-gray-800 ' +
    'placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent ' +
    'transition-all resize-none';
  const inputErr = 'border-red-300 bg-red-50 focus:ring-red-400';

  // ─── Modal content ────────────────────────────────────────────────────────────
  const modal = (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999] p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Submit Work Update"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto flex flex-col"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <ClipboardList size={17} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900">Submit Work Update</h2>
            <p className="text-xs text-gray-400 mt-0.5">EOD report — task is optional</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* ── Success state ──────────────────────────────────────────────────── */}
        {submitted ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Update Submitted!</h3>
              <p className="text-sm text-gray-500 mt-1">Your work update has been recorded successfully.</p>
            </div>
          </div>
        ) : (
          /* ── Form ──────────────────────────────────────────────────────────── */
          <div className="px-6 py-5 space-y-5">

            {/* Submit error */}
            {submitError && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* ── Task selector ───────────────────────────────────────────────── */}
            <div>
              <FieldLabel label="Task" hint="Optional — your assigned tasks" />
              <div className="relative">
                {tasksLoading ? (
                  <div className={`${inputBase} flex items-center gap-2 text-gray-400`}>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Loading tasks…</span>
                  </div>
                ) : (
                  <>
                    <select
                      value={form.taskId}
                      onChange={e => set('taskId', e.target.value ? Number(e.target.value) : '')}
                      className={`${inputBase} appearance-none pr-9 ${errors.taskId ? inputErr : ''}`}
                    >
                      <option value="">— Select a task —</option>
                      {tasks.map(t => (
                        <option key={t.id} value={t.id}>
                          [{t.status}] {t.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                  </>
                )}
              </div>
              <FieldError msg={errors.taskId} />

              {/* Task badge when selected */}
              {selectedTask && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    selectedTask.status === 'Completed'   ? 'bg-emerald-50 text-emerald-600' :
                    selectedTask.status === 'In Progress' ? 'bg-blue-50 text-blue-600' :
                                                            'bg-slate-100 text-slate-500'
                  }`}>{selectedTask.status}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    selectedTask.priority === 'High'   ? 'bg-red-50 text-red-600' :
                    selectedTask.priority === 'Medium' ? 'bg-amber-50 text-amber-600' :
                                                         'bg-emerald-50 text-emerald-600'
                  }`}>{selectedTask.priority}</span>
                  <span className="text-[10px] text-gray-400">
                    Due: {new Date(selectedTask.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>

            {/* ── Work Summary ────────────────────────────────────────────────── */}
            <div>
              <FieldLabel
                label="Work Summary"
                required
                hint={`${summaryLen}/${MIN_SUMMARY_CHARS} min`}
              />
              <textarea
                rows={3}
                value={form.workSummary}
                onChange={e => set('workSummary', e.target.value)}
                placeholder="Overall summary of work done today…"
                className={`${inputBase} ${errors.workSummary ? inputErr : ''}`}
              />
              {!errors.workSummary && summaryLen > 0 && !summaryOk && (
                <p className="mt-1 text-[11px] text-amber-500">
                  {MIN_SUMMARY_CHARS - summaryLen} more character{MIN_SUMMARY_CHARS - summaryLen !== 1 ? 's' : ''} needed
                </p>
              )}
              <FieldError msg={errors.workSummary} />
            </div>

            {/* ── Today's Progress ─────────────────────────────────────────────── */}
            <div>
              <FieldLabel label="Today's Progress" hint="Optional" />
              <textarea
                rows={2}
                value={form.todayProgress}
                onChange={e => set('todayProgress', e.target.value)}
                placeholder="What specific progress was made today…"
                className={inputBase}
              />
            </div>

            {/* ── Blockers ─────────────────────────────────────────────────────── */}
            <div>
              <FieldLabel label="Blockers" hint="Optional" />
              <textarea
                rows={2}
                value={form.blockers}
                onChange={e => set('blockers', e.target.value)}
                placeholder="Any blockers or issues encountered…"
                className={inputBase}
              />
            </div>

            {/* ── Next Plan ────────────────────────────────────────────────────── */}
            <div>
              <FieldLabel label="Plan for Tomorrow" hint="Optional" />
              <textarea
                rows={2}
                value={form.nextPlan}
                onChange={e => set('nextPlan', e.target.value)}
                placeholder="What will you work on tomorrow…"
                className={inputBase}
              />
            </div>

            {/* ── Attachments placeholder ─────────────────────────────────────── */}
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3 flex items-center gap-2.5 text-slate-400">
              <FileText size={14} className="flex-shrink-0" />
              <span className="text-xs">Attachments — coming soon</span>
            </div>

            {/* ── Footer actions ────────────────────────────────────────────────── */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || tasksLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <ArrowRight size={14} />
                    Submit Update
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
