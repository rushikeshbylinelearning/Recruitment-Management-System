import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, Download, Trash2, CheckSquare, Square, X } from 'lucide-react';
import { candidatesAPI, Candidate as ApiCandidate, jobsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import AddCandidateModal from './AddCandidateModal';
import CandidateImportContainer from './import/CandidateImportContainer';
import CandidateViewModal from './CandidateViewModal';
import KanbanBoard from './kanban/KanbanBoard';
import FilterPanel, { FilterState, DEFAULT_FILTERS } from './kanban/FilterPanel';
import Toast from './ui/Toast';

const STAGES = [
  // Main stages
  'Applied',
  'Follow Up',
  'Screening',
  'Interview',
  // Interview sub-stages
  'Follow Up (Interview)',
  'Came Down',
  'Didn\'t Come',
  'Selected (Interview)',
  'Rejected (Interview)',
  // Continue main stages
  'Offer',
  'Hired',
  'Rejected',
  // Rejected sub-stages
  'On Hold',
  'Profile Not Matched',
  'Last Minute Back Out',
] as const;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const parseNumber = (value?: string) => {
  if (!value) return null;
  const normalized = value.replace(/[^0-9.]/g, '');
  if (!normalized) return null;
  const n = Number.parseFloat(normalized);
  return Number.isNaN(n) ? null : n;
};

export default function CandidatesNew() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [candidates, setCandidates] = useState<ApiCandidate[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<ApiCandidate | null>(null);
  const [editingCandidate, setEditingCandidate] = useState<ApiCandidate | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const candidatesRef = useRef<ApiCandidate[]>([]);
  candidatesRef.current = candidates;

  const stages = STAGES;

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [candidatesResponse, jobsResponse] = await Promise.all([
          candidatesAPI.getCandidates({ limit: 200 }),
          jobsAPI.getJobs({ limit: 50 }),
        ]);
        if (candidatesResponse.success && candidatesResponse.data) {
          setCandidates(candidatesResponse.data.candidates || []);
        } else {
          setError('Failed to load candidates');
        }
        if (jobsResponse.success && jobsResponse.data) {
          setJobs(jobsResponse.data.jobs || []);
        }
      } catch {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Handle automatic drawer opening from query parameter
  useEffect(() => {
    const candidateId = searchParams.get('id');
    if (candidateId && candidates.length > 0 && !loading) {
      // Find the candidate by ID (could be string UUID or number)
      const candidate = candidates.find(c => String(c.id) === candidateId);
      if (candidate) {
        // Open the candidate drawer
        setSelectedCandidate(candidate);
        setShowViewModal(true);
        // Clear the query parameter after opening
        setSearchParams({});
      }
    }
  }, [searchParams, candidates, loading, setSearchParams]);

  const debouncedSearch = useDebounced(filters.search, 200);

  const filteredCandidates = useMemo(() => {
    const term = debouncedSearch.toLowerCase();
    return candidates.filter((c) => {
      if (term && !(
        (c.name || '').toLowerCase().includes(term) ||
        (c.email || '').toLowerCase().includes(term) ||
        (c.phone || '').toLowerCase().includes(term) ||
        (c.position || '').toLowerCase().includes(term)
      )) return false;

      if (filters.stages.length > 0 && !filters.stages.includes(c.stage)) return false;

      if (filters.role && !c.position?.toLowerCase().includes(filters.role.toLowerCase())) return false;

      if (filters.location && !c.location?.toLowerCase().includes(filters.location.toLowerCase())) return false;

      if (filters.source && c.source !== filters.source) return false;

      if (filters.immediateJoiner && !c.availability?.immediateJoiner) return false;

      if (filters.noticePeriod && c.availability?.noticePeriod !== filters.noticePeriod) return false;

      const appliedDate = c.appliedDate ? new Date(c.appliedDate) : null;
      if (filters.appliedDateFrom) {
        const from = new Date(filters.appliedDateFrom);
        if (!appliedDate || appliedDate < from) return false;
      }
      if (filters.appliedDateTo) {
        const to = new Date(filters.appliedDateTo);
        to.setHours(23, 59, 59, 999);
        if (!appliedDate || appliedDate > to) return false;
      }

      const minExp = parseNumber(filters.experienceMin);
      const maxExp = parseNumber(filters.experienceMax);
      const candidateExp = parseNumber(c.experience);
      if (minExp !== null && (candidateExp === null || candidateExp < minExp)) return false;
      if (maxExp !== null && (candidateExp === null || candidateExp > maxExp)) return false;

      const minCtc = parseNumber(filters.expectedCtcMin);
      const maxCtc = parseNumber(filters.expectedCtcMax);
      const candidateExpectedCtc = parseNumber(c.salary?.expected);
      if (minCtc !== null && (candidateExpectedCtc === null || candidateExpectedCtc < minCtc)) return false;
      if (maxCtc !== null && (candidateExpectedCtc === null || candidateExpectedCtc > maxCtc)) return false;

      return true;
    });
  }, [candidates, debouncedSearch, filters]);

  const candidatesByStage = useMemo(() => {
    const map: Record<string, ApiCandidate[]> = {};
    for (const stage of stages) map[stage] = [];
    for (const c of filteredCandidates) {
      if (map[c.stage]) map[c.stage].push(c);
    }
    // Sort each column by newest first (appliedDate descending)
    for (const stage of stages) {
      map[stage].sort((a, b) => {
        const dateA = new Date(a.appliedDate).getTime();
        const dateB = new Date(b.appliedDate).getTime();
        return dateB - dateA; // Descending order (newest first)
      });
    }
    return map;
  }, [stages, filteredCandidates]);

  const handleStageChange = useCallback(async (candidateId: string, newStage: string) => {
    const validStages: ApiCandidate['stage'][] = [
      'Applied', 'Follow Up', 'Screening', 'Interview', 'Offer', 'Hired',
      'On Hold', 'Rejected', 'No Show - Interview', 'No Show - Onboarding', 'Last Minute Back Out', 'Profile Not Matched',
    ];
    if (!validStages.includes(newStage as ApiCandidate['stage'])) {
      setToast({ message: 'Invalid stage', type: 'error' });
      return;
    }
    const typedStage = newStage as ApiCandidate['stage'];
    const candidate = candidatesRef.current.find((c) => c.id === candidateId);
    if (!candidate) return;
    const previousStage = candidate.stage;

    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, stage: typedStage } : c))
    );

    try {
      const response = await candidatesAPI.updateCandidateStage(candidateId, typedStage);
      if (response.success) {
        setToast({
          message: `${candidate.name} → ${typedStage}${response.data?.automationTriggered ? ' · Automation triggered' : ''}`,
          type: 'success',
        });
      } else {
        setCandidates((prev) =>
          prev.map((c) => (c.id === candidateId ? { ...c, stage: previousStage } : c))
        );
        setToast({ message: 'Failed to update stage', type: 'error' });
      }
    } catch {
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidateId ? { ...c, stage: previousStage } : c))
      );
      setToast({ message: 'Failed to update stage', type: 'error' });
    }
  }, []);

  const handleViewCandidate = useCallback((candidate: ApiCandidate) => {
    setSelectedCandidate(candidate);
    setShowViewModal(true);
  }, []);

  const handleEditCandidate = useCallback((candidate: ApiCandidate) => {
    setEditingCandidate(candidate);
    setShowAddModal(true);
  }, []);

  const handleDeleteCandidate = useCallback(async (candidateId: string) => {
    if (!confirm('Are you sure you want to delete this candidate?')) return;
    try {
      const response = await candidatesAPI.deleteCandidate(candidateId);
      if (response.success) {
        setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
        setToast({ message: 'Candidate deleted', type: 'success' });
      } else {
        setToast({ message: 'Failed to delete candidate', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to delete candidate', type: 'error' });
    }
  }, []);

  const handleToggleSelect = useCallback((candidateId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(filteredCandidates.map(c => c.id)));
  }, [filteredCandidates]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleExitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} candidate(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const response = await candidatesAPI.bulkDeleteCandidates(Array.from(selectedIds));
      if (response.success) {
        setCandidates(prev => prev.filter(c => !selectedIds.has(c.id)));
        setToast({ message: `${response.data?.deletedCount ?? selectedIds.size} candidates deleted`, type: 'success' });
        setSelectedIds(new Set());
        setSelectionMode(false);
      } else {
        setToast({ message: 'Failed to delete candidates', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to delete candidates', type: 'error' });
    } finally {
      setBulkDeleting(false);
    }
  }, [selectedIds]);

  const handleDownloadResume = useCallback(async (candidateId: string) => {
    try {
      const blob = await candidatesAPI.downloadResume(candidateId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const metadataResponse = await candidatesAPI.getResumeMetadata(candidateId);
      link.download = metadataResponse.data?.originalName || `resume_${candidateId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      setToast({ message: 'Failed to download resume', type: 'error' });
    }
  }, []);

  const editingCandidateRef = useRef<ApiCandidate | null>(null);
  editingCandidateRef.current = editingCandidate;

  const handleUpdateCandidate = useCallback(async (candidateData: any) => {
    const editing = editingCandidateRef.current;
    try {
      setLoading(true);
      if (editing && editing.id) {
        const response = await candidatesAPI.updateCandidate(editing.id, candidateData);
        if (response.success) {
          setCandidates((prev) =>
            prev.map((c) => (c.id === editing.id ? { ...c, ...candidateData } : c))
          );
          setEditingCandidate(null);
          setShowAddModal(false);
          setToast({ message: 'Candidate updated', type: 'success' });
        } else {
          setToast({ message: 'Failed to update candidate', type: 'error' });
        }
      } else {
        const response = await candidatesAPI.createCandidate(candidateData);
        if (response.success) {
          const res = await candidatesAPI.getCandidates({ limit: 200 });
          if (res.success && res.data) setCandidates(res.data.candidates || []);
          setShowAddModal(false);
          setToast({ message: 'Candidate created', type: 'success' });
        } else {
          setToast({ message: 'Failed to create candidate', type: 'error' });
        }
      }
    } catch {
      setToast({ message: 'Failed to save candidate', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImportComplete = useCallback(async () => {
    try {
      setLoading(true);
      const res = await candidatesAPI.getCandidates({ limit: 200 });
      if (res.success && res.data) {
        setCandidates(res.data.candidates || []);
        setToast({ message: 'Candidates imported successfully', type: 'success' });
      }
    } catch {
      setToast({ message: 'Failed to reload candidates', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  const getExportFilename = (contentDisposition: string | undefined, fallback: string) => {
    if (!contentDisposition) return fallback;
    const match = contentDisposition.match(/filename="?([^"]+)"?/i);
    return match?.[1] || fallback;
  };

  const extractErrorMessage = async (err: any) => {
    const blob = err?.response?.data;
    if (blob instanceof Blob) {
      try {
        const text = await blob.text();
        const parsed = JSON.parse(text);
        return parsed?.message || 'Export failed';
      } catch {
        return 'Export failed';
      }
    }
    return err?.response?.data?.message || 'Export failed';
  };

  const handleExport = useCallback(async (format: 'excel' | 'pdf') => {
    try {
      if (filteredCandidates.length === 0) {
        setToast({ message: 'No candidates to export', type: 'error' });
        return;
      }

      setExportLoading(true);
      if (filteredCandidates.length > 1000) {
        setToast({ message: 'Preparing download...', type: 'success' });
      }

      const exportResponse = await candidatesAPI.exportCandidates({
        search: filters.search || undefined,
        stage: filters.stages.length ? filters.stages : undefined,
        role: filters.role || undefined,
        location: filters.location || undefined,
        source: filters.source || undefined,
        minExperience: filters.experienceMin || undefined,
        maxExperience: filters.experienceMax || undefined,
        minCTC: filters.expectedCtcMin || undefined,
        maxCTC: filters.expectedCtcMax || undefined,
        startDate: filters.appliedDateFrom || undefined,
        endDate: filters.appliedDateTo || undefined,
        appliedDateFrom: filters.appliedDateFrom || undefined,
        appliedDateTo: filters.appliedDateTo || undefined,
        format
      });

      const dateStamp = new Date().toISOString().slice(0, 10);
      const fallback = `Candidates_Export_${dateStamp}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      const contentDisposition = exportResponse.headers['content-disposition'] as string | undefined;
      const filename = getExportFilename(contentDisposition, fallback);

      const url = window.URL.createObjectURL(exportResponse.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setToast({ message: `${format === 'excel' ? 'Excel' : 'PDF'} downloaded`, type: 'success' });
    } catch (err: any) {
      const message = await extractErrorMessage(err);
      setToast({ message, type: 'error' });
    } finally {
      setExportLoading(false);
    }
  }, [filteredCandidates.length, filters]);

  const activeFilterCount = [
    filters.search,
    filters.stages.length > 0,
    filters.role,
    filters.location,
    filters.source,
    filters.experienceMin,
    filters.experienceMax,
    filters.expectedCtcMin,
    filters.expectedCtcMax,
    filters.currentCtcMin,
    filters.currentCtcMax,
    filters.immediateJoiner,
    filters.noticePeriod,
    filters.appliedDateFrom,
    filters.appliedDateTo,
  ].filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading candidates...</p>
        </div>
      </div>
    );
  }

  const getActiveFilterChips = () => {
    const chips: { label: string; onRemove: () => void }[] = [];
    
    if (filters.search) {
      chips.push({ label: `Search: "${filters.search}"`, onRemove: () => setFilters({ ...filters, search: '' }) });
    }
    if (filters.stages.length > 0) {
      filters.stages.forEach(stage => {
        chips.push({ label: stage, onRemove: () => setFilters({ ...filters, stages: filters.stages.filter(s => s !== stage) }) });
      });
    }
    if (filters.location) {
      chips.push({ label: `Location: ${filters.location}`, onRemove: () => setFilters({ ...filters, location: '' }) });
    }
    if (filters.role) {
      chips.push({ label: `Role: ${filters.role}`, onRemove: () => setFilters({ ...filters, role: '' }) });
    }
    if (filters.source) {
      chips.push({ label: `Source: ${filters.source}`, onRemove: () => setFilters({ ...filters, source: '' }) });
    }
    if (filters.immediateJoiner) {
      chips.push({ label: 'Immediate Joiner', onRemove: () => setFilters({ ...filters, immediateJoiner: false }) });
    }
    if (filters.noticePeriod) {
      chips.push({ label: `Notice: ${filters.noticePeriod}`, onRemove: () => setFilters({ ...filters, noticePeriod: '' }) });
    }
    if (filters.appliedDateFrom || filters.appliedDateTo) {
      const from = filters.appliedDateFrom || 'Any';
      const to = filters.appliedDateTo || 'Any';
      chips.push({
        label: `Applied: ${from} - ${to}`,
        onRemove: () => setFilters({ ...filters, appliedDateFrom: '', appliedDateTo: '' })
      });
    }
    
    return chips;
  };

  const activeChips = getActiveFilterChips();

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex-shrink-0">
          {error}
        </div>
      )}

      {/* Active Filter Chips */}
      {activeChips.length > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap flex-shrink-0">
          <span className="text-xs font-medium text-gray-500">Active Filters:</span>
          {activeChips.map((chip, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-100"
            >
              {chip.label}
              <button
                onClick={chip.onRemove}
                className="hover:bg-indigo-100 rounded-full p-0.5 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex-1 min-h-0">
        <KanbanBoard
          stages={stages as unknown as string[]}
          candidatesByStage={candidatesByStage}
          onStageChange={handleStageChange}
          onCandidateClick={handleViewCandidate}
          onCandidateEdit={handleEditCandidate}
          onCandidateDelete={handleDeleteCandidate}
          onDownloadResume={handleDownloadResume}
          hasEditPermission={hasPermission('candidates', 'edit')}
          hasDeletePermission={hasPermission('candidates', 'delete')}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
        />
      </div>

      {/* Floating Action Buttons - BOTTOM RIGHT */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-center gap-3">
        {/* Select Mode Toggle */}
        {hasPermission('candidates', 'delete') && !selectionMode && (
          <button
            onClick={() => setSelectionMode(true)}
            className="w-14 h-14 bg-white text-gray-700 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center group border border-gray-200"
            title="Select candidates to delete"
          >
            <CheckSquare size={20} className="text-gray-600" />
          </button>
        )}

        {/* Filter Button */}
        <button
          onClick={() => setFilterPanelOpen(true)}
          className="relative w-14 h-14 bg-white text-gray-700 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center group border border-gray-200"
          title="Open filters"
        >
          <SlidersHorizontal size={20} className="group-hover:rotate-90 transition-transform duration-200" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow-md animate-pulse">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Export Button */}
        <button
          onClick={() => handleExport('excel')}
          disabled={exportLoading}
          className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl hover:shadow-2xl hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          title="Export candidates"
          style={{ boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.4)' }}
        >
          <Download size={20} />
        </button>
      </div>

      {/* Bulk Delete Action Bar — appears at bottom when in selection mode */}
      {selectionMode && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-2xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleExitSelectionMode}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Exit selection mode"
            >
              <X size={20} />
            </button>
            <span className="text-sm font-semibold text-gray-700">
              {selectedIds.size > 0
                ? `${selectedIds.size} candidate${selectedIds.size > 1 ? 's' : ''} selected`
                : 'Click cards to select'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <CheckSquare size={16} />
              Select All ({filteredCandidates.length})
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={handleClearSelection}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Square size={16} />
                Clear
              </button>
            )}
            <button
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0 || bulkDeleting}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
            >
              {bulkDeleting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              {bulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size > 0 ? selectedIds.size : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      <FilterPanel
        open={filterPanelOpen}
        filters={filters}
        stages={stages as unknown as string[]}
        onClose={() => setFilterPanelOpen(false)}
        onChange={setFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
        hasCreatePermission={hasPermission('candidates', 'create')}
        onImport={() => setShowBulkImportModal(true)}
        onAddCandidate={() => setShowAddModal(true)}
        totalCandidates={filteredCandidates.length}
        onExportExcel={() => handleExport('excel')}
        onExportPdf={() => handleExport('pdf')}
        exportLoading={exportLoading}
      />

      {/* Modals */}
      {showAddModal && (
        <AddCandidateModal
          isOpen={showAddModal}
          onClose={() => { setShowAddModal(false); setEditingCandidate(null); }}
          onSubmit={handleUpdateCandidate}
          editingCandidate={editingCandidate}
          jobs={jobs}
        />
      )}
      {showBulkImportModal && (
        <CandidateImportContainer
          isOpen={showBulkImportModal}
          onClose={() => setShowBulkImportModal(false)}
          onImportComplete={handleImportComplete}
        />
      )}
      {showViewModal && selectedCandidate && (
        <CandidateViewModal
          isOpen={showViewModal}
          onClose={() => { setShowViewModal(false); setSelectedCandidate(null); }}
          candidate={selectedCandidate}
          onEdit={(candidate) => {
            setShowViewModal(false);
            setSelectedCandidate(null);
            handleEditCandidate(candidate as ApiCandidate);
          }}
        />
      )}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}