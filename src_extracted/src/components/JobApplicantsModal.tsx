import { useState, useEffect, useMemo } from 'react';
import {
  X, Eye, Edit, Trash2, Plus, Search, MessageSquare,
  ChevronDown, ChevronUp, Send, Clock, Upload, Calendar,
  ChevronRight, ArrowLeft, Users,
} from 'lucide-react';
import { JobPosting, Candidate } from '../types';
import { candidatesAPI, hrNotesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/JobApplicantsModal.css';
import '../styles/JobModalAnimations.css';

interface HrNote {
  id: number;
  candidate_id: string;
  stage: string;
  note_text: string;
  interaction_type: string;
  author_name: string;
  author_role: string | null;
  created_at: string;
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

interface JobApplicantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobPosting;
  matchedJobIds?: number[];
  onAddCandidate: () => void;
  onViewApplicantDetails?: (applicant: Candidate) => void;
  onEditApplicant?: (applicant: Candidate) => void;
  onBulkImport?: () => void;
}

export default function JobApplicantsModal({
  isOpen, onClose, job, matchedJobIds,
  onAddCandidate, onViewApplicantDetails, onEditApplicant, onBulkImport,
}: JobApplicantsModalProps) {
  const { hasPermission } = useAuth();
  const [applicants, setApplicants] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('All');

  // Year + month navigation (year derived from actual data)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Notes state
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [notesMap, setNotesMap] = useState<Record<string, HrNote[]>>({});
  const [notesLoading, setNotesLoading] = useState<Record<string, boolean>>({});
  const [newNoteText, setNewNoteText] = useState<Record<string, string>>({});
  const [newNoteType, setNewNoteType] = useState<Record<string, string>>({});
  const [noteSubmitting, setNoteSubmitting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen && job) loadApplicants();
  }, [isOpen, job]);

  useEffect(() => {
    if (isOpen) {
      // Auto-select current month on open; year will be set after data loads
      const currentMonth = new Date().getMonth();
      setSelectedMonth(currentMonth);
      setSelectedYear(new Date().getFullYear());
      setSearchTerm('');
      setStageFilter('All');
    }
  }, [isOpen]);

  // -- helpers --------------------------------------------------------------
  const getAppliedYear = (c: Candidate) => {
    const d = c.appliedDate ? new Date(c.appliedDate) : null;
    return d && !isNaN(d.getTime()) ? d.getFullYear() : -1;
  };

  const getMonth = (c: Candidate) => {
    const d = c.appliedDate ? new Date(c.appliedDate) : null;
    return d && !isNaN(d.getTime()) ? d.getMonth() : -1;
  };

  /** All years that have at least one applicant, sorted descending */
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    applicants.forEach(c => {
      const y = getAppliedYear(c);
      if (y > 0) yearSet.add(y);
    });
    const sorted = Array.from(yearSet).sort((a, b) => b - a);
    return sorted.length > 0 ? sorted : [new Date().getFullYear()];
  }, [applicants]);

  // When applicants load, snap selectedYear to the most recent year that has data
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears]);

  /** Month groups for the currently selected year */
  const monthGroups = useMemo(() => {
    const map: Record<number, number> = {};
    applicants.forEach(c => {
      if (getAppliedYear(c) === selectedYear) {
        const m = getMonth(c);
        if (m >= 0) map[m] = (map[m] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([m, n]) => ({ month: Number(m), count: n }))
      .sort((a, b) => b.month - a.month);
  }, [applicants, selectedYear]);

  // Auto-select first available month when year changes
  useEffect(() => {
    if (monthGroups.length > 0) {
      const currentMonth = new Date().getMonth();
      const hasCurrentMonth = monthGroups.some(g => g.month === currentMonth);
      setSelectedMonth(hasCurrentMonth ? currentMonth : monthGroups[0].month);
    } else {
      setSelectedMonth(null);
    }
  }, [selectedYear, monthGroups.length]);

  const filteredApplicants = useMemo(() => {
    let list = applicants.filter(c => getAppliedYear(c) === selectedYear);
    if (selectedMonth !== null) {
      list = list.filter(c => getMonth(c) === selectedMonth);
    }
    return list.filter(c => {
      const s = searchTerm.toLowerCase();
      return ((c.name || '').toLowerCase().includes(s) || (c.email || '').toLowerCase().includes(s))
        && (stageFilter === 'All' || c.stage === stageFilter);
    });
  }, [applicants, selectedYear, selectedMonth, searchTerm, stageFilter]);

  // -- data -----------------------------------------------------------------
  const loadApplicants = async () => {
    try {
      setLoading(true); setError('');

      const mergedById = new Map<string, any>();

      let byCard: any[] = [];
      try {
        const cr = await candidatesAPI.getCandidatesByJobCardTitle(job.title);
        if (cr.success && cr.data?.candidates?.length) {
          byCard = cr.data.candidates;
        }
      } catch {
        /* not a mapped dashboard card or request failed — fall back to job_id only */
      }
      for (const c of byCard) {
        const id = String(c.id || '');
        if (!id) continue;
        mergedById.set(id, {
          ...c,
          id,
          appliedDate: c.appliedDate || c.applied_date || '',
        });
      }

      const jobIds: number[] = [];
      if (job.id > 0) jobIds.push(job.id);
      if (matchedJobIds && matchedJobIds.length > 0) {
        matchedJobIds.forEach(id => { if (!jobIds.includes(id)) jobIds.push(id); });
      }

      if (jobIds.length > 0) {
        for (const jid of jobIds) {
          try {
            const r = await candidatesAPI.getCandidatesByJob(jid);
            if (r.success && r.data) {
              for (const c of r.data.candidates || []) {
                const id = String(c.id || '');
                if (!id || mergedById.has(id)) continue;
                mergedById.set(id, {
                  ...c,
                  id,
                  appliedDate: c.appliedDate || c.applied_date || '',
                });
              }
            }
          } catch { /* skip failed job */ }
        }
      }

      if (mergedById.size > 0) {
        setApplicants(Array.from(mergedById.values()));
        return;
      }

      const r = await candidatesAPI.getCandidates({ limit: 1000 } as any);
      if (r.success && r.data) {
        setApplicants(r.data.candidates.filter((c: any) => c.position === job.title).map((c: any) => ({ ...c, id: String(c.id || '') })));
      } else setError('Failed to load applicants');
    } catch { setError('Failed to load applicants'); }
    finally { setLoading(false); }
  };

  const handleDeleteApplicant = async (id: string) => {
    if (!id || !window.confirm('Delete this applicant?')) return;
    const r = await candidatesAPI.deleteCandidate(id);
    if (r.success) setApplicants(p => p.filter(a => a.id !== id));
    else setError('Failed to delete applicant');
  };

  const handleDeleteMonthApplicants = async (month: number) => {
    const monthApplicants = applicants.filter(c => getAppliedYear(c) === selectedYear && getMonth(c) === month);
    const monthName = MONTH_NAMES[month];
    
    if (monthApplicants.length === 0) {
      alert('No applicants found for this month.');
      return;
    }

    const confirmMessage = `Are you sure you want to delete all ${monthApplicants.length} applicant${monthApplicants.length !== 1 ? 's' : ''} from ${monthName} ${selectedYear}?\n\nThis action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) return;

    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const applicant of monthApplicants) {
      if (applicant.id) {
        try {
          const r = await candidatesAPI.deleteCandidate(applicant.id);
          if (r.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }
    }

    setLoading(false);

    if (successCount > 0) {
      setApplicants(p => p.filter(a => !(getAppliedYear(a) === selectedYear && getMonth(a) === month)));
      alert(`Successfully deleted ${successCount} applicant${successCount !== 1 ? 's' : ''} from ${monthName} ${selectedYear}.${failCount > 0 ? `\n${failCount} deletion(s) failed.` : ''}`);
    } else {
      setError(`Failed to delete applicants from ${monthName}.`);
    }
  };

  const toggleNotes = async (key: string, candidateId: string) => {
    if (expandedNotes.has(key)) {
      setExpandedNotes(p => { const n = new Set(p); n.delete(key); return n; });
    } else {
      setExpandedNotes(p => new Set(p).add(key));
      if (candidateId && !notesMap[candidateId]) await loadNotes(candidateId);
    }
  };

  const loadNotes = async (candidateId: string) => {
    if (!candidateId) return;
    setNotesLoading(p => ({ ...p, [candidateId]: true }));
    try {
      const r = await hrNotesAPI.getCandidateHRNotes(candidateId);
      if (r.success && r.data) {
        const notes: HrNote[] = (Object.values(r.data.notesByStage || {}) as any[]).flat()
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setNotesMap(p => ({ ...p, [candidateId]: notes }));
      }
    } catch { /* ignore */ }
    finally { setNotesLoading(p => ({ ...p, [candidateId]: false })); }
  };

  const handleAddNote = async (candidateId: string) => {
    const text = (newNoteText[candidateId] || '').trim();
    if (!candidateId || !text) return;
    setNoteSubmitting(p => ({ ...p, [candidateId]: true }));
    try {
      const r = await hrNotesAPI.createHRNote(candidateId, {
        note_text: text, interaction_type: (newNoteType[candidateId] || 'General Note') as any,
      });
      if (r.success) {
        await loadNotes(candidateId);
        setNewNoteText(p => ({ ...p, [candidateId]: '' }));
        setNewNoteType(p => ({ ...p, [candidateId]: 'General Note' }));
      }
    } catch { /* ignore */ }
    finally { setNoteSubmitting(p => ({ ...p, [candidateId]: false })); }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Applied':    return 'bg-blue-100 text-blue-700';
      case 'Screening':  return 'bg-yellow-100 text-yellow-700';
      case 'Interview':  return 'bg-purple-100 text-purple-700';
      case 'Offer':      return 'bg-green-100 text-green-700';
      case 'Hired':      return 'bg-emerald-100 text-emerald-700';
      case 'Rejected':   return 'bg-red-100 text-red-700';
      default:           return 'bg-gray-100 text-gray-600';
    }
  };

  const getInteractionTypeColor = (type: string) => {
    switch (type) {
      case 'Phone Call':  return 'text-blue-600';
      case 'Email':       return 'text-green-600';
      case 'Interview':   return 'text-purple-600';
      case 'Stage Change':return 'text-orange-600';
      case 'System Event':return 'text-gray-500';
      default:            return 'text-gray-600';
    }
  };

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });

  const fmtApplied = (s: string) =>
    s ? new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '-';

  if (!isOpen) return null;

  return (
    <div className="job-applicants-modal-container">
      <div className="job-applicants-modal-content">

        {/* -- Header -- */}
        <div className="job-applicants-modal-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-white leading-tight">
                Applicants for &quot;{job.title}&quot;
              </h2>
              <div className="flex items-center gap-2 text-purple-100 text-sm mt-0.5">
                <span>All Years</span>
                <ChevronRight size={14} />
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="bg-white/20 text-white border border-white/30 rounded px-2 py-0.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
                >
                  {availableYears.map(y => (
                    <option key={y} value={y} className="text-gray-800 bg-white">{y}</option>
                  ))}
                </select>
                {selectedMonth !== null && (
                  <>
                    <ChevronRight size={14} />
                    <span className="text-white font-medium">{MONTH_NAMES[selectedMonth]}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onBulkImport && hasPermission('candidates', 'create') && (
              <button
                onClick={() => { onClose(); setTimeout(() => onBulkImport!(), 80); }}
                className="flex items-center gap-2 border-2 border-white/50 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Upload size={16} />
                <span>Bulk Import</span>
              </button>
            )}
            {hasPermission('candidates', 'create') && (
              <button
                onClick={onAddCandidate}
                className="flex items-center gap-2 bg-white text-purple-700 hover:bg-purple-50 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              >
                <Plus size={16} />
                <span>Add Candidate</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors ml-2"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* -- Body -- */}
        <div className="flex-1 min-h-0 flex flex-col" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-20 gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-3 border-purple-600" />
              <p className="text-gray-500 text-sm font-medium">Loading applicants...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <p className="text-red-500 font-medium">{error}</p>
              <button onClick={loadApplicants} className="text-sm text-purple-600 hover:underline font-medium">Try again</button>
            </div>
          ) : applicants.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center">
                <Users size={36} className="text-purple-400" />
              </div>
              <p className="text-gray-600 font-semibold text-lg">No applicants yet</p>
              {hasPermission('candidates', 'create') && (
                <div className="flex gap-3">
                  <button onClick={onAddCandidate} className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors shadow-md">
                    <Plus size={16} /><span>Add Candidate</span>
                  </button>
                  {onBulkImport && (
                    <button onClick={() => { onClose(); setTimeout(() => onBulkImport!(), 80); }} className="flex items-center gap-2 border-2 border-purple-300 text-purple-600 px-5 py-2.5 rounded-lg hover:bg-purple-50 text-sm font-medium transition-colors">
                      <Upload size={16} /><span>Bulk Import</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* -- Two-panel layout: sidebar months + right candidates -- */
            <div className="flex flex-1 min-h-0 overflow-hidden">

              {/* Left sidebar – month list */}
              <div className="job-applicants-month-sidebar job-applicants-modal-scrollbar">
                {monthGroups.map(({ month, count }) => {
                  const active = selectedMonth === month;
                  return (
                    <div key={month} className="relative group">
                      <button
                        onClick={() => setSelectedMonth(month)}
                        className={`job-applicants-month-card ${active ? 'active' : ''} w-full`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Calendar size={18} className={active ? 'text-purple-600' : 'text-gray-400'} />
                          <ChevronRight size={16} className={active ? 'text-purple-500' : 'text-gray-300'} />
                        </div>
                        <p className={`text-base font-bold leading-tight ${active ? 'text-purple-700' : 'text-gray-800'}`}>
                          {MONTH_NAMES[month]}
                        </p>
                        <p className={`text-sm mt-1 ${active ? 'text-purple-500' : 'text-gray-500'}`}>
                          {count} applicant{count !== 1 ? 's' : ''}
                        </p>
                      </button>
                      {hasPermission('candidates', 'delete') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMonthApplicants(month);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all shadow-md z-10"
                          title={`Delete all applicants from ${MONTH_NAMES[month]}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right panel – candidate list */}
              <div className="job-applicants-list-container">
                {/* Search + filter bar */}
                <div className="job-applicants-search-bar">
                  <div className="flex-1 relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search applicants..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={stageFilter}
                    onChange={e => setStageFilter(e.target.value)}
                    className="w-40 px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white font-medium"
                  >
                    <option value="All">All Stages</option>
                    <option value="Applied">Applied</option>
                    <option value="Screening">Screening</option>
                    <option value="Interview">Interview</option>
                    <option value="Offer">Offer</option>
                    <option value="Hired">Hired</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                {/* Candidate rows */}
                <div className="job-applicants-rows-container job-applicants-modal-scrollbar">
                  <div className="space-y-3">
                    {filteredApplicants.length === 0 ? (
                      <div className="job-applicants-empty-state text-gray-400">
                        <Users size={40} className="text-gray-300" />
                        <p className="text-base font-medium">No applicants match your filters.</p>
                      </div>
                    ) : (
                      <>
                        {filteredApplicants.map((applicant, idx) => {
                      const key = applicant.id || `legacy-${idx}`;
                      return (
                        <div key={key} className="job-applicants-candidate-card">
                          {/* Row */}
                          <div className="flex items-center gap-4 px-5 py-4">
                            {/* Avatar */}
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md">
                              <span className="text-white font-bold text-sm">
                                {applicant.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                              </span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 text-base truncate">{applicant.name}</p>
                              <p className="text-sm text-gray-600 truncate">{applicant.email}</p>
                              {applicant.phone && <p className="text-sm text-gray-500">{applicant.phone}</p>}
                            </div>

                            {/* Meta */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStageColor(applicant.stage)}`}>
                                {applicant.stage}
                              </span>
                              <span className="text-sm text-gray-500 whitespace-nowrap bg-gray-100 px-3 py-1 rounded-md">
                                Score: {applicant.score ?? 0}.0/10
                              </span>
                              <span className="text-sm text-gray-500 whitespace-nowrap">
                                {fmtApplied(applicant.appliedDate)}
                              </span>

                              {/* Actions */}
                              <div className="flex items-center gap-1 ml-2">
                                <button
                                  onClick={() => toggleNotes(key, applicant.id)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border-2 ${
                                    expandedNotes.has(key)
                                      ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                                      : 'text-indigo-600 border-indigo-300 hover:bg-indigo-50'
                                  }`}
                                >
                                  <MessageSquare size={14} />
                                  <span>Log Interaction</span>
                                  {expandedNotes.has(key) ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                                <button
                                  onClick={() => onViewApplicantDetails?.(applicant)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="View details"
                                >
                                  <Eye size={16} />
                                </button>
                                {hasPermission('candidates', 'edit') && (
                                  <button
                                    onClick={() => onEditApplicant?.(applicant)}
                                    disabled={!applicant.id}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-40"
                                    title="Edit"
                                  >
                                    <Edit size={16} />
                                  </button>
                                )}
                                {hasPermission('candidates', 'delete') && (
                                  <button
                                    onClick={() => handleDeleteApplicant(applicant.id)}
                                    disabled={!applicant.id}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                                    title="Delete"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Notes panel */}
                          {expandedNotes.has(key) && (
                            <div className="border-t border-gray-100 bg-indigo-50/30 p-4">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                <MessageSquare size={12} className="text-indigo-500" />
                                Interaction Log
                              </h4>
                              {!applicant.id ? (
                                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                  Legacy record � re-import to enable interaction logging.
                                </p>
                              ) : (
                                <>
                                  {hasPermission('candidates', 'edit') && (
                                    <div className="mb-3 bg-white rounded-xl p-3 border border-indigo-100 shadow-sm">
                                      <select
                                        value={newNoteType[applicant.id] || 'General Note'}
                                        onChange={e => setNewNoteType(p => ({ ...p, [applicant.id]: e.target.value }))}
                                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white mb-2 focus:ring-1 focus:ring-indigo-400"
                                      >
                                        <option>General Note</option>
                                        <option>Phone Call</option>
                                        <option>Email</option>
                                        <option>Interview</option>
                                        <option>Stage Change</option>
                                      </select>
                                      <div className="flex gap-2">
                                        <textarea
                                          rows={2}
                                          placeholder="Add a note or log an interaction..."
                                          value={newNoteText[applicant.id] || ''}
                                          onChange={e => setNewNoteText(p => ({ ...p, [applicant.id]: e.target.value }))}
                                          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddNote(applicant.id); }}
                                          className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 resize-none"
                                        />
                                        <button
                                          onClick={() => handleAddNote(applicant.id)}
                                          disabled={noteSubmitting[applicant.id] || !(newNoteText[applicant.id] || '').trim()}
                                          className="self-end px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                        >
                                          {noteSubmitting[applicant.id]
                                            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            : <Send size={13} />}
                                        </button>
                                      </div>
                                      <p className="text-xs text-gray-400 mt-1">Ctrl+Enter to submit</p>
                                    </div>
                                  )}
                                  {notesLoading[applicant.id] ? (
                                    <div className="flex justify-center py-3">
                                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
                                    </div>
                                  ) : (notesMap[applicant.id] || []).length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-2">No interactions logged yet.</p>
                                  ) : (
                                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                                      {(notesMap[applicant.id] || []).map(note => (
                                        <div key={note.id} className="flex gap-2.5 text-xs">
                                          <div className="w-6 h-6 rounded-full bg-indigo-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <span className="font-semibold text-indigo-700">{(note.author_name || 'U')[0]}</span>
                                          </div>
                                          <div className="flex-1 bg-white rounded-lg px-3 py-2 border border-gray-100 shadow-sm">
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="font-semibold text-gray-800">{note.author_name || 'Unknown'}</span>
                                              <div className="flex items-center gap-2">
                                                <span className={`font-medium ${getInteractionTypeColor(note.interaction_type)}`}>{note.interaction_type}</span>
                                                <span className="text-gray-400 flex items-center gap-0.5"><Clock size={9} />{fmtDate(note.created_at)}</span>
                                              </div>
                                            </div>
                                            <p className="text-gray-700 leading-relaxed">{note.note_text}</p>
                                            <span className="inline-block mt-1 text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Stage: {note.stage}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        );
                      })}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}