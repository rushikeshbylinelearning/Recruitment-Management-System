/**
 * RecruiterMonitor — Admin-only page
 *
 * Changes from original:
 *  - Recruiter cards now also show: Pending Tasks, Completed Tasks,
 *    Today's Updates, Last Submission  (additive — existing KPIs unchanged)
 *  - Right sidebar "Recent Interactions" replaced with "Task Updates" panel
 *    containing date/task/status/search filters + scrollable update cards
 *    + View Details modal
 *  - All interaction KPIs (total_calls, interested, no_response, follow_ups)
 *    are kept exactly as they were
 */
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Phone, ChevronRight, BarChart2, ClipboardList,
  Calendar, Search, CheckCircle, Clock, AlertCircle,
  User, Loader2, FileText,
} from 'lucide-react';
import { interactionAPI, taskUpdatesAPI } from '../services/api';
import type { TaskUpdate, TaskUpdateUserStat } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecruiterStat {
  id: number;
  name: string;
  email: string;
  role: string;
  today_calls: number;
  today_interested: number;
  today_no_response: number;
  today_follow_ups: number;
  total_notes: number;
}

// Merged card data: interaction stats + task-update stats
interface EnrichedStat extends RecruiterStat {
  pending_tasks: number;
  completed_tasks: number;
  today_updates: number;
  last_submission: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function statusChip(status: string | null) {
  if (!status) return null;
  const map: Record<string, string> = {
    Completed:    'bg-emerald-50 text-emerald-600',
    'In Progress':'bg-blue-50 text-blue-600',
    Pending:      'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${map[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  );
}

// ─── Update Detail Modal ──────────────────────────────────────────────────────

function UpdateDetailModal({ update, onClose }: { update: TaskUpdate; onClose: () => void }) {
  // lock scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const section = (label: string, content: string | null) => content ? (
    <div>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  ) : null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-5 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <ClipboardList size={16} className="text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-base leading-snug">{update.taskTitle}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(update.createdAt)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0">
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        {/* Meta row */}
        <div className="px-6 py-4 border-b border-gray-50 grid grid-cols-2 gap-3 text-xs">
          {[
            { label: 'Task Status',   value: statusChip(update.taskStatus) || <span className="text-gray-400">—</span> },
            { label: 'Priority',      value: update.taskPriority || '—' },
            { label: 'Submitted By',  value: `${update.submittedByName} (${update.submittedByRole})` },
            { label: 'Assigned To',   value: update.assignedToName || '—' },
          ].map(m => (
            <div key={m.label}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{m.label}</p>
              <div className="text-gray-700 font-medium">{m.value}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {section('Work Summary', update.workSummary)}
          {section("Today's Progress", update.todayProgress)}
          {section('Blockers', update.blockers)}
          {section('Plan for Tomorrow', update.nextPlan)}
          {update.attachments?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Attachments</p>
              {update.attachments.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
                  <FileText size={12} /> {a.name}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Task Updates Panel (inside RecruiterDrawer) ──────────────────────────────

interface TaskUpdatesPanelProps {
  userId: number;
}

function TaskUpdatesPanel({ userId }: TaskUpdatesPanelProps) {
  const [updates, setUpdates]       = useState<TaskUpdate[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<TaskUpdate | null>(null);

  // Filters
  const [search, setSearch]         = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const load = useCallback(async (s = search, d = dateFilter) => {
    setLoading(true);
    try {
      const params: Record<string, any> = { userId, limit: 50, page: 1 };
      if (s.trim()) params.search = s.trim();
      if (d)        params.date   = d;
      const res = await taskUpdatesAPI.getUpdates(params);
      if (res.success && res.data) setUpdates(res.data.updates || []);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [userId, search, dateFilter]);

  useEffect(() => { load(); }, [userId]);

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-gray-700">Task Updates</h4>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        {/* Search */}
        <div className="relative">
          <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') load(search, dateFilter); }}
            placeholder="Search by task or summary…"
            className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
          />
        </div>
        {/* Date filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Calendar size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={e => { setDateFilter(e.target.value); load(search, e.target.value); }}
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
            />
          </div>
          {(search || dateFilter) && (
            <button
              onClick={() => { setSearch(''); setDateFilter(''); load('', ''); }}
              className="px-2.5 py-2 text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-indigo-500" />
        </div>
      ) : updates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center">
            <ClipboardList size={18} className="text-slate-300" />
          </div>
          <p className="text-xs text-slate-400">No work updates found</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {updates.map(u => (
            <div
              key={u.id}
              className="bg-gray-50 rounded-xl p-3 border border-gray-100 hover:border-indigo-200 transition-colors"
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-1 flex-1">{u.taskTitle}</p>
                {statusChip(u.taskStatus)}
              </div>
              {/* Summary */}
              <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed mb-2">{u.workSummary}</p>
              {/* Footer row */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">{timeAgo(u.createdAt)}</span>
                <button
                  onClick={() => setSelected(u)}
                  className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 transition-colors"
                >
                  View Details <ChevronRight size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && <UpdateDetailModal update={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ─── RecruiterDrawer ──────────────────────────────────────────────────────────

function RecruiterDrawer({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    interactionAPI.getRecruiterActivity(userId)
      .then(res => { if (res.success) setData(res.data); })
      .finally(() => setLoading(false));
  }, [userId]);

  // Lock scroll
  useEffect(() => {
    const w = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${w}px`;
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, []);

  // ESC
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 flex justify-end" style={{ zIndex: 9999 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 transition-opacity duration-300"
        style={{ zIndex: 9998, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      {/* Drawer panel */}
      <div
        className="relative bg-white w-full max-w-lg h-full shadow-2xl flex flex-col overflow-hidden"
        style={{
          zIndex: 9999,
          animation: 'slideInRight 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.12), -4px 0 16px rgba(0,0,0,0.08)',
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <User size={14} className="text-indigo-600" />
            </div>
            <h3 className="font-semibold text-gray-900">
              {loading ? 'Loading…' : data?.user?.name}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-indigo-600" />
          </div>
        ) : data ? (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

            {/* ── Today's KPI stats — UNCHANGED ──────────────────────────────── */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Today's Activity</h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Calls',  value: data.snapshots?.[0]?.total_calls  || 0, color: 'text-indigo-600' },
                  { label: 'Interested',   value: data.snapshots?.[0]?.interested   || 0, color: 'text-green-600' },
                  { label: 'No Response',  value: data.snapshots?.[0]?.no_response  || 0, color: 'text-gray-500' },
                  { label: 'Follow-ups',   value: data.snapshots?.[0]?.follow_ups   || 0, color: 'text-blue-600' },
                ].map(m => (
                  <div key={m.label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                    <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 14-day chart — UNCHANGED ────────────────────────────────────── */}
            {data.snapshots?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <BarChart2 size={14} /> Last 14 Days
                </h4>
                <div className="flex items-end gap-1 h-20">
                  {[...data.snapshots].reverse().slice(0, 14).map((s: any) => {
                    const max = Math.max(...data.snapshots.map((x: any) => x.total_calls), 1);
                    const h   = Math.round((s.total_calls / max) * 64);
                    return (
                      <div key={s.snap_date} className="flex-1 flex flex-col items-center gap-1"
                        title={`${s.snap_date}: ${s.total_calls} calls`}>
                        <div className="w-full bg-indigo-500 rounded-t" style={{ height: `${h}px`, minHeight: '2px' }} />
                        <span className="text-[9px] text-gray-400 rotate-45 origin-left">
                          {new Date(s.snap_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Task Updates panel — replaces Recent Interactions ───────────── */}
            <TaskUpdatesPanel userId={userId} />

          </div>
        ) : (
          <p className="text-center text-gray-400 py-16">Failed to load data</p>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
}

// ─── Recruiter Card ───────────────────────────────────────────────────────────

function RecruiterCard({
  r, taskStat, onClick,
}: {
  r: RecruiterStat;
  taskStat: TaskUpdateUserStat | null;
  onClick: () => void;
}) {
  return (
    <div
      className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onClick}
    >
      {/* Name / role */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{r.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{r.role} · {r.email}</p>
        </div>
        <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-500 transition-colors mt-1" />
      </div>

      {/* ── Interaction KPIs — UNCHANGED ─────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2 mt-4">
        {[
          { label: 'Calls',      value: r.today_calls,       color: 'text-indigo-600' },
          { label: 'Interested', value: r.today_interested,  color: 'text-green-600' },
          { label: 'No Resp.',   value: r.today_no_response, color: 'text-gray-500' },
          { label: 'Follow-up',  value: r.today_follow_ups,  color: 'text-blue-600' },
        ].map(m => (
          <div key={m.label} className="text-center">
            <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
            <p className="text-[10px] text-gray-400">{m.label}</p>
          </div>
        ))}
      </div>

      {/* ── NEW: Task + EOD metrics ──────────────────────────────────────────── */}
      {taskStat && (
        <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-50">
          {[
            { label: 'Pending',    value: taskStat.pending_tasks,    color: 'text-amber-500',  icon: AlertCircle },
            { label: 'Done',       value: taskStat.completed_tasks,  color: 'text-emerald-600',icon: CheckCircle },
            { label: "EOD Today",  value: taskStat.today_updates,    color: 'text-indigo-600', icon: ClipboardList },
            { label: 'Last EOD',   value: taskStat.last_submission ? timeAgo(taskStat.last_submission) : '—', color: 'text-gray-500', icon: Clock, raw: true },
          ].map(m => (
            <div key={m.label} className="text-center">
              {m.raw ? (
                <p className="text-[11px] font-semibold text-gray-500 leading-tight">{m.value as string}</p>
              ) : (
                <p className={`text-lg font-bold ${m.color}`}>{m.value as number}</p>
              )}
              <p className="text-[10px] text-gray-400">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Phone size={11} /> {r.total_notes} total notes
        </span>
        <span className="text-xs text-indigo-600 font-medium">View details →</span>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function RecruiterMonitor() {
  const { user } = useAuth();
  const [recruiters, setRecruiters]     = useState<RecruiterStat[]>([]);
  const [taskStats, setTaskStats]       = useState<TaskUpdateUserStat[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedId, setSelectedId]     = useState<number | null>(null);

  useEffect(() => {
    if (user?.role !== 'Admin') return;

    (async () => {
      setLoading(true);
      try {
        // Load both in parallel — task stats gracefully degrade if table not yet migrated
        const [interactionRes, taskRes] = await Promise.allSettled([
          interactionAPI.getAdminRecruiters(),
          taskUpdatesAPI.getUserStats(),
        ]);

        if (interactionRes.status === 'fulfilled' && interactionRes.value.success) {
          setRecruiters((interactionRes.value.data as any) || []);
        }
        if (taskRes.status === 'fulfilled' && taskRes.value.success) {
          setTaskStats((taskRes.value.data as any)?.users || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (user?.role !== 'Admin') return null;

  const getTaskStat = (userId: number) =>
    taskStats.find(s => s.id === userId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recruiter Activity Monitor</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Real-time view of recruiter interactions and daily performance
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {recruiters.map(r => (
            <RecruiterCard
              key={r.id}
              r={r}
              taskStat={getTaskStat(r.id)}
              onClick={() => setSelectedId(r.id)}
            />
          ))}
          {recruiters.length === 0 && (
            <div className="col-span-3 flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
              <User size={32} className="opacity-30" />
              <p className="text-sm">No recruiters or interns found</p>
            </div>
          )}
        </div>
      )}

      {selectedId && (
        <RecruiterDrawer userId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
