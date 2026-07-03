import { Mail, Phone, MapPin, Download, FileText, Calendar, Clock, Briefcase, DollarSign, Star, CheckCircle, XCircle, AlertCircle, User, Edit, Pencil, GitMerge } from 'lucide-react';
import { Candidate } from '../types';
import { candidatesAPI, assignmentsAPI, Assignment } from '../services/api';
import { useState, useEffect } from 'react';
import FileViewer, { ViewerFile } from './FileViewer';
import NotesPanel from './NotesPanel';
import HRNotesTimeline from './HRNotesTimeline';
import MergeReviewModal from './MergeReviewModal';
import '../styles/MergeReviewModal.css';

interface CandidateAssignmentNew {
  id: number;
  candidate_id: number;
  assignment_id: number;
  assignment_title: string;
  status: 'Assigned' | 'Submitted' | 'Reviewed' | 'Overdue';
  deadline: string;
  submitted_at?: string;
  email_status?: string;
  is_overdue?: number;
}

interface CandidateAssignmentFile {
  id: number;
  original_filename: string;
  stored_filename: string;
  mime_type: string;
  file_size: number;
}

interface CandidateViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  onEdit?: (candidate: Candidate) => void;
  onMerged?: () => void;
}

// Matches STAGE_ACCENTS in KanbanBoard.tsx exactly
const STAGE_ACCENTS: Record<string, string> = {
  Applied: '#dc2626',
  Screening: '#f59e0b',
  Interview: '#f97316',
  Offer: '#8b5cf6',
  Hired: '#10b981',
  Rejected: '#ef4444',
  'On Hold': '#6b7280',
  'No Show - Interview': '#ea580c',
  'No Show - Onboarding': '#ec4899',
  'Last Minute Back Out': '#dc2626',
};

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const toTitleCase = (value?: string | null): string => {
  if (!value) return '—';
  return normalizeWhitespace(value)
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const toCapitalizedWords = (value?: string | null): string => {
  if (!value) return '—';
  return normalizeWhitespace(value)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <span className="text-gray-500">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-4 py-1">{children}</div>
    </div>
  );
}

