import { useState, useEffect, useCallback } from 'react';
import {
  Search, Phone, Mail, Star, Clock, Plus, ChevronRight,
  Users, Calendar, ChevronLeft,
} from 'lucide-react';
import { interactionAPI, InteractionCandidate, InteractionNote } from '../services/api';
import InteractionNoteModal from './InteractionNoteModal';
import RightDrawer from './ui/RightDrawer';
import { useDrawer } from '../contexts/DrawerContext';

// ─── helpers ────────────────────────────────────────────────────────────────

export const STATUS_COLORS: Record<string, string> = {
  'Interested':     'bg-green-100 text-green-700',
  'Follow-up':      'bg-blue-100 text-blue-700',
  'Not Interested': 'bg-red-100 text-red-700',
  'No Response':    'bg-gray-100 text-gray-600',
  'Wrong Number':   'bg-orange-100 text-orange-700',
};

export function StarRating({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={12}
          className={n <= value ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'} />
      ))}
    </span>
  );
}

// ─── Timeline drawer ─────────────────────────────────────────────────────────

export function TimelineDrawer({
  candidate,
  onClose,
  canAddNote = true,
  addNoteDisabledReason = 'Adding notes is disabled.',
}: {
  candidate: InteractionCandidate;
  onClose: () => void;
  canAddNote?: boolean;
  addNoteDisabledReason?: string;
}) {
  const [notes, setNotes] = useState<InteractionNote[]>([]);
  const [loading, setLoading] = useState(true);
  const { openLogInteraction, isHistoryOpen } = useDrawer();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await interactionAPI.getNotesByCandidate(candidate.id);
      if (res.success) setNotes((res.data as any) || []);
    } finally {
      setLoading(false);
    }
  }, [candidate.id]);

  useEffect(() => { load(); }, [load]);

  const handleAddNote = () => {
    // Context-aware: Open log interaction from LEFT since history is already open
    openLogInteraction(candidate.phone);
  };

  return (
    <RightDrawer
      isOpen={isHistoryOpen}
      onClose={onClose}
      title={candidate.name}
      subtitle={
        <span className="flex items-center gap-2 text-xs text-gray-500">
          <Phone size={12} /> {candidate.phone}
          {candidate.email && (
            <>
              <Mail size={12} className="ml-1" /> {candidate.email}
            </>
          )}
        </span>
      }
      width="480px"
    >
      <div className="space-y-4">
        {/* Header with Add Note button */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h4 className="text-sm font-semibold text-gray-700">Interaction History</h4>
          <button
            onClick={handleAddNote}
            disabled={!canAddNote}
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-all disabled:text-slate-400 disabled:hover:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            title={canAddNote ? 'Add Note' : addNoteDisabledReason}
          >
            <Plus size={14} /> Add Note
          </button>
        </div>

          {/* Timeline */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Clock size={20} className="text-slate-300" />
              </div>
              <p className="text-sm text-gray-400 mb-3">No interactions yet</p>
              <button
                onClick={() => setAddingNote(true)}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Add the first note →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map((note, i) => (
                <div key={note.id} className="relative pl-6 animate-slideIn" style={{ animationDelay: `${i * 50}ms` }}>
                  {/* Timeline connector */}
                  {i < notes.length - 1 && (
                    <div className="absolute left-2 top-6 bottom-0 w-px bg-gradient-to-b from-indigo-200 to-transparent" />
                  )}
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-2 w-4 h-4 rounded-full border-2 border-indigo-400 bg-white shadow-sm" />
                  
                  {/* Note card */}
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[note.status] || 'bg-gray-100 text-gray-600'}`}>
                        {note.status}
                      </span>
                      <StarRating value={note.priority} />
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed mb-3 break-words overflow-wrap-anywhere">{note.note}</p>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="font-medium truncate mr-2">{note.author_name || 'Unknown'}</span>
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <Clock size={11} />
                        {new Date(note.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </div>
                    {note.follow_up_date && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-blue-600 flex items-center gap-1.5 font-medium">
                          <Calendar size={12} /> Follow-up:{' '}
                          {new Date(note.follow_up_date).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </RightDrawer>
  );
}

// ─── Candidate card grid + date pagination ────────────────────────────────────

interface InteractionCandidatesProps {
  /** If true, renders as a compact embedded section (no standalone header) */
  embedded?: boolean;
}

export default function InteractionMemory({ embedded = false }: InteractionCandidatesProps) {
  const [candidates, setCandidates] = useState<InteractionCandidate[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<InteractionCandidate | null>(null);
  const { openLogInteraction, openHistory, closeHistory, isHistoryOpen } = useDrawer();

  // Date-based navigation — each "page" = one calendar day
  const [viewDate, setViewDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const load = useCallback(async (q = search, page = 1, date = viewDate) => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20, date };
      if (q) {
        if (/^\+?[\d\s\-]{7,}$/.test(q)) params.phone = q;
        else params.name = q;
      }
      const res = await interactionAPI.search(params);
      if (res.success) {
        setCandidates((res.data as any) || []);
        setPagination((res as any).pagination || { total: 0, page: 1, limit: 20, pages: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [search, viewDate]);

  useEffect(() => { load(); }, [viewDate]);

  // Listen for interaction-saved event to refresh the list
  useEffect(() => {
    const handleInteractionSaved = () => {
      load(search, pagination.page, viewDate);
    };
    window.addEventListener('interaction-saved', handleInteractionSaved);
    return () => {
      window.removeEventListener('interaction-saved', handleInteractionSaved);
    };
  }, [load, search, pagination.page, viewDate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(search, 1, viewDate);
  };

  // Date navigation helpers
  const shiftDate = (days: number) => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + days);
    const next = d.toISOString().slice(0, 10);
    setViewDate(next);
  };

  const isToday = viewDate === new Date().toISOString().slice(0, 10);

  const friendlyDate = (iso: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (iso === today) return 'Today';
    if (iso === yesterday) return 'Yesterday';
    return new Date(iso).toLocaleDateString('en-IN', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      {/* Header — only shown when standalone page */}
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Interaction Memory</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Track every candidate conversation — never lose context again
            </p>
          </div>
          <button
            onClick={() => openLogInteraction()}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} /> Log Interaction
          </button>
        </div>
      )}

      {/* Search + Log button */}
      <div className="flex gap-2">
        <form onSubmit={handleSearch} className="flex gap-1.5 flex-1 min-w-0">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or phone…"
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 transition-colors"
          >
            Search
          </button>
        </form>
        {embedded && (
          <button
            onClick={() => openLogInteraction()}
            className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-2 rounded-xl text-xs font-medium hover:bg-indigo-700 transition-colors flex-shrink-0"
            style={{ boxShadow: '0 2px 8px rgba(99,102,241,0.25)' }}
          >
            <Plus size={13} /> New
          </button>
        )}
      </div>

      {/* Date navigator */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => shiftDate(-1)}
          className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft size={13} className="text-slate-500" />
        </button>
        <div className="flex items-center gap-1.5 flex-1">
          <Calendar size={12} className="text-indigo-400" />
          <span className="text-xs font-semibold text-gray-700">{friendlyDate(viewDate)}</span>
          <span className="text-[10px] text-slate-400">{viewDate}</span>
        </div>
        <button
          onClick={() => shiftDate(1)}
          disabled={isToday}
          className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={13} className="text-slate-500" />
        </button>
        {!isToday && (
          <button
            onClick={() => setViewDate(new Date().toISOString().slice(0, 10))}
            className="text-[10px] text-indigo-500 hover:text-indigo-600 font-medium"
          >
            Today
          </button>
        )}
        <span className="ml-auto text-[10px] text-slate-400">
          {pagination.total} on this day
        </span>
      </div>

      {/* Candidate cards */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-10 rounded-2xl" style={{ background: 'rgba(248,250,252,0.8)' }}>
          <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Users size={18} className="text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">No interactions on {friendlyDate(viewDate)}</p>
          <button
            onClick={() => openLogInteraction()}
            className="mt-2 text-xs text-indigo-500 hover:text-indigo-600 font-medium"
          >
            Log one now →
          </button>
        </div>
      ) : (
        <div className={`grid gap-3 ${embedded ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
          {candidates.map(c => (
            <div
              key={c.id}
              className="group bg-white rounded-2xl p-4 cursor-pointer transition-all duration-200"
              style={{
                boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow =
                  '0 4px 12px rgba(0,0,0,0.08), 0 12px 28px rgba(99,102,241,0.08)';
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow =
                  '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)';
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
              }}
              onClick={() => {
                setSelected(c);
                openHistory();
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 truncate text-sm">{c.name}</h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Phone size={11} /> {c.phone}
                  </p>
                  {c.email && (
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                      <Mail size={10} /> {c.email}
                    </p>
                  )}
                </div>
                <ChevronRight
                  size={14}
                  className="text-slate-200 group-hover:text-indigo-400 transition-colors flex-shrink-0 mt-0.5"
                />
              </div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {c.latest_status && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.latest_status] || 'bg-slate-100 text-slate-500'}`}>
                    {c.latest_status}
                  </span>
                )}
                <span className="text-[11px] text-slate-400 ml-auto">
                  {c.note_count || 0} note{(c.note_count || 0) !== 1 ? 's' : ''}
                </span>
              </div>

              {c.latest_follow_up && (
                <p className="text-[11px] text-blue-500 mt-2 flex items-center gap-1">
                  <Calendar size={10} /> Follow-up:{' '}
                  {new Date(c.latest_follow_up).toLocaleDateString()}
                </p>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                <span className="text-[11px] text-slate-400">{c.source}</span>
                <span className="text-[11px] text-slate-400">
                  {new Date(c.updated_at).toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short',
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Record-level pagination (within a day) */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            disabled={pagination.page <= 1}
            onClick={() => load(search, pagination.page - 1, viewDate)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            {pagination.page} / {pagination.pages}
          </span>
          <button
            disabled={pagination.page >= pagination.pages}
            onClick={() => load(search, pagination.page + 1, viewDate)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Timeline drawer */}
      {isHistoryOpen && selected && (
        <TimelineDrawer 
          candidate={selected} 
          onClose={() => {
            setSelected(null);
            closeHistory();
          }} 
        />
      )}
    </div>
  );
}
