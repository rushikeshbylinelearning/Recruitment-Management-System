import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Calendar, User, AlertCircle, CheckCircle,
  X, Save, Edit, Trash2, ChevronLeft, ChevronRight,
  MessageSquare, Settings, MoreHorizontal, Phone, ExternalLink, UserPlus,
  ClipboardList,
} from 'lucide-react';
import { Task } from '../types';
import { tasksAPI, usersAPI, jobsAPI, candidatesAPI, interactionAPI, InteractionCandidate } from '../services/api';
import ProtectedComponent from './ProtectedComponent';
import { useAuth } from '../contexts/AuthContext';
import { useDrawer } from '../contexts/DrawerContext';
import { TimelineDrawer, STATUS_COLORS } from './InteractionMemory';
import WorkUpdateModal from './WorkUpdateModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Local calendar YYYY-MM-DD (avoids UTC off-by-one vs date inputs). */
function formatLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const TODAY = () => formatLocalYMD(new Date());

/** Normalize task.dueDate for comparisons (date-only or ISO string). */
function taskDueYmd(task: Task): string {
  const raw = task.dueDate;
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(raw).trim())) return String(raw).trim().slice(0, 10);
  const t = new Date(raw);
  return Number.isNaN(t.getTime()) ? '' : formatLocalYMD(t);
}

