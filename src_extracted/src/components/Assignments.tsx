import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, 
  Search, 
  Eye, 
  Edit, 
  Trash2, 
  Send, 
  Upload, 
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  User,
  StickyNote,
  ExternalLink,
  Filter,
  X
} from 'lucide-react';
import { assignmentsAPI, Assignment, AssignmentFilters, API_BASE_URL } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import AssignmentFormModal from './AssignmentFormModal';
import AssignmentDetailsModal from './AssignmentDetailsModal';
import NotesPanel from './NotesPanel';
import FileViewer, { ViewerFile } from './FileViewer';

// Shape returned by GET /api/candidate-assignments
interface CandidateAssignment {
  id: number;
  candidate_id: string;
  assignment_id: number;
  candidate_name: string;
  candidate_email: string;
  assignment_title: string;
  status: 'Assigned' | 'Submitted' | 'Overdue' | 'Reviewed';
  deadline: string | null;
  expiry_at: string | null;
  submitted_at: string | null;
  email_status: 'Pending' | 'Sent' | 'Failed';
  is_overdue: number;
  created_at: string;
  // candidate pipeline stage — joined from candidates table
  current_stage?: string;
  stage?: string;
}

interface CandidateAssignmentFile {
  id: number;
  stored_filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  uploaded_at: string;
}

type SubmissionFilter = 'all' | 'Assigned' | 'Submitted' | 'Overdue';

