import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Calendar,
  Clock,
  User,
  Download,
  Eye,
  Edit2,
  CalendarClock,
  X,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';
import { Interview } from '../types/interview';
import InterviewModal from './InterviewModal';

// ─── helpers ─────────────────────────────────────────────────────────────────

function getToken(): string {
  return localStorage.getItem('authToken') || '';
}

function authHeaders(): HeadersInit {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarGradient(name?: string): string {
  const gradients = [
    'from-violet-400 to-purple-500',
    'from-blue-400 to-indigo-500',
    'from-emerald-400 to-teal-500',
    'from-amber-400 to-orange-500',
    'from-rose-400 to-pink-500',
    'from-cyan-400 to-blue-500',
    'from-indigo-400 to-violet-500',
    'from-teal-400 to-emerald-500',
  ];
  if (!name) return gradients[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return null as any;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null as any;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr?: string): string {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ─── types ────────────────────────────────────────────────────────────────────

interface Interviewer { id: number; name: string; }

interface Filters {
  dateFrom: string; dateTo: string; type: string;
  status: string; interviewerId: string; mode: string;
}

const DEFAULT_FILTERS: Filters = {
  dateFrom: '', dateTo: '', type: '', status: '', interviewerId: '', mode: '',
};

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, count, icon, accent }: {
  label: string; count: number; icon: React.ReactNode; accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-4 hover:shadow-md transition-shadow duration-200 cursor-default">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900 leading-none">{count}</p>
        <p className="text-xs text-gray-400 mt-1">{label}</p>
      </div>
    </div>
  );
}

// ─── combined status+mode badge ───────────────────────────────────────────────

function CombinedBadge({ status, mode }: { status: string; mode: string }) {
  const statusColor: Record<string, string> = {
    Scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
    Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Cancelled: 'bg-red-50 text-red-600 border-red-200',
    'In Progress': 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusColor[status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {status}
      <span className="opacity-40">•</span>
      {mode}
    </span>
  );
}

// ─── type tag ─────────────────────────────────────────────────────────────────

function TypeTag({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-500">
      {type}
    </span>
  );
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-gray-200 rounded w-1/2" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  );
}

// ─── cancel dialog ────────────────────────────────────────────────────────────

function CancelDialog({ interview, onConfirm, onClose }: {
  interview: Interview; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
            <XCircle size={18} className="text-red-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">Cancel Interview</h3>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Cancel interview with{' '}
          <span className="font-medium text-gray-800">{interview.candidate_name ?? 'this candidate'}</span>?
          This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
            Keep
          </button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors">
            Cancel Interview
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── view modal ───────────────────────────────────────────────────────────────

function ViewModal({ interview, onClose }: { interview: Interview; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Candidate', interview.candidate_name ?? '—'],
    ['Job Role', interview.job_role ?? '—'],
    ['Interviewer', interview.interviewer_name ?? '—'],
    ['Date', formatDate(interview.date) ?? '—'],
    ['Time', formatTime(interview.time)],
    ['Duration', `${interview.duration} min`],
    ['Type', interview.type],
    ['Mode', interview.mode],
    ['Status', interview.status],
    ...(interview.meeting_link ? [['Meeting Link', interview.meeting_link] as [string, string]] : []),
    ...(interview.location ? [['Location', interview.location] as [string, string]] : []),
    ...(interview.notes ? [['Notes', interview.notes] as [string, string]] : []),
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Eye size={15} className="text-indigo-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">Interview Details</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-4">
              <span className="w-28 shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide pt-0.5">{label}</span>
              <span className="text-sm text-gray-800 break-all">{value}</span>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── action menu ──────────────────────────────────────────────────────────────

function ActionMenu({ onEdit, onReschedule, onCancel, isCancelled }: {
  onEdit: () => void; onReschedule: () => void; onCancel: () => void; isCancelled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1 animate-in fade-in zoom-in-95 duration-100">
          <button
            onClick={() => { onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Edit2 size={13} className="text-gray-400" /> Edit
          </button>
          {!isCancelled && (
            <button
              onClick={() => { onReschedule(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <CalendarClock size={13} className="text-gray-400" /> Reschedule
            </button>
          )}
          {!isCancelled && (
            <button
              onClick={() => { onCancel(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              <X size={13} /> Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── interview card ───────────────────────────────────────────────────────────

function InterviewCard({ interview, onView, onEdit, onReschedule, onCancel }: {
  interview: Interview;
  onView: () => void; onEdit: () => void; onReschedule: () => void; onCancel: () => void;
}) {
  const initials = getInitials(interview.candidate_name);
  const gradient = avatarGradient(interview.candidate_name);
  const isCancelled = interview.status === 'Cancelled';
  const dateStr = formatDate(interview.date);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-3 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
      {/* top: avatar + name + menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
              {interview.candidate_name ?? '—'}
            </p>
            {interview.job_role && (
              <p className="text-xs text-gray-400 truncate mt-0.5">{interview.job_role}</p>
            )}
          </div>
        </div>
        <ActionMenu
          onEdit={onEdit}
          onReschedule={onReschedule}
          onCancel={onCancel}
          isCancelled={isCancelled}
        />
      </div>

      {/* combined badge + type tag */}
      <div className="flex items-center gap-2 flex-wrap">
        <CombinedBadge status={interview.status} mode={interview.mode} />
        <TypeTag type={interview.type} />
      </div>

      {/* date / time / interviewer */}
      <div className="space-y-1.5 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <Calendar size={12} className="text-gray-300 shrink-0" />
          {dateStr ? (
            <span>{dateStr}</span>
          ) : (
            <span className="text-gray-300 italic">Date not set</span>
          )}
          <span className="text-gray-200 mx-0.5">·</span>
          <Clock size={12} className="text-gray-300 shrink-0" />
          <span>{formatTime(interview.time)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <User size={12} className="text-gray-300 shrink-0" />
          <span className="truncate">{interview.interviewer_name ?? '—'}</span>
        </div>
      </div>

      {/* primary action */}
      <div className="pt-1 border-t border-gray-50">
        <button
          onClick={onView}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors"
        >
          <Eye size={12} /> View Details
        </button>
      </div>
    </div>
  );
}

// ─── filter pill ──────────────────────────────────────────────────────────────

function FilterPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-600 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
      {children}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function InterviewManagement() {
  const { isAuthenticated } = useAuth();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const [viewInterview, setViewInterview] = useState<Interview | null>(null);
  const [editInterview, setEditInterview] = useState<Interview | null>(null);
  const [rescheduleInterview, setRescheduleInterview] = useState<Interview | null>(null);
  const [cancelInterview, setCancelInterview] = useState<Interview | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // ── fetch ──────────────────────────────────────────────────────────────────

  const fetchInterviews = async (f: Filters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.dateFrom) params.set('dateFrom', f.dateFrom);
      if (f.dateTo) params.set('dateTo', f.dateTo);
      if (f.type) params.set('type', f.type);
      if (f.status) params.set('status', f.status);
      if (f.interviewerId) params.set('interviewerId', f.interviewerId);
      if (f.mode) params.set('mode', f.mode);
      const qs = params.toString();
      const res = await fetch(`/api/interviews${qs ? `?${qs}` : ''}`, {
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      const raw: Interview[] = json?.data?.interviews ?? json?.interviews ?? [];
      raw.sort((a, b) => {
        const da = `${a.date}T${a.time}`;
        const db = `${b.date}T${b.time}`;
        return da < db ? -1 : da > db ? 1 : 0;
      });
      setInterviews(raw);
    } catch {
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchInterviewers = async () => {
    try {
      const res = await fetch('/api/users?role=Interviewer', { headers: authHeaders() });
      const json = await res.json();
      const list: Interviewer[] = Array.isArray(json)
        ? json
        : json?.data?.users ?? json?.users ?? json?.data ?? [];
      setInterviewers(list.filter((u: any) => u.role === 'Interviewer' || !u.role));
    } catch {
      setInterviewers([]);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchInterviewers();
    fetchInterviews(DEFAULT_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const setFilter = (key: keyof Filters, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    fetchInterviews(next);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    fetchInterviews(DEFAULT_FILTERS);
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const stats = useMemo(() => ({
    total: interviews.length,
    scheduled: interviews.filter((i) => i.status === 'Scheduled').length,
    completed: interviews.filter((i) => i.status === 'Completed').length,
    cancelled: interviews.filter((i) => i.status === 'Cancelled').length,
  }), [interviews]);

  const handleConfirmCancel = async () => {
    if (!cancelInterview) return;
    try {
      await fetch(`/api/interviews/${cancelInterview.id}/status`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Cancelled' }),
      });
      setCancelInterview(null);
      fetchInterviews(filters);
    } catch {
      setCancelInterview(null);
    }
  };

  const handleRescheduleSubmit = async (payload: any) => {
    if (!rescheduleInterview) return;
    const res = await fetch(`/api/interviews/${rescheduleInterview.id}/reschedule`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw err; }
    setRescheduleInterview(null);
    fetchInterviews(filters);
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.type) params.set('type', filters.type);
    if (filters.status) params.set('status', filters.status);
    if (filters.interviewerId) params.set('interviewerId', filters.interviewerId);
    if (filters.mode) params.set('mode', filters.mode);
    const qs = params.toString();
    const res = await fetch(`/api/interviews/export${qs ? `?${qs}` : ''}`, { headers: authHeaders() });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interviews-export-${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      <div className="w-full space-y-6">

        {/* ── stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total" count={stats.total} accent="bg-indigo-50"
            icon={<Calendar size={16} className="text-indigo-500" />} />
          <StatCard label="Scheduled" count={stats.scheduled} accent="bg-blue-50"
            icon={<Clock size={16} className="text-blue-500" />} />
          <StatCard label="Completed" count={stats.completed} accent="bg-emerald-50"
            icon={<CheckCircle2 size={16} className="text-emerald-500" />} />
          <StatCard label="Cancelled" count={stats.cancelled} accent="bg-red-50"
            icon={<XCircle size={16} className="text-red-400" />} />
        </div>

        {/* ── card grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : interviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <Calendar size={24} className="text-gray-300" />
            </div>
            <h3 className="text-base font-semibold text-gray-600">No interviews found</h3>
            <p className="text-sm text-gray-400 mt-1 max-w-xs">
              {hasActiveFilters ? 'Try adjusting or clearing your filters.' : 'No interviews have been scheduled yet.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
            {interviews.map((iv) => (
              <InterviewCard
                key={iv.id}
                interview={iv}
                onView={() => setViewInterview(iv)}
                onEdit={() => setEditInterview(iv)}
                onReschedule={() => setRescheduleInterview(iv)}
                onCancel={() => setCancelInterview(iv)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── modals ── */}
      {viewInterview && <ViewModal interview={viewInterview} onClose={() => setViewInterview(null)} />}

      {cancelInterview && (
        <CancelDialog
          interview={cancelInterview}
          onConfirm={handleConfirmCancel}
          onClose={() => setCancelInterview(null)}
        />
      )}

      {rescheduleInterview && (
        <InterviewModal
          candidate={{
            id: rescheduleInterview.candidate_id,
            name: rescheduleInterview.candidate_name ?? '',
            job_role: rescheduleInterview.job_role,
          }}
          isOpen={true}
          mode="reschedule"
          existingInterview={rescheduleInterview}
          onSubmit={handleRescheduleSubmit}
          onClose={() => setRescheduleInterview(null)}
        />
      )}

      {editInterview && (
        <InterviewModal
          candidate={{
            id: editInterview.candidate_id,
            name: editInterview.candidate_name ?? '',
            job_role: editInterview.job_role,
          }}
          isOpen={true}
          mode="reschedule"
          existingInterview={editInterview}
          onSubmit={async (payload) => {
            const res = await fetch(`/api/interviews/${editInterview.id}`, {
              method: 'PUT',
              headers: { ...authHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            if (!res.ok) { const err = await res.json().catch(() => ({})); throw err; }
            setEditInterview(null);
            fetchInterviews(filters);
          }}
          onClose={() => setEditInterview(null)}
        />
      )}

      {/* ── Floating FABs ── */}
      {createPortal(
        <>
          {/* Backdrop for filter drawer */}
          <div
            className={`fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${filterDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setFilterDrawerOpen(false)}
          />

          {/* Filter Drawer */}
          <div className={`fixed top-0 right-0 h-full w-[360px] max-w-full bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${filterDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
                  <SlidersHorizontal size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Filters</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {hasActiveFilters ? `${interviews.length} result${interviews.length !== 1 ? 's' : ''}` : 'No filters applied'}
                  </p>
                </div>
              </div>
              <button onClick={() => setFilterDrawerOpen(false)} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors">
                <X size={17} className="text-gray-500" />
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

              {/* Date Range */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Date Range</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                    <Calendar size={14} className="text-gray-400 shrink-0" />
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilter('dateFrom', e.target.value)}
                      className="bg-transparent text-sm outline-none flex-1 text-gray-700"
                    />
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                    <Calendar size={14} className="text-gray-400 shrink-0" />
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilter('dateTo', e.target.value)}
                      className="bg-transparent text-sm outline-none flex-1 text-gray-700"
                    />
                  </div>
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Interview Type</label>
                <div className="flex flex-wrap gap-2">
                  {['', 'HR Round', 'Technical', 'Final'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setFilter('type', opt)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filters.type === opt ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {opt || 'All'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</label>
                <div className="flex flex-wrap gap-2">
                  {['', 'Scheduled', 'Completed', 'Cancelled'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setFilter('status', opt)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filters.status === opt ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {opt || 'All'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Mode</label>
                <div className="flex flex-wrap gap-2">
                  {['', 'Virtual', 'In-Person'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setFilter('mode', opt)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filters.mode === opt ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {opt || 'All'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interviewer */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Interviewer</label>
                <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <select
                    value={filters.interviewerId}
                    onChange={(e) => setFilter('interviewerId', e.target.value)}
                    className="bg-transparent text-sm outline-none w-full text-gray-700 cursor-pointer"
                  >
                    <option value="">All Interviewers</option>
                    {interviewers.map((iv) => (
                      <option key={iv.id} value={String(iv.id)}>{iv.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Drawer footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex gap-3">
              <button
                onClick={() => { clearFilters(); setFilterDrawerOpen(false); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-600 transition-colors"
              >
                <RotateCcw size={14} />
                Reset
              </button>
              <button
                onClick={() => setFilterDrawerOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
              >
                Apply
              </button>
            </div>
          </div>

          {/* FAB stack */}
          <div className="fixed bottom-8 right-8 z-30 flex flex-col items-end gap-3">
            {/* Filter FAB */}
            <button
              onClick={() => setFilterDrawerOpen(true)}
              title="Filters"
              className="group flex items-center gap-0 overflow-hidden
                bg-white hover:bg-gray-50 text-gray-700 border border-gray-200
                h-12 w-12 hover:w-32
                rounded-full shadow-md hover:shadow-lg
                transition-all duration-300 ease-in-out"
            >
              <span className="flex items-center justify-center w-12 h-12 flex-shrink-0 relative">
                <SlidersHorizontal size={18} />
                {hasActiveFilters && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full" />
                )}
              </span>
              <span className="text-sm font-semibold whitespace-nowrap pr-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 -ml-1">
                Filters
              </span>
            </button>

            {/* Export FAB */}
            <button
              onClick={handleExport}
              title="Export to Excel"
              className="group flex items-center gap-0 overflow-hidden
                bg-indigo-600 hover:bg-indigo-700 text-white
                h-14 w-14 hover:w-40
                rounded-full shadow-lg hover:shadow-indigo-300/60 hover:shadow-xl
                transition-all duration-300 ease-in-out"
            >
              <span className="flex items-center justify-center w-14 h-14 flex-shrink-0">
                <Download size={20} />
              </span>
              <span className="text-sm font-semibold whitespace-nowrap pr-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 -ml-1">
                Export Excel
              </span>
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