function friendlyDate(iso: string) {
  const today = TODAY();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (iso === today) return 'Today';
  if (iso === yesterday) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function shiftDateStr(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Metrics Dashboard ────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  subMetrics?: { label: string; value: number; color: string }[];
}

function MetricCard({ label, value, icon: Icon, color, bgColor, subMetrics }: MetricCardProps) {
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
          <p className="text-2xl font-bold" style={{ color }}>{value}</p>
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bgColor }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      {subMetrics && subMetrics.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-slate-50">
          {subMetrics.map((sub, idx) => (
            <div key={idx} className="flex flex-col">
              <span className="text-[9px] text-slate-400 uppercase tracking-wide">{sub.label}</span>
              <span className="text-sm font-bold mt-0.5" style={{ color: sub.color }}>
                {sub.value}{sub.label === 'Completion Rate' ? '%' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMNS = [
  {
    id: 'candidate-interactions' as const,
    label: 'Candidate Interactions',
    icon: MessageSquare,
    accent: '#dc2626',
    tint: 'rgba(99,102,241,0.07)',
    border: 'rgba(99,102,241,0.12)',
  },
  {
    id: 'hr-operations' as const,
    label: 'HR Operations',
    icon: User,
    accent: '#10b981',
    tint: 'rgba(16,185,129,0.07)',
    border: 'rgba(16,185,129,0.12)',
  },
  {
    id: 'admin-operations' as const,
    label: 'Admin Operations',
    icon: Settings,
    accent: '#f59e0b',
    tint: 'rgba(245,158,11,0.07)',
    border: 'rgba(245,158,11,0.12)',
  },
  {
    id: 'misc' as const,
    label: 'Misc',
    icon: MoreHorizontal,
    accent: '#94a3b8',
    tint: 'rgba(148,163,184,0.07)',
    border: 'rgba(148,163,184,0.12)',
  },
] as const;

type ColId = typeof COLUMNS[number]['id'];

const TASK_CATEGORY_IDS = ['hr-operations', 'admin-operations', 'misc'] as const;

function inferColumn(task: Task): Exclude<ColId, 'candidate-interactions'> {
  const raw = task.category?.toString().trim().toLowerCase();
  if (raw && TASK_CATEGORY_IDS.includes(raw as (typeof TASK_CATEGORY_IDS)[number])) {
    return raw as Exclude<ColId, 'candidate-interactions'>;
  }
  
  // Otherwise, infer from title and description
  const t = (task.title + ' ' + (task.description || '')).toLowerCase();
  
  // HR Operations keywords - expanded list
  if (/hr|recruit|recruiter|onboard|offer|hire|hiring|payroll|leave|policy|policies|employee|staff|interview|candidate|application|resume|cv|job posting|talent|workforce|performance review|appraisal|training|induction/i.test(t)) {
    return 'hr-operations';
  }
  
  // Admin Operations keywords - expanded list
  if (/admin|report|reporting|document|documentation|compliance|legal|finance|financial|budget|accounting|invoice|expense|procurement|purchase|vendor|contract|audit|regulatory|tax|insurance/i.test(t)) {
    return 'admin-operations';
  }
  
  // Default to misc for everything else
  return 'misc';
}

// ─── Priority / Status styles ─────────────────────────────────────────────────

const PRIORITY_STYLE: Record<string, { bg: string; dot: string }> = {
  High:   { bg: 'bg-red-50 text-red-600',     dot: 'bg-red-400' },
  Medium: { bg: 'bg-amber-50 text-amber-600',  dot: 'bg-amber-400' },
  Low:    { bg: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-400' },
};
const STATUS_STYLE: Record<string, string> = {
  Completed:   'bg-emerald-50 text-emerald-600',
  'In Progress': 'bg-blue-50 text-blue-600',
  Pending:     'bg-slate-50 text-slate-500',
};

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  onEdit: (t: Task) => void;
  onDelete: (id: number) => void;
  onComplete: (id: number) => void;
  hasEdit: boolean;
  hasDelete: boolean;
}

function TaskCard({ task, onEdit, onDelete, onComplete, hasEdit, hasDelete }: TaskCardProps) {
  const todayStr = TODAY();
  const due = taskDueYmd(task);

  let cardBorder: React.CSSProperties = {
    border: '1px solid rgba(226, 232, 240, 0.9)',
  };

  if (task.status === 'Completed') {
    cardBorder = { border: '2px solid #10b981' };
  } else if (due) {
    if (due < todayStr) {
      cardBorder = { border: '1px solid #cbd5e1' };
    } else if (due === todayStr) {
      cardBorder = { border: '2px solid #ef4444' };
    } else {
      cardBorder = { border: '2px solid #3b82f6' };
    }
  }

  const pStyle = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.Low;

  return (
    <div
      className="group relative bg-white rounded-xl px-3 py-2.5 transition-all duration-200"
      style={{
        boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.04)',
        ...cardBorder,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.05)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.04)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      <p className="text-xs font-semibold text-gray-800 leading-tight mb-1.5 line-clamp-2">{task.title}</p>
      <div className="flex items-center gap-1 mb-1.5 flex-wrap">
        <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${pStyle.bg}`}>
          <span className={`w-1 h-1 rounded-full ${pStyle.dot}`} />
          {task.priority}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[task.status] || STATUS_STYLE.Pending}`}>
          {task.status}
        </span>
        {task.status !== 'Completed' && due && due < todayStr && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800">
            Overdue
          </span>
        )}
        {task.status !== 'Completed' && due === todayStr && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-600">
            Due Today
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-400 leading-none">
        <span className="flex items-center gap-0.5">
          <Calendar size={9} className="shrink-0" />
          {new Date(task.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
        </span>
        {task.assignedToName && (
          <span className="flex items-center gap-1 min-w-0">
            <div className="w-3.5 h-3.5 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] font-semibold text-indigo-600 shrink-0">
              {task.assignedToName.charAt(0).toUpperCase()}
            </div>
            <span className="truncate max-w-[4.5rem]">{task.assignedToName.split(' ')[0]}</span>
          </span>
        )}
      </div>
      {(hasEdit || hasDelete) && (
        <div className="hidden group-hover:flex gap-1 mt-2 pt-2 border-t border-gray-100">
          {hasEdit && task.status !== 'Completed' && (
            <button onClick={() => onComplete(task.id)}
              className="flex-1 text-[10px] py-1 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors font-medium">
              ✓ Done
            </button>
          )}
          {hasEdit && (
            <button onClick={() => onEdit(task)}
              className="p-1 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
              <Edit size={11} />
            </button>
          )}
          {hasDelete && (
            <button onClick={() => onDelete(task.id)}
              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Candidate Interaction Card ───────────────────────────────────────────────

interface CandidateCardProps {
  c: InteractionCandidate;
  onClick: () => void;
  onAddToPipeline: (id: number) => void;
  onViewCandidate: (candidate: InteractionCandidate) => void;
}

function CandidateCard({ c, onClick, onAddToPipeline, onViewCandidate }: CandidateCardProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    // Only trigger onClick if not clicking on buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    onClick();
  };

  return (
    <div
      className="group bg-white rounded-2xl px-4 py-3.5 transition-all duration-150"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08), 0 12px 32px rgba(0,0,0,0.06)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Main card content - clickable */}
      <div className="flex items-center gap-3 cursor-pointer" onClick={handleCardClick}>
        {/* Avatar */}
        <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-semibold text-indigo-600">{c.name.charAt(0).toUpperCase()}</span>
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
            {c.candidate_id && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-600 flex-shrink-0" title="Linked to pipeline">
                🔗
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
            <Phone size={9} /> {c.phone}
          </p>
        </div>
        {/* Status + notes */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {c.latest_status ? (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.latest_status] || 'bg-slate-100 text-slate-500'}`}>
              {c.latest_status}
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-400">No status</span>
          )}
          <span className="text-[10px] text-slate-300">{c.note_count || 0} note{(c.note_count || 0) !== 1 ? 's' : ''}</span>
        </div>
        <ChevronRight size={13} className="text-slate-200 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
      </div>

      {/* Action buttons - shown on hover */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {c.candidate_id ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewCandidate(c);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] py-1.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors font-medium"
            title="View in Candidate Pipeline"
          >
            <ExternalLink size={11} /> View Candidate
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToPipeline(c.id);
            }}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] py-1.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors font-medium"
            title="Add to Candidate Pipeline"
          >
            <UserPlus size={11} /> Add to Pipeline
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl px-3 py-2.5 animate-pulse" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      <div className="h-2.5 bg-slate-100 rounded-full w-3/4 mb-2" />
      <div className="h-2 bg-slate-100 rounded-full w-2/5 mb-2" />
      <div className="h-2 bg-slate-100 rounded-full w-1/3" />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ label, onAdd, addLabel }: { label: string; onAdd?: () => void; addLabel?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
        <AlertCircle size={18} className="text-slate-200" />
      </div>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      {onAdd && (
        <button onClick={onAdd} className="mt-3 text-xs text-indigo-500 hover:text-indigo-600 font-medium transition-colors">
          {addLabel || '+ Add'}
        </button>
      )}
    </div>
  );
}

// ─── Candidate Interactions Column ───────────────────────────────────────────

interface CandidateColProps {
  viewDate: string;
  recruiterId?: number | null;
  onShowSuccess: (message: string) => void;
  onShowError: (message: string) => void;
}

function CandidateInteractionsColumn({ viewDate, recruiterId, onShowSuccess, onShowError }: CandidateColProps) {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<InteractionCandidate[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<InteractionCandidate | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const { openLogInteraction, openHistory, closeHistory, isHistoryOpen } = useDrawer();
  const isPastDate = viewDate < TODAY();

  const load = useCallback(async (q = search, page = 1, date = viewDate, recId = recruiterId) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 10, date };
      if (recId) {
        params.recruiterId = recId;
      }
      if (q) {
        if (/^\+?[\d\s\-]{7,}$/.test(q)) params.phone = q;
        else params.name = q;
      }
      const res = await interactionAPI.search(params);
      if (res.success) {
        setCandidates((res.data as any) || []);
        setPagination((res as any).pagination || { total: 0, page: 1, limit: 10, pages: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [search, viewDate, recruiterId]);

  useEffect(() => { load('', 1, viewDate, recruiterId); }, [viewDate, recruiterId]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load(search, 1, viewDate, recruiterId); };

  const handleOpenLogInteraction = () => {
    if (isPastDate) {
      onShowError('You cannot log interactions for past dates. Please switch to today.');
      return;
    }
    openLogInteraction();
  };

  const handleAddToPipeline = async (interactionId: number) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await candidatesAPI.addFromInteraction(interactionId);
      if (res.success && res.data) {
        // Show success notification
        if (res.data.isNew) {
          onShowSuccess('Candidate added to pipeline successfully!');
        } else {
          onShowSuccess('Candidate already exists in pipeline');
        }

        // Refresh the list to update the candidate_id
        await load(search, pagination.page, viewDate, recruiterId);
        
        // Navigate to candidates page with the candidate ID
        navigate(`/candidates?id=${res.data.candidateId}`);
      }
    } catch (error: any) {
      console.error('Failed to add to pipeline:', error);
      // Show error notification
      const errorMessage = error?.response?.data?.message || 'Failed to add candidate to pipeline. Please try again.';
      onShowError(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewCandidate = async (candidate: InteractionCandidate) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await candidatesAPI.addFromInteraction(candidate.id);
      if (res.success && res.data?.candidateId) {
        navigate(`/candidates?id=${res.data.candidateId}`);
      } else if (candidate.candidate_id) {
        // Fallback for legacy responses
        navigate(`/candidates?id=${candidate.candidate_id}`);
      }
    } catch (error: any) {
      console.error('Failed to open candidate from interaction:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to open candidate. Please try again.';
      onShowError(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search + Add */}
      <div className="flex flex-col gap-2 mb-4">
        <form onSubmit={handleSearch} className="flex gap-1.5">
          <div className="relative flex-1">
            <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Name or phone…"
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
            />
          </div>
          <button type="submit"
            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-200 transition-colors">
            Go
          </button>
        </form>
        <button
          onClick={handleOpenLogInteraction}
          disabled={isPastDate}
          className="flex items-center justify-center gap-1.5 w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
          style={{ boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}
          title={isPastDate ? 'Logging is disabled for past dates' : 'Log Interaction'}
        >
          <Plus size={12} /> Log Interaction
        </button>
      </div>

      {/* Count */}
      <p className="text-[11px] text-slate-400 mb-3">
        {pagination.total} record{pagination.total !== 1 ? 's' : ''} on this day
      </p>

      {/* Cards */}
      <div className="flex-1 space-y-2.5 overflow-y-auto">
        {loading ? (
          <>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </>
        ) : candidates.length === 0 ? (
          <EmptyState
            label="No interactions on this day"
            onAdd={isPastDate ? undefined : handleOpenLogInteraction}
            addLabel={isPastDate ? 'Logging disabled for past dates' : '+ Log interaction'}
          />
        ) : (
          candidates.map(c => (
            <CandidateCard 
              key={c.id} 
              c={c} 
              onClick={() => {
                setSelected(c);
                openHistory();
              }}
              onAddToPipeline={handleAddToPipeline}
              onViewCandidate={handleViewCandidate}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-slate-50">
          <button disabled={pagination.page <= 1}
            onClick={() => load(search, pagination.page - 1, viewDate, recruiterId)}
            className="w-6 h-6 flex items-center justify-center rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors">
            <ChevronLeft size={11} className="text-slate-500" />
          </button>
          <span className="text-[11px] text-slate-400 px-2">
            {pagination.page} / {pagination.pages}
          </span>
          <button disabled={pagination.page >= pagination.pages}
            onClick={() => load(search, pagination.page + 1, viewDate, recruiterId)}
            className="w-6 h-6 flex items-center justify-center rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-colors">
            <ChevronRight size={11} className="text-slate-500" />
          </button>
        </div>
      )}

      {isHistoryOpen && selected && (
        <TimelineDrawer 
          candidate={selected} 
          canAddNote={!isPastDate}
          addNoteDisabledReason="You cannot log interactions for past dates."
          onClose={() => {
            setSelected(null);
            closeHistory();
          }} 
        />
      )}
    </div>
  );
}

// ─── Task Column ──────────────────────────────────────────────────────────────

interface TaskColProps {
  colId: Exclude<ColId, 'candidate-interactions'>;
  tasks: Task[];
  loading: boolean;
  onEdit: (t: Task) => void;
  onDelete: (id: number) => void;
  onComplete: (id: number) => void;
  hasEdit: boolean;
  hasDelete: boolean;
  onAdd: (columnCategory: Exclude<ColId, 'candidate-interactions'>) => void;
  hasCreate: boolean;
  disableCreate: boolean;
}

function TaskColumn({ colId, tasks, loading, onEdit, onDelete, onComplete, hasEdit, hasDelete, onAdd, hasCreate, disableCreate }: TaskColProps) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const colTasks = tasks.filter(t => inferColumn(t) === colId);
  
  // Filter tasks based on completion status
  const filteredTasks = showCompleted 
    ? colTasks.filter(t => t.status === 'Completed')
    : colTasks;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Add button and filter dropdown */}
      <div className="flex gap-2 mb-4">
        {hasCreate && (
          <button
            onClick={() => onAdd(colId)}
            disabled={disableCreate}
            title={disableCreate ? 'Creating tasks is disabled for past dates' : 'New Task'}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-200 transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            <Plus size={12} /> New Task
          </button>
        )}
        
        {/* Filter dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={`p-2 rounded-xl text-xs font-medium transition-colors ${
              showCompleted 
                ? 'bg-indigo-100 text-indigo-600' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title="Filter tasks"
          >
            <MoreHorizontal size={14} />
          </button>
          
          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-10 min-w-[140px]">
              <button
                onClick={() => {
                  setShowCompleted(false);
                  setShowDropdown(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-50 transition-colors ${
                  !showCompleted ? 'text-indigo-600 font-semibold' : 'text-slate-600'
                }`}
              >
                All Tasks
              </button>
              <button
                onClick={() => {
                  setShowCompleted(true);
                  setShowDropdown(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-50 transition-colors ${
                  showCompleted ? 'text-indigo-600 font-semibold' : 'text-slate-600'
                }`}
              >
                Completed
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Count */}
      <p className="text-[11px] text-slate-400 mb-3">
        {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} 
        {showCompleted ? ' (completed)' : ''}
      </p>

      {/* Cards */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {loading ? (
          <>
            <SkeletonCard /><SkeletonCard />
          </>
        ) : filteredTasks.length === 0 ? (
          <EmptyState
            label={showCompleted ? "No completed tasks" : "No tasks"}
            onAdd={hasCreate && !disableCreate && !showCompleted ? () => onAdd(colId) : undefined}
            addLabel={disableCreate ? 'Task creation disabled for past dates' : '+ New task'}
          />
        ) : (
          filteredTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
              onComplete={onComplete}
              hasEdit={hasEdit}
              hasDelete={hasDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Task Form Modal ──────────────────────────────────────────────────────────

interface TaskFormModalProps {
  mode: 'create' | 'edit';
  formData: any;
  errors: Record<string, string>;
  users: any[];
  jobs: any[];
  candidates: any[];
  onChange: (k: string, v: any) => void;
  onSubmit: () => void;
  onClose: () => void;
}

function TaskFormModal({ mode, formData, errors, users, jobs, candidates, onChange, onSubmit, onClose }: TaskFormModalProps) {
  const { user } = useAuth();
  const inputBase = 'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-gray-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all';
  const inputError = 'border-red-300 bg-red-50 focus:ring-red-400';

  // Determine if user is a recruiter (can assign to self OR to HR Interns)
  const isRecruiter = user?.role === 'Recruiter';

  // Filter users based on role: recruiter sees self + HR Interns; others see all
  const availableUsers = isRecruiter
    ? users.filter(u => u.id === user?.id || u.role === 'HR Intern')
    : users;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
        <div className="flex items-center justify-between px-7 pt-7 pb-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{mode === 'create' ? 'New Task' : 'Edit Task'}</h2>
            <p className="text-sm text-slate-400 mt-0.5">{mode === 'create' ? 'Add a task to your board' : 'Update task details'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="px-7 pb-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Task Title *</label>
            <input type="text" value={formData.title} onChange={e => onChange('title', e.target.value)}
              placeholder="What needs to be done?" className={`${inputBase} ${errors.title ? inputError : ''}`} />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
          </div>

          <div className={`grid ${isRecruiter ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
            {!isRecruiter && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Assigned To *</label>
                <select 
                  value={formData.assignedTo} 
                  onChange={e => onChange('assignedTo', Number(e.target.value))}
                  className={`${inputBase} ${errors.assignedTo ? inputError : ''}`}>
                  <option value="">Select member</option>
                  {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}
                </select>
                {errors.assignedTo && <p className="text-red-500 text-xs mt-1">{errors.assignedTo}</p>}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Category *</label>
              <select 
                value={formData.category || 'hr-operations'} 
                onChange={e => onChange('category', e.target.value)}
                className={inputBase}>
                <option value="hr-operations">HR Operations</option>
                <option value="admin-operations">Admin Operations</option>
                <option value="misc">Misc</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Due Date *</label>
              <input type="date" value={formData.dueDate} onChange={e => onChange('dueDate', e.target.value)}
                className={`${inputBase} ${errors.dueDate ? inputError : ''}`} />
              {errors.dueDate && <p className="text-red-500 text-xs mt-1">{errors.dueDate}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Priority</label>
              <select value={formData.priority} onChange={e => onChange('priority', e.target.value)} className={inputBase}>
                <option>Low</option><option>Medium</option><option>High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
              <select value={formData.status} onChange={e => onChange('status', e.target.value)} className={inputBase}>
                <option>Pending</option><option>In Progress</option><option>Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Job (optional)</label>
              <select value={formData.jobId || ''} onChange={e => onChange('jobId', e.target.value ? Number(e.target.value) : null)} className={inputBase}>
                <option value="">None</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Candidate (optional)</label>
              <select value={formData.candidateId || ''} onChange={e => onChange('candidateId', e.target.value ? Number(e.target.value) : null)} className={inputBase}>
                <option value="">None</option>
                {candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description *</label>
            <textarea value={formData.description} rows={3} onChange={e => onChange('description', e.target.value)}
              placeholder="Describe the task…" className={`${inputBase} resize-none ${errors.description ? inputError : ''}`} />
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
          </div>
        </div>

        <div className="px-7 pb-7 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors font-medium">
            Cancel
          </button>
          <button onClick={onSubmit}
            className="px-5 py-2.5 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2"
            style={{ boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
            <Save size={14} />
            {mode === 'create' ? 'Create Task' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Modal ─────────────────────────────────────────────────────────────

interface FilterModalProps {
  recruiters: any[];
  selectedRecruiterId: number | null;
  onSelect: (id: number | null) => void;
  onClose: () => void;
}

function FilterModal({ recruiters, selectedRecruiterId, onSelect, onClose }: FilterModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <User size={20} className="text-indigo-500" />
              Filter by Recruiter / Intern
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">View tasks and interactions for specific recruiter or intern</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="px-7 py-5 max-h-96 overflow-y-auto">
          {/* All Recruiters Option */}
          <button
            onClick={() => { onSelect(null); onClose(); }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl mb-2 transition-all ${
              selectedRecruiterId === null
                ? 'bg-indigo-50 border-2 border-indigo-500'
                : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-semibold">
                All
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-800">All Recruiters / Interns</p>
                <p className="text-xs text-slate-400">View all tasks and interactions</p>
              </div>
            </div>
            {selectedRecruiterId === null && (
              <CheckCircle size={20} className="text-indigo-500" />
            )}
          </button>

          {/* Individual Recruiters */}
          {recruiters.map(recruiter => (
            <button
              key={recruiter.id}
              onClick={() => { onSelect(recruiter.id); onClose(); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl mb-2 transition-all ${
                selectedRecruiterId === recruiter.id
                  ? 'bg-indigo-50 border-2 border-indigo-500'
                  : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
                  {recruiter.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">{recruiter.name}</p>
                  <p className="text-xs text-slate-400">@{recruiter.username} · {recruiter.role}</p>
                </div>
              </div>
              {selectedRecruiterId === recruiter.id && (
                <CheckCircle size={20} className="text-indigo-500" />
              )}
            </button>
          ))}
        </div>

        <div className="px-7 pb-7 pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full px-5 py-2.5 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Global Date Navigator (bottom-right fixed) ───────────────────────────────

interface DateNavProps {
  viewDate: string;
  onChange: (d: string) => void;
  onFilterClick?: () => void;
  hasActiveFilter?: boolean;
  filterLabel?: string;
  onWorkUpdate?: () => void;
  showWorkUpdateFAB?: boolean;
}

function DateNavigator({ viewDate, onChange, onFilterClick, hasActiveFilter, filterLabel, onWorkUpdate, showWorkUpdateFAB }: DateNavProps) {
  const isToday = viewDate === TODAY();
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-3" ref={pickerRef}>

      {/* ── Submit Work Update FAB — stacked above date pill ─────────────── */}
      {showWorkUpdateFAB && onWorkUpdate && (
        <button
          onClick={onWorkUpdate}
          title="Submit Work Update (EOD)"
          aria-label="Submit EOD Work Update"
          className="w-12 h-12 flex items-center justify-center rounded-full text-white transition-all duration-200 hover:scale-110 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            boxShadow: '0 4px 20px rgba(99,102,241,0.45)',
          }}
        >
          <ClipboardList size={20} />
        </button>
      )}

      {/* ── Recruiter filter button ───────────────────────────────────────── */}
      {onFilterClick && (
        <button
          onClick={onFilterClick}
          className="w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
          style={{
            background: hasActiveFilter
              ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
              : 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
            border: hasActiveFilter ? 'none' : '1px solid rgba(226,232,240,0.9)',
            color: hasActiveFilter ? 'white' : '#64748b',
          }}
          title={hasActiveFilter ? `Filtered by: ${filterLabel}` : 'Filter by recruiter'}
        >
          <User size={18} />
        </button>
      )}

      {/* ── Date pill + calendar popup (popup anchored to pill, not column) ─ */}
      <div className="relative">
        {/* Calendar picker popup — always opens above the pill */}
        {showPicker && (
          <div
            className="absolute bottom-full right-0 mb-2 bg-white rounded-2xl shadow-xl p-3 border border-slate-100"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
          >
            <input
              type="date"
              value={viewDate}
              onChange={e => { onChange(e.target.value); setShowPicker(false); }}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
          </div>
        )}

        {/* Pill navigator */}
        <div
          className="flex items-center gap-1 px-3 py-2 rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
            border: '1px solid rgba(255,255,255,0.8)',
          }}
        >
          <button
            onClick={() => onChange(shiftDateStr(viewDate, -1))}
            className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={14} className="text-slate-500" />
          </button>

          <button
            onClick={() => setShowPicker(p => !p)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <Calendar size={12} className="text-indigo-400" />
            <span className={`text-xs font-semibold ${isToday ? 'text-indigo-600' : 'text-gray-700'}`}>
              {friendlyDate(viewDate)}
            </span>
          </button>

          {!isToday && (
            <button
              onClick={() => onChange(TODAY())}
              className="text-[11px] text-indigo-500 hover:text-indigo-600 font-medium px-1.5 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              Today
            </button>
          )}

          <button
            onClick={() => onChange(shiftDateStr(viewDate, 1))}
            disabled={isToday}
            className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={14} className="text-slate-500" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Tasks Component ─────────────────────────────────────────────────────

interface TasksProps {
  tasks?: Task[];
  onAddTask?: (taskData: any) => void;
  onEditTask?: (taskId: string, taskData: any) => void;
  onMarkComplete?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onAssignTask?: (taskId: string, assignedTo: string) => void;
}

export default function Tasks({}: TasksProps) {
  const { hasPermission, user } = useAuth();

  // Global date state — persisted in localStorage
  const [viewDate, setViewDate] = useState<string>(() => {
    try { return localStorage.getItem('tasks_view_date') || TODAY(); } catch { return TODAY(); }
  });

  // Recruiter filter for admin view
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<number | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usersWarning, setUsersWarning] = useState('');

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showWorkUpdateModal, setShowWorkUpdateModal] = useState(false);

  // Metrics state - initialize with stable defaults to prevent flicker
  const [metrics, setMetrics] = useState({
    totalInteractions: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    interactionsByStatus: {
      Interested: 0,
      'No Response': 0,
      'Follow-up': 0,
      Other: 0
    }
  });

  const emptyForm = {
    title: '', description: '', assignedTo: 0,
    jobId: null as number | null, candidateId: null as number | null,
    priority: 'Medium', status: 'Pending', dueDate: viewDate,
    category: 'hr-operations' as 'hr-operations' | 'admin-operations' | 'misc',
  };
  const [taskFormData, setTaskFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Prevent double-fetch in React StrictMode
  const hasFetchedRef = useRef(false);

  // Persist date
  useEffect(() => {
    try { localStorage.setItem('tasks_view_date', viewDate); } catch {}
  }, [viewDate]);

  // Load tasks with optional recruiter filter - STABLE function
  const loadTasks = useCallback(async (recruiterId?: number | null) => {
    try {
      // Build params with optional assignedTo filter
      const params: any = { page: 1, limit: 100 };
      if (recruiterId) {
        params.assignedTo = recruiterId;
      }
      
      // Backend validatePagination caps limit at 100 — fetch all pages
      const first = await tasksAPI.getTasks(params);
      if (!first.success || !first.data) return;
      const allTasks = [...(first.data.tasks || [])];
      const totalPages = first.data.pagination?.pages || 1;
      if (totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            tasksAPI.getTasks({ ...params, page: i + 2 })
          )
        );
        rest.forEach(r => { if (r.success && r.data) allTasks.push(...(r.data.tasks || [])); });
      }
      setTasks(allTasks);
      
      // Calculate metrics immediately after loading tasks
      return allTasks;
    } catch (error) {
      console.error('Failed to load tasks:', error);
      return [];
    }
  }, []);

  // Calculate metrics from tasks and interactions - STABLE function
  const updateMetrics = useCallback(async (tasksList: Task[], date: string, recruiterId?: number | null) => {
    // Task metrics
    const completed = tasksList.filter(t => t.status === 'Completed').length;
    const pending = tasksList.filter(t => t.status === 'Pending').length;
    const inProgress = tasksList.filter(t => t.status === 'In Progress').length;

    // Fetch interaction metrics for the current date
    try {
      const interactionParams: any = { page: 1, limit: 1000, date };
      if (recruiterId) {
        interactionParams.recruiterId = recruiterId;
      }
      
      const interactionRes = await interactionAPI.search(interactionParams);
      
      if (interactionRes.success && interactionRes.data) {
        const interactions = interactionRes.data as any[];
        
        // Count by status
        const statusCounts = {
          Interested: 0,
          'No Response': 0,
          'Follow-up': 0,
          Other: 0
        };
        
        interactions.forEach(interaction => {
          const status = interaction.latest_status || 'Other';
          if (status === 'Interested') statusCounts.Interested++;
          else if (status === 'No Response') statusCounts['No Response']++;
          else if (status === 'Follow-up') statusCounts['Follow-up']++;
          else statusCounts.Other++;
        });

        setMetrics({
          totalInteractions: interactions.length,
          totalTasks: tasksList.length,
          completedTasks: completed,
          pendingTasks: pending,
          inProgressTasks: inProgress,
          interactionsByStatus: statusCounts
        });
      } else {
        // If interaction fetch fails, just update task metrics
        setMetrics(prev => ({
          ...prev,
          totalTasks: tasksList.length,
          completedTasks: completed,
          pendingTasks: pending,
          inProgressTasks: inProgress
        }));
      }
    } catch (error) {
      console.error('Failed to fetch interaction metrics:', error);
      // Update task metrics only
      setMetrics(prev => ({
        ...prev,
        totalTasks: tasksList.length,
        completedTasks: completed,
        pendingTasks: pending,
        inProgressTasks: inProgress
      }));
    }
  }, []);

  // SINGLE initial data load - prevents multiple re-renders
  useEffect(() => {
    // Prevent double-fetch in React StrictMode
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    (async () => {
      setLoading(true);
      setError('');
      try {
        // Load all data in parallel
        const [usersResult, jobsResult, candidatesResult] = await Promise.all([
          usersAPI.getUsers().catch(e => {
            setUsersWarning(e?.response?.status === 403 ? 'No permission to view users.' : 'Could not load users.');
            return { success: false, data: null };
          }),
          jobsAPI.getJobs(),
          candidatesAPI.getCandidates(),
        ]);

        if (usersResult.success && usersResult.data) setUsers(usersResult.data.users || []);
        if (jobsResult.success && jobsResult.data) setJobs(jobsResult.data.jobs || []);
        if (candidatesResult.success && candidatesResult.data) setCandidates(candidatesResult.data.candidates || []);
        
        // Load tasks and metrics together
        const loadedTasks = await loadTasks(selectedRecruiterId);
        if (loadedTasks) {
          await updateMetrics(loadedTasks, viewDate, selectedRecruiterId);
        }
      } catch (e) {
        setError('Failed to load data: ' + (e instanceof Error ? e.message : 'Unknown error'));
      } finally {
        setLoading(false);
      }
    })();
  }, []); // Empty deps - load ONCE on mount

  // Handle recruiter filter changes (Admin only)
  useEffect(() => {
    if (!hasFetchedRef.current) return; // Skip if initial load hasn't happened
    if (user?.role !== 'Admin') return;

    (async () => {
      const loadedTasks = await loadTasks(selectedRecruiterId);
      if (loadedTasks) {
        await updateMetrics(loadedTasks, viewDate, selectedRecruiterId);
      }
    })();
  }, [selectedRecruiterId, user?.role, loadTasks, updateMetrics, viewDate]);

  // Handle date changes - only update metrics, don't reload tasks
  useEffect(() => {
    if (!hasFetchedRef.current) return; // Skip if initial load hasn't happened
    if (tasks.length > 0) {
      updateMetrics(tasks, viewDate, selectedRecruiterId);
    }
  }, [viewDate]); // Only viewDate dependency

  // Filter tasks by selected date (match dueDate)
  // Note: Recruiter filtering is now done at the API level
  // UPDATED: Show ALL tasks, not just tasks for the selected date
  const tasksForDate = tasks;

  // Get list of recruiters + HR Interns for the filter dropdown
  const recruiters = users.filter(u => u.role === 'Recruiter' || u.role === 'HR Intern');

  function openCreate(defaultCategory: Exclude<ColId, 'candidate-interactions'> = 'hr-operations') {
    if (viewDate < TODAY()) {
      setError('You cannot create tasks for past dates. Please switch to today.');
      return;
    }
    setEditingTask(null);
    // For recruiters, automatically set assignedTo to themselves
    const initialAssignedTo = user?.role === 'Recruiter' ? user.id : 0;
    setTaskFormData({
      ...emptyForm,
      dueDate: viewDate,
      assignedTo: initialAssignedTo,
      category: defaultCategory,
    });
    setFormErrors({});
    setShowTaskModal(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    const raw = task.category?.toString().trim().toLowerCase();
    const saved =
      raw && TASK_CATEGORY_IDS.includes(raw as (typeof TASK_CATEGORY_IDS)[number])
        ? (raw as (typeof TASK_CATEGORY_IDS)[number])
        : inferColumn(task);
    setTaskFormData({
      title: task.title, description: task.description, assignedTo: task.assignedTo,
      jobId: task.jobId || null, candidateId: task.candidateId || null,
      priority: task.priority, status: task.status, dueDate: task.dueDate,
      category: saved,
    });
    setFormErrors({});
    setShowTaskModal(true);
  }

  function changeForm(k: string, v: any) { setTaskFormData(prev => ({ ...prev, [k]: v })); }

  function validateForm() {
    const e: Record<string, string> = {};
    if (!taskFormData.title.trim()) e.title = 'Required';
    if (!taskFormData.description.trim()) e.description = 'Required';
    if (!taskFormData.assignedTo) e.assignedTo = 'Required';
    if (!taskFormData.dueDate) e.dueDate = 'Required';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validateForm()) return;
    try {
      const payload = {
        ...taskFormData,
        priority: taskFormData.priority as 'High' | 'Medium' | 'Low',
        status: taskFormData.status as 'Pending' | 'In Progress' | 'Completed',
        jobId: taskFormData.jobId || undefined,
        candidateId: taskFormData.candidateId || undefined,
        createdBy: user?.id || 1,
      };
      const res = editingTask
        ? await tasksAPI.updateTask(editingTask.id, payload)
        : await tasksAPI.createTask(payload);
      if (res.success) {
        setSuccessMessage(editingTask ? 'Task updated!' : 'Task created!');
        setShowSuccessPopup(true);
        setTimeout(() => setShowSuccessPopup(false), 2500);
        setShowTaskModal(false);
        setEditingTask(null);
        loadTasks(selectedRecruiterId);
      }
    } catch { setError('Failed to save task'); }
  }

  async function handleComplete(id: number) {
    await tasksAPI.updateTaskStatus(id, 'Completed');
    loadTasks(selectedRecruiterId);
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this task?')) return;
    await tasksAPI.deleteTask(id);
    loadTasks(selectedRecruiterId);
  }

  // Notification handlers for child components
  function showSuccessNotification(message: string) {
    setSuccessMessage(message);
    setShowSuccessPopup(true);
    setTimeout(() => setShowSuccessPopup(false), 2500);
  }

  function showErrorNotification(message: string) {
    setError(message);
    setTimeout(() => setError(''), 3000);
  }

  const hasEdit = hasPermission('tasks', 'edit');
  const hasDelete = hasPermission('tasks', 'delete');
  const hasCreate = hasPermission('tasks', 'create');

  return (
    <ProtectedComponent module="tasks" action="view">
      <div className="flex flex-col h-full" style={{ background: '#f8fafc' }}>

        {/* Success toast */}
        {showSuccessPopup && (
          <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 8px 24px rgba(16,185,129,0.35)' }}>
            <CheckCircle size={16} /> {successMessage}
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-2xl flex items-center justify-between text-sm">
            <p>{error}</p>
            <button onClick={() => window.location.reload()}
              className="ml-4 px-3 py-1 bg-red-500 text-white text-xs rounded-xl hover:bg-red-600 transition-colors">Retry</button>
          </div>
        )}
        {!error && usersWarning && (
          <div className="mb-4 bg-amber-50 border border-amber-100 text-amber-700 px-4 py-3 rounded-2xl text-sm flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-500 flex-shrink-0" /> {usersWarning}
          </div>
        )}

        {/* Key Metrics Dashboard */}
        {user?.role === 'Admin' && (
          <div className="mb-4">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 animate-pulse">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="h-2.5 bg-slate-100 rounded-full w-20 mb-1.5" />
                        <div className="h-6 bg-slate-100 rounded-full w-12" />
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-slate-100" />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-slate-50">
                      <div className="h-2.5 bg-slate-100 rounded-full" />
                      <div className="h-2.5 bg-slate-100 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard
                  label="Total Interactions"
                  value={metrics.totalInteractions}
                  icon={MessageSquare}
                  color="#dc2626"
                  bgColor="rgba(99,102,241,0.1)"
                  subMetrics={[
                    { label: 'Interested', value: metrics.interactionsByStatus.Interested, color: '#10b981' },
                    { label: 'No Response', value: metrics.interactionsByStatus['No Response'], color: '#f59e0b' },
                    { label: 'Follow-up', value: metrics.interactionsByStatus['Follow-up'], color: '#3b82f6' },
                    { label: 'Other', value: metrics.interactionsByStatus.Other, color: '#94a3b8' }
                  ]}
                />
                <MetricCard
                  label="Total Tasks"
                  value={metrics.totalTasks}
                  icon={CheckCircle}
                  color="#8b5cf6"
                  bgColor="rgba(139,92,246,0.1)"
                  subMetrics={[
                    { label: 'Completed', value: metrics.completedTasks, color: '#10b981' },
                    { label: 'In Progress', value: metrics.inProgressTasks, color: '#3b82f6' },
                    { label: 'Pending', value: metrics.pendingTasks, color: '#f59e0b' }
                  ]}
                />
                <MetricCard
                  label="Completed Tasks"
                  value={metrics.completedTasks}
                  icon={CheckCircle}
                  color="#10b981"
                  bgColor="rgba(16,185,129,0.1)"
                  subMetrics={[
                    { 
                      label: 'Completion Rate', 
                      value: metrics.totalTasks > 0 ? Math.round((metrics.completedTasks / metrics.totalTasks) * 100) : 0, 
                      color: '#10b981' 
                    }
                  ]}
                />
                <MetricCard
                  label="Pending Tasks"
                  value={metrics.pendingTasks}
                  icon={AlertCircle}
                  color="#f59e0b"
                  bgColor="rgba(245,158,11,0.1)"
                  subMetrics={[
                    { label: 'In Progress', value: metrics.inProgressTasks, color: '#3b82f6' }
                  ]}
                />
              </div>
            )}
          </div>
        )}

        {/* 4-Column Kanban */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 pb-20" style={{ height: 'calc(100vh - 180px)' }}>
          {COLUMNS.map(col => {
            const Icon = col.icon;
            return (
              <div
                key={col.id}
                className="flex flex-col rounded-2xl overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.04)',
                  border: `1px solid ${col.border}`,
                  height: '100%',
                }}
              >
                {/* Column header */}
                <div
                  className="flex items-center gap-2.5 px-5 py-4 flex-shrink-0"
                  style={{ borderBottom: `1px solid ${col.border}`, background: col.tint }}
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${col.accent}18` }}>
                    <Icon size={15} style={{ color: col.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-800 truncate">{col.label}</h3>
                  </div>
                  {col.id !== 'candidate-interactions' && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                      style={{ background: `${col.accent}18`, color: col.accent }}>
                      {tasksForDate.filter(t => inferColumn(t) === col.id).length}
                    </span>
                  )}
                </div>

                {/* Column body */}
                <div className="flex-1 px-4 py-4 overflow-y-auto" style={{ minHeight: 0 }}>
                  {col.id === 'candidate-interactions' ? (
                    <CandidateInteractionsColumn 
                      viewDate={viewDate} 
                      recruiterId={selectedRecruiterId}
                      onShowSuccess={showSuccessNotification}
                      onShowError={showErrorNotification}
                    />
                  ) : (
                    <TaskColumn
                      colId={col.id}
                      tasks={tasksForDate}
                      loading={loading}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onComplete={handleComplete}
                      hasEdit={hasEdit}
                      hasDelete={hasDelete}
                      onAdd={openCreate}
                      hasCreate={hasCreate}
                      disableCreate={viewDate < TODAY()}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Global date navigator — fixed bottom-right */}
        {user?.role === 'Admin' && recruiters.length > 0 ? (
          <DateNavigator 
            viewDate={viewDate} 
            onChange={setViewDate}
            onFilterClick={() => setShowFilterModal(true)}
            hasActiveFilter={selectedRecruiterId !== null}
            filterLabel={selectedRecruiterId ? recruiters.find(r => r.id === selectedRecruiterId)?.name : undefined}
          />
        ) : (
          <DateNavigator
            viewDate={viewDate}
            onChange={setViewDate}
            showWorkUpdateFAB={user?.role === 'Recruiter' || user?.role === 'HR Intern'}
            onWorkUpdate={() => setShowWorkUpdateModal(true)}
          />
        )}

        {/* Filter Modal */}
        {showFilterModal && user?.role === 'Admin' && (
          <FilterModal
            recruiters={recruiters}
            selectedRecruiterId={selectedRecruiterId}
            onSelect={setSelectedRecruiterId}
            onClose={() => setShowFilterModal(false)}
          />
        )}

        {/* Task form modal */}
        {showTaskModal && (
          <TaskFormModal
            mode={editingTask ? 'edit' : 'create'}
            formData={taskFormData}
            errors={formErrors}
            users={users}
            jobs={jobs}
            candidates={candidates}
            onChange={changeForm}
            onSubmit={handleSubmit}
            onClose={() => setShowTaskModal(false)}
          />
        )}

        {/* Work Update Modal */}
        {showWorkUpdateModal && (
          <WorkUpdateModal
            onClose={() => {
              setShowWorkUpdateModal(false);
              // Show success toast after close if submitted
            }}
          />
        )}
      </div>
    </ProtectedComponent>
  );
}