const Assignments: React.FC = () => {
  const { hasPermission } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AssignmentFilters>({
    page: 1,
    limit: 10
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // Check permissions
  const canCreate = hasPermission('assignments', 'create');
  const canEdit = hasPermission('assignments', 'edit');
  const canDelete = hasPermission('assignments', 'delete');

  // ── Candidate Assignments (submissions) section ──────────────────────────
  const [candidateAssignments, setCandidateAssignments] = useState<CandidateAssignment[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [submissionFilter, setSubmissionFilter] = useState<SubmissionFilter>('all');
  const [expandedFiles, setExpandedFiles] = useState<Record<number, CandidateAssignmentFile[]>>({});
  const [loadingFiles, setLoadingFiles] = useState<Record<number, boolean>>({});
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Notes panel state
  const [notesPanelCandidateId, setNotesPanelCandidateId] = useState<string | null>(null);
  const notesBtnRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const notesAnchorRef = useRef<HTMLButtonElement | null>(null);

  // File viewer state
  const [viewerFiles, setViewerFiles] = useState<ViewerFile[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Filter drawer state
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Lock body scroll when filter drawer is open
  useEffect(() => {
    if (showFilterDrawer) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [showFilterDrawer]);

  // Handle ESC key for filter drawer
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showFilterDrawer) setShowFilterDrawer(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [showFilterDrawer]);

  useEffect(() => {
    fetchAssignments();
  }, [filters]);

  // ── Candidate assignments fetch + 5-second polling (tasks 9.1, 9.4) ──────
  const fetchCandidateAssignments = async (filter: SubmissionFilter = submissionFilter) => {
    try {
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams();
      if (filter === 'Overdue') {
        params.set('overdue', 'true');
      } else if (filter !== 'all') {
        params.set('status', filter);
      }
      const url = `${API_BASE_URL}/candidate-assignments${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCandidateAssignments(json.data);
      }
    } catch (err) {
      console.error('Error fetching candidate assignments:', err);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    setSubmissionsLoading(true);
    fetchCandidateAssignments(submissionFilter);

    // 5-second polling (task 9.4)
    pollingRef.current = setInterval(() => {
      fetchCandidateAssignments(submissionFilter);
    }, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [submissionFilter]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const response = await assignmentsAPI.getAssignments(filters);
      if (response.success && response.data) {
        setAssignments(Array.isArray(response.data) ? response.data : []);
        setPagination(response.pagination || {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        });
      } else {
        setAssignments([]);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (searchTerm: string) => {
    setFilters(prev => ({ ...prev, search: searchTerm, page: 1 }));
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleCreateAssignment = () => {
    setEditingAssignment(null);
    setShowFormModal(true);
  };

  const handleEditAssignment = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setShowFormModal(true);
  };

  const handleViewAssignment = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setShowDetailsModal(true);
  };

  const handleDeleteAssignment = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) {
      return;
    }

    try {
      const response = await assignmentsAPI.deleteAssignment(id);
      if (response.success) {
        fetchAssignments();
      }
    } catch (err) {
      console.error('Error deleting assignment:', err);
    }
  };

  const handleSendAssignment = async (id: number) => {
    console.log('Send assignment clicked for ID:', id);
    try {
      console.log('Calling sendAssignment API...');
      const response = await assignmentsAPI.sendAssignment(id);
      console.log('Send assignment response:', response);
      if (response.success) {
        console.log('Assignment sent successfully, refreshing list...');
        fetchAssignments();
      } else {
        console.error('Send assignment failed:', response.message);
      }
    } catch (err) {
      console.error('Error sending assignment:', err);
    }
  };


  // ── Attachment download helpers (task 9.5) ───────────────────────────────
  const fetchFilesForRecord = async (recordId: number) => {
    if (expandedFiles[recordId] !== undefined) {
      // toggle off
      setExpandedFiles(prev => {
        const next = { ...prev };
        delete next[recordId];
        return next;
      });
      return;
    }
    setLoadingFiles(prev => ({ ...prev, [recordId]: true }));
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/candidate-assignments/${recordId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data?.files) {
        setExpandedFiles(prev => ({ ...prev, [recordId]: json.data.files }));
      }
    } catch (err) {
      console.error('Error fetching files:', err);
    } finally {
      setLoadingFiles(prev => ({ ...prev, [recordId]: false }));
    }
  };

  const getDownloadUrl = (file: CandidateAssignmentFile) => {
    // Files are served from /uploads/assignment-submissions/ via the backend static middleware
    const backendBase = API_BASE_URL.replace(/\/api\/?$/, '');
    return `${backendBase}/uploads/assignment-submissions/${file.stored_filename}`;
  };

  const openViewer = (files: CandidateAssignmentFile[], startIndex = 0) => {
    const viewable: ViewerFile[] = files.map(f => ({
      name: f.original_filename,
      url: getDownloadUrl(f),
      mimeType: f.mime_type,
    }));
    setViewerFiles(viewable);
    setViewerIndex(startIndex);
  };

  const handleDeleteSubmission = async (recordId: number, candidateName: string) => {
    if (!window.confirm(`Are you sure you want to delete the submission for ${candidateName}? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/candidate-assignments/${recordId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      
      if (json.success) {
        // Refresh the submissions list
        fetchCandidateAssignments(submissionFilter);
        // Clear expanded files if this record was expanded
        if (expandedFiles[recordId]) {
          setExpandedFiles(prev => {
            const next = { ...prev };
            delete next[recordId];
            return next;
          });
        }
      } else {
        alert('Failed to delete submission: ' + (json.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error deleting submission:', err);
      alert('An error occurred while deleting the submission');
    }
  };

  const getSubmissionStatusColor = (record: CandidateAssignment) => {
    const status = record.is_overdue ? 'Overdue' : record.status;
    switch (status) {
      case 'Assigned': return 'bg-blue-100 text-blue-800';
      case 'Submitted': return 'bg-purple-100 text-purple-800';
      case 'Overdue': return 'bg-red-100 text-red-800';
      case 'Reviewed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSubmissionStatusLabel = (record: CandidateAssignment) =>
    record.is_overdue && record.status !== 'Submitted' ? 'Overdue' : record.status;

  const getSubmissionStatusIcon = (record: CandidateAssignment) => {
    const label = getSubmissionStatusLabel(record);
    switch (label) {
      case 'Assigned': return <Send size={14} />;
      case 'Submitted': return <Upload size={14} />;
      case 'Overdue': return <AlertCircle size={14} />;
      case 'Reviewed': return <CheckCircle size={14} />;
      default: return <Clock size={14} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-800';
      case 'Assigned': return 'bg-blue-100 text-blue-800';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800';
      case 'Submitted': return 'bg-purple-100 text-purple-800';
      case 'Approved': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      case 'Cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Draft': return <FileText size={16} />;
      case 'Assigned': return <Send size={16} />;
      case 'In Progress': return <Clock size={16} />;
      case 'Submitted': return <Upload size={16} />;
      case 'Approved': return <CheckCircle size={16} />;
      case 'Rejected': return <XCircle size={16} />;
      case 'Cancelled': return <AlertCircle size={16} />;
      default: return <FileText size={16} />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Assignments List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assignment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Candidate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Attachments
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {assignments && assignments.length > 0 ? assignments.map((assignment) => (
                <tr key={assignment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{assignment.title}</div>
                      {assignment.job_title && (
                        <div className="text-sm text-gray-500">{assignment.job_title}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{assignment.candidate_name}</div>
                      <div className="text-sm text-gray-500">{assignment.candidate_email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                      {getStatusIcon(assignment.status)}
                      {assignment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {assignment.due_date ? formatDate(assignment.due_date) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {assignment.attachment_count || 0} files
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewAssignment(assignment)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      
                      {canEdit && (
                        <button
                          onClick={() => handleEditAssignment(assignment)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                      )}

                      {assignment.status === 'Draft' && canEdit && (
                        <button
                          onClick={() => handleSendAssignment(assignment.id)}
                          className="text-green-600 hover:text-green-900"
                          title="Send Assignment"
                        >
                          <Send size={16} />
                        </button>
                      )}

                      {assignment.status === 'Draft' && canDelete && (
                        <button
                          onClick={() => handleDeleteAssignment(assignment.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <FileText size={48} className="text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments found</h3>
                      <p className="text-gray-600">Create your first assignment to get started.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => handlePageChange((pagination?.page || 1) - 1)}
                disabled={!pagination?.hasPrev}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange((pagination?.page || 1) + 1)}
                disabled={!pagination?.hasNext}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">{((pagination?.page || 1) - 1) * (pagination?.limit || 10) + 1}</span>
                  {' '}to{' '}
                  <span className="font-medium">
                    {Math.min((pagination?.page || 1) * (pagination?.limit || 10), pagination?.total || 0)}
                  </span>
                  {' '}of{' '}
                  <span className="font-medium">{pagination?.total || 0}</span>
                  {' '}results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => handlePageChange((pagination?.page || 1) - 1)}
                    disabled={!pagination?.hasPrev}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {Array.from({ length: pagination?.totalPages || 0 }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        page === (pagination?.page || 1)
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => handlePageChange((pagination?.page || 1) + 1)}
                    disabled={!pagination?.hasNext}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Assignment Submissions Section (tasks 9.1, 9.4, 9.5, 9.6) ── */}
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Section header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Assignment Submissions</h2>
          <p className="text-sm text-gray-500 mt-0.5">Candidate assignment records — auto-refreshes every 5 seconds</p>
        </div>

        {/* Status filter tabs (task 9.1) */}
        <div className="px-6 pt-4 flex gap-2 flex-wrap">
          {(['all', 'Assigned', 'Submitted', 'Overdue'] as SubmissionFilter[]).map(tab => (
            <button
              key={tab}
              onClick={() => setSubmissionFilter(tab)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                submissionFilter === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab === 'all' ? 'All' : tab}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto mt-4">
          {submissionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deadline</th>
                  {/* Kanban stage column (task 9.6) */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pipeline Stage</th>
                  {/* Attachments column (task 9.5) */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attachments</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {candidateAssignments.length > 0 ? candidateAssignments.map(record => (
                  <React.Fragment key={record.id}>
                    <tr className="hover:bg-gray-50">
                      {/* Candidate */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{record.candidate_name}</div>
                        <div className="text-xs text-gray-500">{record.candidate_email}</div>
                      </td>

                      {/* Assignment title */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.assignment_title}
                      </td>

                      {/* Status badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getSubmissionStatusColor(record)}`}>
                          {getSubmissionStatusIcon(record)}
                          {getSubmissionStatusLabel(record)}
                        </span>
                        {record.email_status === 'Failed' && (
                          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                            <XCircle size={12} /> Email failed
                          </span>
                        )}
                      </td>

                      {/* Deadline */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.deadline ? formatDate(record.deadline) : '—'}
                      </td>

                      {/* Pipeline stage (task 9.6) — from candidate data joined in API */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-sm text-gray-700">
                          <User size={14} className="text-gray-400" />
                          {(record as any).current_stage || (record as any).stage || '—'}
                        </span>
                      </td>

                      {/* Attachments (task 9.5) */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {record.status === 'Submitted' || record.status === 'Reviewed' ? (
                          <button
                            onClick={() => fetchFilesForRecord(record.id)}
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                            title="View / download files"
                          >
                            {loadingFiles[record.id] ? (
                              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 inline-block" />
                            ) : (
                              <Download size={14} />
                            )}
                            {expandedFiles[record.id] !== undefined ? 'Hide files' : 'Show files'}
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>

                      {/* Notes (task 11.6) */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {record.candidate_id ? (
                          <button
                            ref={el => { notesBtnRefs.current[record.id] = el; }}
                            onClick={() => {
                              notesAnchorRef.current = notesBtnRefs.current[record.id];
                              setNotesPanelCandidateId(prev =>
                                prev === record.candidate_id ? null : record.candidate_id
                              );
                            }}
                            className="inline-flex items-center gap-1 text-sm text-yellow-600 hover:text-yellow-800"
                            title="Add / view notes"
                          >
                            <StickyNote size={14} />
                            Notes
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteSubmission(record.id, record.candidate_name)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete submission"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded file list */}
                    {expandedFiles[record.id] && expandedFiles[record.id].length > 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 pb-4 bg-gray-50">
                          <ul className="space-y-1 mt-1">
                            {expandedFiles[record.id].map((file, fi) => (
                              <li key={file.id} className="flex items-center gap-2 text-sm">
                                <FileText size={14} className="text-gray-400 flex-shrink-0" />
                                <button
                                  onClick={() => openViewer(expandedFiles[record.id], fi)}
                                  className="text-blue-600 hover:underline truncate max-w-xs text-left"
                                >
                                  {file.original_filename}
                                </button>
                                <span className="text-gray-400 text-xs flex-shrink-0">
                                  ({(file.file_size / 1024).toFixed(1)} KB)
                                </span>
                                <a
                                  href={getDownloadUrl(file)}
                                  download={file.original_filename}
                                  className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                                  title="Download"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <Download size={12} />
                                </a>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}

                    {expandedFiles[record.id] && expandedFiles[record.id].length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 pb-4 bg-gray-50 text-sm text-gray-500">
                          No files found for this submission.
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <Upload size={40} className="text-gray-300 mb-3" />
                        <p className="text-sm">No submission records found for the selected filter.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modals */}
      {showFormModal && (
        <AssignmentFormModal
          assignment={editingAssignment}
          onClose={() => {
            setShowFormModal(false);
            setEditingAssignment(null);
          }}
          onSave={() => {
            setShowFormModal(false);
            setEditingAssignment(null);
            fetchAssignments();
          }}
        />
      )}

      {showDetailsModal && selectedAssignment && (
        <AssignmentDetailsModal
          assignment={selectedAssignment}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedAssignment(null);
          }}
          onUpdate={() => {
            fetchAssignments();
          }}
        />
      )}

      {notesPanelCandidateId !== null && (
        <NotesPanel
          candidateId={notesPanelCandidateId}
          anchorRef={notesAnchorRef as React.RefObject<HTMLElement>}
          isOpen={true}
          onClose={() => setNotesPanelCandidateId(null)}
        />
      )}

      {viewerFiles && (
        <FileViewer
          files={viewerFiles}
          initialIndex={viewerIndex}
          onClose={() => setViewerFiles(null)}
        />
      )}

      {/* Floating Action Buttons - Bottom Right */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-center gap-3">
        {/* Filter Button (Top) */}
        <button
          onClick={() => setShowFilterDrawer(true)}
          className="relative w-14 h-14 bg-white text-gray-700 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center group border border-gray-200"
          title="Open filters"
        >
          <Filter size={20} className="group-hover:rotate-90 transition-transform duration-200" />
        </button>

        {/* Create Assignment Button (Bottom) */}
        {canCreate && (
          <button
            onClick={handleCreateAssignment}
            className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl hover:shadow-2xl hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
            title="Create Assignment"
            style={{ boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)' }}
          >
            <Plus size={20} />
          </button>
        )}
      </div>

      {/* Filter Drawer */}
      {showFilterDrawer && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300"
            style={{ zIndex: 9998 }}
            onClick={() => setShowFilterDrawer(false)}
          />

          {/* Drawer */}
          <div 
            className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out"
            style={{ 
              zIndex: 9999,
              animation: 'slideInRight 300ms cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div className="flex flex-col h-full">
              {/* Drawer Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Filter Assignments</h2>
                <button
                  onClick={() => setShowFilterDrawer(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                  <div className="relative">
                    <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search assignments..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onChange={(e) => handleSearch(e.target.value)}
                      value={filters.search || ''}
                    />
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    value={filters.status || ''}
                  >
                    <option value="">All Statuses</option>
                    <option value="Draft">Draft</option>
                    <option value="Assigned">Assigned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Submitted">Submitted</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Due Before */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Due Before</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onChange={(e) => handleFilterChange('dueBefore', e.target.value)}
                    value={filters.dueBefore || ''}
                  />
                </div>

                {/* Due After */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Due After</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onChange={(e) => handleFilterChange('dueAfter', e.target.value)}
                    value={filters.dueAfter || ''}
                  />
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => {
                    setFilters({ page: 1, limit: 10 });
                    setShowFilterDrawer(false);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Clear Filters
                </button>
                <button
                  onClick={() => setShowFilterDrawer(false)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          <style>{`
            @keyframes slideInRight {
              from {
                transform: translateX(100%);
                opacity: 0;
              }
              to {
                transform: translateX(0);
                opacity: 1;
              }
            }
          `}</style>
        </>,
        document.body
      )}
    </div>
  );
};

export default Assignments;
