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

  const getStageBadgeClass = (stage: string) => {
    const normalized = (stage || '').toLowerCase();
    if (normalized === 'applied') return 'job-applicants-stage-badge--applied';
    if (['selected', 'hired', 'offer'].includes(normalized)) return 'job-applicants-stage-badge--selected';
    if (normalized === 'rejected') return 'job-applicants-stage-badge--rejected';
    if (['follow up', 'follow-up', 'screening'].includes(normalized)) return 'job-applicants-stage-badge--follow-up';
    if (normalized === 'interview') return 'job-applicants-stage-badge--interview';
    return 'job-applicants-stage-badge--default';
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
    <div
      className="job-applicants-modal-container"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="job-applicants-modal-content"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-applicants-modal-title"
      >

        {/* -- Header -- */}
        <div className="job-applicants-modal-header">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="job-applicants-header-btn job-applicants-header-btn--icon"
              aria-label="Go back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <h2 id="job-applicants-modal-title" className="job-applicants-header-title truncate">
                Applicants for &quot;{job.title}&quot;
              </h2>
              <div className="job-applicants-header-breadcrumb">
                <span>All Years</span>
                <ChevronRight size={14} aria-hidden />
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="job-applicants-header-year-select"
                  aria-label="Select year"
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                {selectedMonth !== null && (
                  <>
                    <ChevronRight size={14} aria-hidden />
                    <span>{MONTH_NAMES[selectedMonth]}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="job-applicants-header-actions">
            {onBulkImport && hasPermission('candidates', 'create') && (
              <button
                type="button"
                onClick={() => { onClose(); setTimeout(() => onBulkImport!(), 80); }}
                className="job-applicants-header-btn"
              >
                <Upload size={16} />
                <span>Bulk Import</span>
              </button>
            )}
            {hasPermission('candidates', 'create') && (
              <button
                type="button"
                onClick={onAddCandidate}
                className="job-applicants-header-btn job-applicants-header-btn--primary"
              >
                <Plus size={16} />
                <span>Add Candidate</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="job-applicants-header-btn job-applicants-header-btn--icon"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* -- Body -- */}
        <div className="flex-1 min-h-0 flex flex-col" style={{ overflow: 'hidden' }}>
          {loading ? (
            <div className="job-applicants-loading">
              <div className="job-applicants-spinner w-10 h-10" />
              <p>Loading applicants...</p>
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
            <div className="job-applicants-body-layout">

              {/* Left sidebar – month list */}
              <div className="job-applicants-month-sidebar job-applicants-modal-scrollbar">
                {monthGroups.map(({ month, count }) => {
                  const active = selectedMonth === month;
                  return (
                    <div key={month} className="relative job-applicants-month-item">
                      <button
                        type="button"
                        onClick={() => setSelectedMonth(month)}
                        className={`job-applicants-month-card ${active ? 'active' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <Calendar size={16} style={{ color: active ? '#475569' : '#9ca3af' }} aria-hidden />
                          <ChevronRight size={14} style={{ color: active ? '#64748b' : '#d1d5db' }} aria-hidden />
                        </div>
                        <p className="job-applicants-month-card__label">
                          {MONTH_NAMES[month]}
                        </p>
                        <p className="job-applicants-month-card__count">
                          {count} applicant{count !== 1 ? 's' : ''}
                        </p>
                      </button>
                      {hasPermission('candidates', 'delete') && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMonthApplicants(month);
                          }}
                          className="job-applicants-month-delete"
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
                  <div className="job-applicants-search-wrap">
                    <Search size={18} className="job-applicants-search-icon" aria-hidden />
                    <input
                      type="search"
                      placeholder="Search applicants..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="job-applicants-search-input"
                    />
                  </div>
                  <select
                    value={stageFilter}
                    onChange={e => setStageFilter(e.target.value)}
                    className="job-applicants-filter-select"
                    aria-label="Filter by stage"
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
                  <div className="job-applicants-candidate-list">
                    {filteredApplicants.length === 0 ? (
                      <div className="job-applicants-empty-state">
                        <Users size={40} strokeWidth={1.5} />
                        <p style={{ fontWeight: 600, color: '#6b7280' }}>No applicants match your filters.</p>
                      </div>
                    ) : (
                      <>
                        {filteredApplicants.map((applicant, idx) => {
                      const key = applicant.id || `legacy-${idx}`;
                      const notesExpanded = expandedNotes.has(key);
                      return (
                        <div key={key} className="job-applicants-candidate-card">
                          <div className="job-applicants-candidate-row">
                            {/* Avatar */}
                            <div className="job-applicants-avatar">
                              <span>
                                {applicant.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                              </span>
                            </div>

                            {/* Main content: two rows */}
                            <div className="job-applicants-candidate-body">

                              {/* Row 1 – identity */}
                              <div className="job-applicants-candidate-identity">
                                <p className="job-applicants-candidate-name">{applicant.name}</p>
                                <span className="job-applicants-candidate-contact">
                                  <span className="job-applicants-contact-email">{applicant.email}</span>
                                  {applicant.phone && (
                                    <>
                                      <span className="job-applicants-contact-sep">·</span>
                                      <span className="job-applicants-contact-phone">{applicant.phone}</span>
                                    </>
                                  )}
                                </span>
                              </div>

                              {/* Row 2 – info chips (left) + action buttons (right) */}
                              <div className="job-applicants-candidate-footer">

                                {/* Info chips */}
                                <div className="job-applicants-info-chips">
                                  <span className={`job-applicants-stage-badge ${getStageBadgeClass(applicant.stage)}`}>
                                    {applicant.stage}
                                  </span>
                                  <span className="job-applicants-date-text">
                                    {fmtApplied(applicant.appliedDate)}
                                  </span>
                                  {applicant.uploadedBy && (
                                    <span className="job-applicants-uploader-tag" title={`Uploaded by ${applicant.uploadedBy}`}>
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                        <circle cx="12" cy="7" r="4"/>
                                      </svg>
                                      {applicant.uploadedBy}
                                    </span>
                                  )}
                                </div>

                                {/* Action buttons */}
                                <div className="job-applicants-actions">
                                  <button
                                    type="button"
                                    onClick={() => toggleNotes(key, applicant.id)}
                                    className={`job-applicants-interaction-btn ${notesExpanded ? 'is-expanded' : ''}`}
                                  >
                                    <MessageSquare size={13} />
                                    <span>Log Interaction</span>
                                    {notesExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                  </button>

                                  <div className="job-applicants-icon-group">
                                    <button
                                      type="button"
                                      onClick={() => onViewApplicantDetails?.(applicant)}
                                      className="job-applicants-icon-btn job-applicants-icon-btn--view"
                                      title="View details"
                                    >
                                      <Eye size={15} />
                                    </button>
                                    {hasPermission('candidates', 'edit') && (
                                      <button
                                        type="button"
                                        onClick={() => onEditApplicant?.(applicant)}
                                        disabled={!applicant.id}
                                        className="job-applicants-icon-btn job-applicants-icon-btn--edit"
                                        title="Edit"
                                      >
                                        <Edit size={15} />
                                      </button>
                                    )}
                                    {hasPermission('candidates', 'delete') && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteApplicant(applicant.id)}
                                        disabled={!applicant.id}
                                        className="job-applicants-icon-btn job-applicants-icon-btn--delete"
                                        title="Delete"
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                              </div>
                            </div>
                          </div>

                          {notesExpanded && (
                            <div className="job-applicants-notes-panel">
                              <h4
                                className="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-1.5"
                                style={{ color: '#6b7280' }}
                              >
                                <MessageSquare size={12} style={{ color: '#64748b' }} aria-hidden />
                                Interaction Log
                              </h4>
                              {!applicant.id ? (
                                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                  Legacy record — re-import to enable interaction logging.
                                </p>
                              ) : (
                                <>
                                  {hasPermission('candidates', 'edit') && (
                                    <div className="mb-3 bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
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
                                          className="self-end px-3 py-2 text-white rounded-lg disabled:opacity-50 transition-colors"
                                          style={{ background: '#475569' }}
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
                                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1 job-applicants-modal-scrollbar">
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
                                            <p className="text-gray-700 leading-relaxed">{note.note_text || note.notes}</p>
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