export default function CandidateViewModal({ isOpen, onClose, candidate, onEdit, onMerged }: CandidateViewModalProps) {
  const [mergeReviewOpen, setMergeReviewOpen] = useState(false);
  const [activityTimeline, setActivityTimeline] = useState<
    Array<{ type: string; date: string; title: string }>
  >([]);
  const [positionsList, setPositionsList] = useState<Array<{ position_name: string }>>([]);
  const [emailDuplicateMatches, setEmailDuplicateMatches] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [mergeTargets, setMergeTargets] = useState<{
    primaryId: string;
    duplicateId: string;
    primaryName: string;
  } | null>(null);
  const [mergeCluster, setMergeCluster] = useState<{
    primaryId: string;
    primaryName: string;
    duplicateIds: string[];
    allMatches: Array<{ id: string; name: string }>;
  } | null>(null);
  const [mergingAll, setMergingAll] = useState(false);
  const [mergeAllError, setMergeAllError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [freshCandidate, setFreshCandidate] = useState<Candidate | null>(null);
  const [notesPanelOpen, setNotesPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'hr-notes'>('details');

  // New candidate_assignments
  const [candidateAssignmentsNew, setCandidateAssignmentsNew] = useState<CandidateAssignmentNew[]>([]);
  const [caLoading, setCaLoading] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Record<number, CandidateAssignmentFile[]>>({});
  const [loadingFiles, setLoadingFiles] = useState<Record<number, boolean>>({});

  // File viewer
  const [viewerFiles, setViewerFiles] = useState<ViewerFile[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  
  // HR Notes refresh key
  const [hrNotesKey, setHrNotesKey] = useState(0);

  useEffect(() => {
    if (isOpen && candidate) {
      fetchFreshCandidateData();
      fetchAssignments();
      fetchCandidateAssignmentsNew();
      loadDuplicateCluster();
      // Reset to details tab when opening
      setActiveTab('details');
      // Refresh HR notes
      setHrNotesKey(prev => prev + 1);
    } else {
      setEmailDuplicateMatches([]);
      setMergeTargets(null);
      setMergeCluster(null);
      setMergeAllError(null);
    }
  }, [isOpen, candidate]);

  const loadDuplicateCluster = async () => {
    if (!candidate?.id) {
      setEmailDuplicateMatches([]);
      setMergeTargets(null);
      setMergeCluster(null);
      return;
    }
    try {
      const res = await candidatesAPI.getDuplicateCluster(candidate.id);
      const data = res.success && res.data ? res.data : null;
      const matches = data?.matches || [];
      const suggestedPrimaryId = data?.suggestedPrimaryId || null;
      const duplicateIds = data?.duplicateIds || [];

      if (matches.length < 2 || !suggestedPrimaryId || !duplicateIds.length) {
        setEmailDuplicateMatches([]);
        setMergeTargets(null);
        setMergeCluster(null);
        return;
      }

      const primary = matches.find((m) => m.id === suggestedPrimaryId) || matches[0];
      setMergeCluster({
        primaryId: suggestedPrimaryId,
        primaryName: primary.name,
        duplicateIds,
        allMatches: matches.map((m) => ({ id: m.id, name: m.name })),
      });
      setEmailDuplicateMatches(
        matches.filter((m) => m.id !== candidate.id).map((m) => ({ id: m.id, name: m.name }))
      );

      const reviewDuplicateId =
        candidate.id === suggestedPrimaryId ? duplicateIds[0] : candidate.id;
      if (reviewDuplicateId) {
        setMergeTargets({
          primaryId: suggestedPrimaryId,
          duplicateId: reviewDuplicateId,
          primaryName: primary.name,
        });
      }
    } catch {
      setEmailDuplicateMatches([]);
      setMergeTargets(null);
      setMergeCluster(null);
    }
  };

  const fetchCandidateAssignmentsNew = async () => {
    if (!candidate) return;
    setCaLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/candidate-assignments?candidateId=${candidate.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCandidateAssignmentsNew(data.success && data.data ? data.data : []);
    } catch {
      setCandidateAssignmentsNew([]);
    } finally {
      setCaLoading(false);
    }
  };

  const fetchAssignmentFiles = async (caId: number) => {
    if (expandedFiles[caId] !== undefined) {
      setExpandedFiles(prev => { const n = { ...prev }; delete n[caId]; return n; });
      return;
    }
    setLoadingFiles(prev => ({ ...prev, [caId]: true }));
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/candidate-assignments/${caId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setExpandedFiles(prev => ({ ...prev, [caId]: data.success && data.data?.files ? data.data.files : [] }));
    } catch {
      setExpandedFiles(prev => ({ ...prev, [caId]: [] }));
    } finally {
      setLoadingFiles(prev => ({ ...prev, [caId]: false }));
    }
  };

  const openFileViewer = (files: CandidateAssignmentFile[], startIndex = 0) => {
    setViewerFiles(files.map(f => ({
      name: f.original_filename,
      url: `/uploads/assignment-submissions/${f.stored_filename}`,
      mimeType: f.mime_type,
    })));
    setViewerIndex(startIndex);
  };

  const fetchFreshCandidateData = async () => {
    if (!candidate) return;
    try {
      const response = await candidatesAPI.getCandidateById(candidate.id);
      if (response.success && response.data) setFreshCandidate(response.data.candidate);
    } catch {}
  };

  const fetchAssignments = async () => {
    if (!candidate) return;
    const candidateId = String(candidate.id ?? '').trim();
    if (!candidateId) {
      setAssignments([]);
      return;
    }
    setAssignmentsLoading(true);
    try {
      const response = await assignmentsAPI.getCandidateAssignments(candidateId);
      setAssignments(response.success && response.data ? response.data : []);
    } catch {
      setAssignments([]);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !candidate?.id) {
      setActivityTimeline([]);
      setPositionsList([]);
      return;
    }
    candidatesAPI
      .getCandidateTimeline(candidate.id)
      .then((res) => {
        if (res.success && res.data) {
          setActivityTimeline((res.data.timeline as Array<{ type: string; date: string; title: string }>) || []);
          setPositionsList((res.data.positions as Array<{ position_name: string }>) || []);
        }
      })
      .catch(() => {});
  }, [isOpen, candidate?.id]);

  if (!isOpen || !candidate) return null;

  const c = freshCandidate || candidate;
  const assignmentDetails = c.assignmentDetails;
  const inOfficeAssignmentText = (
    assignmentDetails?.inOfficeAssignment ??
    (c as Candidate & { inOfficeAssignment?: string }).inOfficeAssignment ??
    ''
  ).trim();
  const inHouseAssignmentStatus = assignmentDetails?.inHouseAssignmentStatus;
  const assignmentLocation = (c.assignmentLocation ?? '').trim();
  const assignmentInterviewDate = assignmentDetails?.interviewDate;
  const hasInOfficeAssignmentInfo = Boolean(
    inOfficeAssignmentText ||
    assignmentLocation ||
    assignmentInterviewDate ||
    (inHouseAssignmentStatus && inHouseAssignmentStatus !== 'Pending')
  );
  const hasFormalAssignments =
    candidateAssignmentsNew.length > 0 || assignments.length > 0;
  const accent = STAGE_ACCENTS[candidate.stage] || '#6b7280';
  const displayName = toTitleCase(c.name);
  const displayRole = toTitleCase(c.position);
  const displaySource = toCapitalizedWords(c.source);
  const displayLocation = c.location ? toTitleCase(c.location) : '—';
  const displayEmail = normalizeWhitespace(c.email || '').toLowerCase() || '—';
  const displayPhone = normalizeWhitespace(c.phone || '') || '—';

  const getAssignmentStatusColor = (status: string) => {
    const map: Record<string, string> = {
      Draft: 'bg-gray-100 text-gray-700',
      Assigned: 'bg-blue-100 text-blue-700',
      'In Progress': 'bg-yellow-100 text-yellow-700',
      Submitted: 'bg-purple-100 text-purple-700',
      Approved: 'bg-green-100 text-green-700',
      Rejected: 'bg-red-100 text-red-700',
      Cancelled: 'bg-gray-100 text-gray-700',
    };
    return map[status] || 'bg-gray-100 text-gray-700';
  };

  const renderInOfficeAssignmentCard = (wrapperClass = 'space-y-3 py-2') => (
    <div className={wrapperClass}>
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-medium text-gray-800">In-Office Assignment</p>
          {inHouseAssignmentStatus && (
            <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${getAssignmentStatusColor(inHouseAssignmentStatus)}`}>
              {inHouseAssignmentStatus}
            </span>
          )}
        </div>
        {assignmentInterviewDate && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
            <Calendar size={12} />
            Interview: {new Date(assignmentInterviewDate).toLocaleDateString()}
          </div>
        )}
        {inOfficeAssignmentText ? (
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{inOfficeAssignmentText}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">No assignment notes</p>
        )}
        {assignmentLocation && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Assignment file / link</p>
            {/^https?:\/\//i.test(assignmentLocation) ? (
              <a
                href={assignmentLocation}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:underline break-all"
              >
                {assignmentLocation}
              </a>
            ) : (
              <p className="text-sm text-gray-600 break-all">{assignmentLocation}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const handleDownloadResume = async () => {
    try {
      const blob = await candidatesAPI.downloadResume(candidate.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const metadataResponse = await candidatesAPI.getResumeMetadata(candidate.id);
      link.download = metadataResponse.data?.originalName || `resume_${candidate.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download resume');
    }
  };

  const interviewerNotes = Array.isArray(c.notes) ? c.notes.filter((n: any) => n.user_role === 'Interviewer') : [];
  const generalNotes = Array.isArray(c.notes) ? c.notes.filter((n: any) => n.user_role !== 'Interviewer') : [];

  const initials = displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  const isFlaggedDuplicate = Boolean(
    (c as Candidate & { isFlaggedDuplicate?: boolean }).isFlaggedDuplicate
  );
  const hasMergedApplications = Boolean(
    (c as Candidate & { hasMergedApplications?: boolean }).hasMergedApplications
  );
  const duplicatePrimaryName = (c as Candidate & { duplicatePrimaryName?: string }).duplicatePrimaryName;
  const showMergeBanner = Boolean(mergeCluster && mergeCluster.duplicateIds.length > 0);
  const mergePrimaryLabel = mergeCluster?.primaryName || mergeTargets?.primaryName || duplicatePrimaryName || 'the existing profile';
  const duplicateProfileCount = mergeCluster?.allMatches.length ?? 0;

  const handleMergeDuplicate = () => {
    if (!mergeTargets) return;
    setMergeReviewOpen(true);
  };

  const handleMergeAll = async () => {
    if (!mergeCluster?.duplicateIds.length || mergingAll) return;
    const count = mergeCluster.duplicateIds.length;
    const confirmed = window.confirm(
      `Merge ${count} duplicate profile${count === 1 ? '' : 's'} into "${mergeCluster.primaryName}"?\n\n` +
        `Profiles to merge: ${mergeCluster.allMatches
          .filter((m) => mergeCluster.duplicateIds.includes(m.id))
          .map((m) => m.name)
          .join(', ')}\n\n` +
        'Applications, notes, and resumes will be combined. This cannot be undone from the UI.'
    );
    if (!confirmed) return;

    setMergingAll(true);
    setMergeAllError(null);
    try {
      const res = await candidatesAPI.executeBatchCandidateMerge({
        primaryCandidateId: mergeCluster.primaryId,
        duplicateCandidateIds: mergeCluster.duplicateIds,
        strategy: 'AUTO_SAFE',
      });
      if (res?.success !== false) {
        onMerged?.();
        onClose();
        return;
      }
      setMergeAllError(res.message || 'Merge all failed');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setMergeAllError(axiosErr.response?.data?.message || 'Merge all failed');
    } finally {
      setMergingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">

        {showMergeBanner && mergeCluster && (
          <div className="px-6 py-4 bg-red-950 text-white border-b border-red-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  {duplicateProfileCount > 2 ? `${duplicateProfileCount} related profiles` : 'Duplicate application'}
                </p>
                <p className="text-sm text-red-100 mt-1">
                  {isFlaggedDuplicate
                    ? `This submission matches an existing candidate${duplicatePrimaryName ? `: ${duplicatePrimaryName}` : ''}.`
                    : `${duplicateProfileCount} profiles share the same contact details (${mergeCluster.allMatches.map((m) => m.name).join(', ')}).`}
                  {' '}
                  Merge all into <strong className="text-white">{mergePrimaryLabel}</strong>, or review one pair at a time.
                </p>
                {mergeAllError && (
                  <p className="text-sm text-red-200 mt-2">{mergeAllError}</p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleMergeAll}
                  disabled={mergingAll}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-red-950 text-sm font-semibold hover:bg-red-50 disabled:opacity-60"
                >
                  <GitMerge size={16} />
                  {mergingAll
                    ? 'Merging…'
                    : `Merge all (${mergeCluster.duplicateIds.length})`}
                </button>
                {mergeTargets && (
                  <button
                    type="button"
                    onClick={handleMergeDuplicate}
                    disabled={mergingAll}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-200/40 text-white text-sm font-medium hover:bg-red-900 disabled:opacity-60"
                  >
                    Review one pair
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Hero Header ── */}
        <div
          className="px-6 pt-5 pb-5 border-b"
          style={{
            background: isFlaggedDuplicate ? '#fef2f2' : `${accent}12`,
            borderColor: isFlaggedDuplicate ? '#991b1b' : `${accent}30`,
          }}
        >
          {/* Top row: avatar + name + stage pill + close */}
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 border-2"
              style={{ backgroundColor: `${accent}25`, borderColor: `${accent}50` }}
            >
              <span className="font-bold text-lg" style={{ color: accent }}>{initials}</span>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 truncate">{displayName}</h2>
              <p className="text-sm truncate font-medium" style={{ color: accent }}>{displayRole}</p>
            </div>

            {/* Merged + stage pills + actions */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {hasMergedApplications && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-900 outline outline-1 outline-violet-300">
                  Merged
                </span>
              )}
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ backgroundColor: `${accent}18`, color: accent, outline: `1px solid ${accent}40` }}
              >
                {toTitleCase(candidate.stage)}
              </span>
              {onEdit && (
                <button
                  onClick={() => onEdit(c)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 hover:bg-white transition-colors border border-gray-200 text-gray-700 text-xs font-semibold"
                >
                  <Edit size={13} />
                  Edit
                </button>
              )}
            </div>
          </div>

          {/* Quick stats row */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: 'Applied', value: new Date(c.appliedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
              { label: 'Source', value: displaySource },
              { label: 'Location', value: displayLocation },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl px-3 py-2 text-center border bg-white/60"
                style={{ borderColor: `${accent}25` }}
              >
                <p className="text-xs mb-0.5 font-medium" style={{ color: accent }}>{label}</p>
                <p className="text-gray-800 text-sm font-semibold truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="border-b border-gray-200 bg-white px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'details'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Candidate Details
            </button>
            <button
              onClick={() => setActiveTab('hr-notes')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'hr-notes'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              HR Notes
            </button>
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-5">
          {activeTab === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

            {/* LEFT */}
            <div className="space-y-4">

              {(activityTimeline.length > 0 || positionsList.length > 1) && (
                <Section title="Activity & applications" icon={<Clock size={15} />}>
                  {positionsList.length > 0 && (
                    <div className="py-2 border-b border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-1">Positions</p>
                      <div className="flex flex-wrap gap-1.5">
                        {positionsList.map((p) => (
                          <span
                            key={p.position_name}
                            className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 font-medium"
                          >
                            {p.position_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <ul className="py-2 space-y-2 max-h-40 overflow-y-auto">
                    {activityTimeline.slice(0, 8).map((ev, i) => (
                      <li key={`${ev.type}-${i}`} className="merge-timeline-item text-sm">
                        <p className="text-xs text-gray-500">
                          {ev.date
                            ? new Date(ev.date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </p>
                        <p className="text-gray-800 font-medium">{ev.title}</p>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Contact */}
              <Section title="Contact" icon={<Mail size={15} />}>
                <a href={`mailto:${displayEmail}`} className="flex items-center gap-3 py-2.5 border-b border-gray-100 group">
                  <Mail size={15} className="text-indigo-400 shrink-0" />
                  <span className="text-sm text-gray-700 group-hover:text-indigo-600 transition-colors truncate">{displayEmail}</span>
                </a>
                <a href={`tel:${displayPhone}`} className="flex items-center gap-3 py-2.5 border-b border-gray-100 group">
                  <Phone size={15} className="text-indigo-400 shrink-0" />
                  <span className="text-sm text-gray-700 group-hover:text-indigo-600 transition-colors">{displayPhone}</span>
                </a>
                {c.location && (
                  <div className="flex items-center gap-3 py-2.5">
                    <MapPin size={15} className="text-indigo-400 shrink-0" />
                    <span className="text-sm text-gray-700">{displayLocation}</span>
                  </div>
                )}
              </Section>

              {/* Work Preferences + floating Notes button */}
              <div className="relative">
                {c.workPreferences && (
                  <Section title="Work Preferences" icon={<Briefcase size={15} />}>
                    {c.workPreferences.workPreference && (
                      <InfoRow label="Preference" value={
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          {toTitleCase(c.workPreferences.workPreference)}
                        </span>
                      } />
                    )}
                    {c.workPreferences.currentCtc && (
                      <InfoRow label="Current CTC" value={`₹${c.workPreferences.currentCtc} (${toTitleCase(c.workPreferences.ctcFrequency || 'Annual')})`} />
                    )}
                    <InfoRow label="Alternate Saturday" value={
                      c.workPreferences.willingAlternateSaturday === true
                        ? <span className="flex items-center gap-1 text-green-600"><CheckCircle size={13} /> Yes</span>
                        : c.workPreferences.willingAlternateSaturday === false
                        ? <span className="flex items-center gap-1 text-red-500"><XCircle size={13} /> No</span>
                        : <span className="text-gray-400">Not specified</span>
                    } />
                  </Section>
                )}

                </div>

              {/* Skills */}
              {((c.skills && c.skills.length > 0) || c.expertise) && (
                <Section title="Skills & Expertise" icon={<Star size={15} />}>
                  {c.expertise && (
                    <div className="py-2.5 border-b border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">Primary Expertise</p>
                      <p className="text-sm font-medium text-gray-800">{toTitleCase(c.expertise)}</p>
                    </div>
                  )}
                  {c.skills && c.skills.length > 0 && (
                    <div className="py-2.5">
                      <p className="text-xs text-gray-500 mb-2">Technical Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.skills.map((skill, i) => (
                          <span key={i} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium border border-indigo-100">
                            {toCapitalizedWords(skill)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Section>
              )}

              {/* Notes — header contains the Add Note button inline */}
              <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <span className="text-gray-500"><FileText size={15} /></span>
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Notes</h3>
                    {generalNotes.length > 0 && (
                      <span className="text-xs bg-indigo-100 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">
                        {generalNotes.length}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setNotesPanelOpen(true)}
                    title="Add / View Notes"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-white text-xs font-semibold"
                  >
                    <Pencil size={12} />
                    Add Note
                  </button>
                </div>
                <div className="px-4 py-1">
                  {generalNotes.length > 0 ? (
                    <div className="space-y-3 py-2">
                      {generalNotes.map((note: any, i: number) => (
                        <div key={note.id || i} className="border-l-2 border-indigo-300 pl-3 py-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-800">{note.user_name}</span>
                            <span className="text-xs text-gray-400">{new Date(note.created_at).toLocaleDateString()}</span>
                          </div>
                          {(note.notes || note.note_text) && (
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{note.notes || note.note_text}</p>
                          )}
                          {note.rating && (
                            <div className="flex items-center gap-1 mt-1.5">
                              {[1,2,3,4,5].map(s => (
                                <span key={s} className={`text-xs ${s <= note.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                              ))}
                              <span className="text-xs text-gray-400 ml-1">{note.rating}/5</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-5 text-gray-400">
                      <FileText size={22} className="mb-1.5 opacity-40" />
                      <p className="text-xs">No notes yet. Click <span className="font-semibold text-indigo-500">Add Note</span> to get started.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="space-y-4">

              {/* Salary */}
              {c.salary && (
                <Section title="Salary" icon={<DollarSign size={15} />}>
                  {c.salary.expected && (
                    <InfoRow label="Expected CTC" value={`₹${c.salary.expected}`} />
                  )}
                  {c.salary.offered && (
                    <InfoRow label="Offered CTC" value={`₹${c.salary.offered}`} />
                  )}
                  <InfoRow label="Negotiable" value={
                    c.salary.negotiable
                      ? <span className="flex items-center gap-1 text-green-600"><CheckCircle size={13} /> Yes</span>
                      : <span className="flex items-center gap-1 text-red-500"><XCircle size={13} /> No</span>
                  } />
                </Section>
              )}

              {/* Availability */}
              {c.availability && (
                <Section title="Availability" icon={<Clock size={15} />}>
                  {c.availability.joiningTime && (
                    <InfoRow label="Joining Time" value={toTitleCase(c.availability.joiningTime)} />
                  )}
                  {c.availability.noticePeriod && (
                    <InfoRow label="Notice Period" value={`${c.availability.noticePeriod} days`} />
                  )}
                  <InfoRow label="Immediate Joiner" value={
                    c.availability.immediateJoiner
                      ? <span className="flex items-center gap-1 text-green-600"><CheckCircle size={13} /> Yes</span>
                      : <span className="flex items-center gap-1 text-yellow-600"><AlertCircle size={13} /> No</span>
                  } />
                </Section>
              )}

              {/* Resume */}
              <Section title="Resume" icon={<FileText size={15} />}>
                <div className="py-3">
                  {candidate.resumeFileId ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center">
                          <FileText size={16} className="text-indigo-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">Resume attached</p>
                          <p className="text-xs text-gray-400">Click to download</p>
                        </div>
                      </div>
                      <button
                        onClick={handleDownloadResume}
                        className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        <Download size={14} />
                        Download
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 text-gray-400">
                      <FileText size={16} />
                      <span className="text-sm">No resume uploaded</span>
                    </div>
                  )}
                </div>
              </Section>

              {/* Assignments */}
              <Section title="Assignments" icon={<Calendar size={15} />}>
                {(assignmentsLoading || caLoading) && !hasFormalAssignments && !hasInOfficeAssignmentInfo ? (
                  <div className="flex items-center gap-2 py-4 text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600" />
                    <span className="text-sm">Loading...</span>
                  </div>
                ) : candidateAssignmentsNew.length > 0 ? (
                  <div className="space-y-3 py-2">
                    {candidateAssignmentsNew.map((ca) => {
                      const isOverdue = ca.is_overdue === 1 && ca.status !== 'Submitted';
                      const statusLabel = isOverdue ? 'Overdue' : ca.status;
                      const statusColor: Record<string, string> = {
                        Assigned: 'bg-blue-100 text-blue-700',
                        Submitted: 'bg-purple-100 text-purple-700',
                        Reviewed: 'bg-green-100 text-green-700',
                        Overdue: 'bg-red-100 text-red-700',
                      };
                      return (
                        <div key={ca.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <p className="text-sm font-medium text-gray-800">{ca.assignment_title}</p>
                            <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${statusColor[statusLabel] || 'bg-gray-100 text-gray-700'}`}>
                              {statusLabel}
                            </span>
                          </div>
                          {ca.deadline && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                              <Calendar size={12} />
                              Deadline: {new Date(ca.deadline).toLocaleDateString()}
                            </div>
                          )}
                          {ca.submitted_at && (
                            <div className="flex items-center gap-1.5 text-xs text-green-600">
                              <CheckCircle size={12} />
                              Submitted: {new Date(ca.submitted_at).toLocaleDateString()}
                            </div>
                          )}
                          {(ca.status === 'Submitted' || ca.status === 'Reviewed') && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <button
                                onClick={() => fetchAssignmentFiles(ca.id)}
                                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                              >
                                <FileText size={12} />
                                {loadingFiles[ca.id] ? 'Loading…' : expandedFiles[ca.id] ? 'Hide files' : 'View submitted files'}
                              </button>
                              {expandedFiles[ca.id] && expandedFiles[ca.id].length > 0 && (
                                <div className="mt-1.5 space-y-1">
                                  {expandedFiles[ca.id].map((file, fi) => (
                                    <div key={file.id} className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => openFileViewer(expandedFiles[ca.id], fi)}
                                        className="text-xs text-blue-600 hover:underline truncate max-w-[180px] text-left"
                                      >
                                        {file.original_filename}
                                      </button>
                                      <span className="text-gray-400 text-xs flex-shrink-0">({(file.file_size / 1024).toFixed(1)} KB)</span>
                                      <a href={`/uploads/assignment-submissions/${file.stored_filename}`} download={file.original_filename} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                                        <Download size={11} />
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {expandedFiles[ca.id] && expandedFiles[ca.id].length === 0 && (
                                <p className="text-xs text-gray-400 mt-1">No files found.</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : assignments.length > 0 ? (
                  <div className="space-y-3 py-2">
                    {assignments.map((a) => (
                      <div key={a.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-sm font-medium text-gray-800">{a.title}</p>
                          <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${getAssignmentStatusColor(a.status)}`}>
                            {a.status}
                          </span>
                        </div>
                        {a.due_date && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Calendar size={12} />
                            Due: {new Date(a.due_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : hasInOfficeAssignmentInfo ? (
                  renderInOfficeAssignmentCard()
                ) : (
                  <div className="flex flex-col items-center py-6 text-gray-400">
                    <Clock size={28} className="mb-2 opacity-50" />
                    <p className="text-sm">No assignments yet</p>
                  </div>
                )}
                {hasFormalAssignments && hasInOfficeAssignmentInfo && (
                  renderInOfficeAssignmentCard('space-y-3 py-2 border-t border-gray-100 mt-2')
                )}
              </Section>

              {/* Interview Notes */}
              {interviewerNotes.length > 0 && (
                <Section title="Interview Feedback" icon={<User size={15} />}>
                  <div className="space-y-3 py-2">
                    {interviewerNotes.map((note: any, i: number) => (
                      <div key={note.id || i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-800">{note.user_name}</span>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Interviewer</span>
                          </div>
                          <span className="text-xs text-gray-400">{new Date(note.created_at).toLocaleDateString()}</span>
                        </div>
                        {note.recommendation && (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full mb-2 ${
                            note.recommendation === 'Recommend' ? 'bg-green-100 text-green-700' :
                            note.recommendation === "Don't Recommend" ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {note.recommendation === 'Recommend' ? <CheckCircle size={11} /> : note.recommendation === "Don't Recommend" ? <XCircle size={11} /> : null}
                            {note.recommendation}
                          </span>
                        )}
                        {(note.notes || note.note_text) && (
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{note.notes || note.note_text}</p>
                        )}
                        {note.rating && (
                          <div className="flex items-center gap-1 mt-2">
                            {[1,2,3,4,5].map(s => (
                              <span key={s} className={`text-sm ${s <= note.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                            ))}
                            <span className="text-xs text-gray-400 ml-1">{note.rating}/5</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

            </div>
          </div>
          )}

          {/* HR Notes Tab */}
          {activeTab === 'hr-notes' && (
            <div className="max-w-4xl mx-auto">
              <HRNotesTimeline key={hrNotesKey} candidateId={candidate.id} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {viewerFiles && (
        <FileViewer
          files={viewerFiles}
          initialIndex={viewerIndex}
          onClose={() => setViewerFiles(null)}
        />
      )}

      <NotesPanel
        candidateId={candidate.id}
        candidateName={displayName}
        isOpen={notesPanelOpen}
        onClose={() => setNotesPanelOpen(false)}
      />

      {mergeReviewOpen && mergeTargets && (
        <MergeReviewModal
          isOpen={mergeReviewOpen}
          onClose={() => setMergeReviewOpen(false)}
          primaryId={mergeTargets.primaryId}
          duplicateId={mergeTargets.duplicateId}
          onMerged={() => {
            setMergeReviewOpen(false);
            onMerged?.();
            onClose();
          }}
        />
      )}
    </div>
  );
}