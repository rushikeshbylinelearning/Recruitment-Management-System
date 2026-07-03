import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, MoreVertical, Eye, Users, Briefcase, Upload, AlertCircle, Filter,
  MapPin, CalendarDays, Clock, Building2,
} from 'lucide-react';
import { JobPosting } from '../types';
import { jobsAPI, JobPosting as ApiJobPosting, candidatesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ProtectedComponent from './ProtectedComponent';
import AddCandidateModal from './AddCandidateModal';
import AddJobModal from './AddJobModal';
import JobDetailsModal from './JobDetailsModal';
import JobApplicantsModal from './JobApplicantsModal';
import ApplicantDetailsModal from './ApplicantDetailsModal';
import CandidateViewModal from './CandidateViewModal';
import CandidateImportContainer from './import/CandidateImportContainer';
import '../styles/Jobs.css';

const JOBS_PAGE_SIZE = 10;

// The 10 fixed job categories shown on the jobs page
const FIXED_JOB_TITLES = [
  'Sales and Marketing',
  'Animators',
  'Graphic Designer',
  'Full Stack Developer',
  'Content Writers',
  'Instructional Designers',
  'Digital Marketing',
  'Human Resource',
  'IT',
  'Project Coordinators',
] as const;

export default function Jobs() {
  const { hasPermission } = useAuth();
  const [jobs, setJobs] = useState<ApiJobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; pages: number } | null>(null);
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false);
  const [showEditJobModal, setShowEditJobModal] = useState(false);
  const [selectedJobForCandidate, setSelectedJobForCandidate] = useState<JobPosting | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [showApplicantsModal, setShowApplicantsModal] = useState(false);
  const [showApplicantDetails, setShowApplicantDetails] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState<any>(null);
  const [editingCandidate, setEditingCandidate] = useState<any>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showArchivedJobs, setShowArchivedJobs] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<number>>(new Set());
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [jobCardApplicantTotals, setJobCardApplicantTotals] = useState<Record<string, number>>({});

  // Load jobs from backend – fetch all so we can merge into fixed cards
  const loadJobs = useCallback(async (pageNum: number) => {
    try {
      setLoading(true);
      const response = await jobsAPI.getJobs({
        page: 1,
        limit: 100,
        search: searchTerm.trim() || undefined,
        status: statusFilter === 'All' ? undefined : statusFilter,
      });
      if (response.success && response.data) {
        setJobs(response.data.jobs || []);
        setPagination(response.data.pagination ?? null);
        setJobCardApplicantTotals(response.data.jobCardApplicantTotals || {});
      } else {
        setError('Failed to load jobs');
      }
    } catch (err) {
      console.error('Error loading jobs:', err);
      setError('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    loadJobs(page);
  }, [page, searchTerm, statusFilter, loadJobs]);

  /**
   * Build exactly 10 fixed job cards by merging live API data.
   * For each fixed title we find the best matching job from the API
   * (case-insensitive substring match). If multiple jobs match the same
   * title we aggregate their applicant counts and use the most-recent one
   * for metadata. If no match exists we show a placeholder card.
   */
  const displayJobs = useMemo((): ApiJobPosting[] => {
    const useCategoryTotals = Object.keys(jobCardApplicantTotals).length > 0;

    return FIXED_JOB_TITLES.map((fixedTitle, idx) => {
      const needle = fixedTitle.toLowerCase();
      const matches = jobs.filter(j =>
        j.title.toLowerCase().includes(needle) ||
        needle.includes(j.title.toLowerCase()) ||
        j.department?.toLowerCase().includes(needle)
      );

      const jobBasedApplicantTotal = matches.reduce(
        (sum, j) => sum + (j.applicantCount || 0),
        0
      );
      const categoryApplicantTotal = useCategoryTotals
        ? (jobCardApplicantTotals[fixedTitle] ?? 0)
        : 0;

      if (matches.length === 0) {
        // Placeholder card – no matching job in DB yet
        return {
          id: -(idx + 1), // negative id signals placeholder
          title: fixedTitle,
          department: fixedTitle,
          location: 'Remote',
          jobType: 'Full-time',
          status: 'Active',
          postedDate: new Date().toISOString().split('T')[0],
          deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          description: '',
          requirements: [],
          portals: [],
          applicantCount: useCategoryTotals ? categoryApplicantTotal : 0,
          assignedTo: [],
        } as unknown as ApiJobPosting;
      }

      // Prefer position-based rollup from the API when it is non-zero; otherwise use the sum
      // of applicant counts on matched job postings. Production often stores `position` as the
      // umbrella card title (e.g. "Sales and Marketing"), which used to miss category aliases
      // and showed 0 even though job rows had applicants.
      // FALLBACK: If category total is 0 but job-based total is > 0, use job-based total
      let totalApplicants = 0;
      if (useCategoryTotals) {
        // Prefer category total, but fall back to job-based if category is 0
        totalApplicants = categoryApplicantTotal > 0 ? categoryApplicantTotal : jobBasedApplicantTotal;
      } else {
        totalApplicants = jobBasedApplicantTotal;
      }

      // Use the most recently posted job as the base card
      const base = matches.sort((a, b) =>
        new Date(b.postedDate || 0).getTime() - new Date(a.postedDate || 0).getTime()
      )[0];

      return {
        ...base,
        title: fixedTitle,          // always show the canonical fixed title
        applicantCount: totalApplicants,
        _matchedIds: matches.map(j => j.id), // carry all matched IDs for the modal
      } as unknown as ApiJobPosting;
    });
  }, [jobs, jobCardApplicantTotals]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'job-status-active';
      case 'Paused': return 'job-status-paused';
      case 'Closed': return 'job-status-closed';
      default: return 'job-status-default';
    }
  };

  // Check if deadline is within 30 days
  const isDeadlineNear = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays >= 0;
  };

  const handleAddCandidateToJob = (job: JobPosting) => {
    setSelectedJobForCandidate(job);
    setShowAddCandidateModal(true);
  };

  const handleViewApplicants = (job: JobPosting) => {
    setSelectedJob(job);
    setShowApplicantsModal(true);
  };

  const handleEditCandidate = (candidate: any) => {
    setEditingCandidate(candidate);
    setSelectedJobForCandidate(selectedJob);
    setShowAddCandidateModal(true);
    setShowApplicantsModal(false);
  };

  const handleCandidateSubmit = async (candidateData: any) => {
    try {
      setLoading(true);
      
      // If a specific job was selected, override the jobId
      if (selectedJobForCandidate) {
        candidateData.jobId = selectedJobForCandidate.id;
        candidateData.position = selectedJobForCandidate.title;
      }
      
      let response;
      if (editingCandidate) {
        // Update existing candidate
        response = await candidatesAPI.updateCandidate(editingCandidate.id, candidateData);
        if (response.success) {
          setError('');
          setEditingCandidate(null);
          setSelectedJobForCandidate(null);
          setShowAddCandidateModal(false);
          // Reload jobs to refresh applicant counts
          loadJobs(page);
        } else {
          setError('Failed to update candidate');
        }
      } else {
        // Create new candidate
        response = await candidatesAPI.createCandidate(candidateData);
        if (response.success) {
          setError('');
          setSelectedJobForCandidate(null);
          setShowAddCandidateModal(false);
          // Reload jobs to refresh applicant counts
          loadJobs(page);
        } else {
          setError('Failed to add candidate');
        }
      }
    } catch (err) {
      console.error('Error saving candidate:', err);
      setError(editingCandidate ? 'Failed to update candidate' : 'Failed to add candidate');
    } finally {
      setLoading(false);
    }
  };

  const handleViewJobDetails = (job: JobPosting) => {
    setSelectedJob(job);
    setShowJobDetailsModal(true);
  };

  const handleEditJob = (job: JobPosting) => {
    setSelectedJob(job);
    setShowEditJobModal(true);
  };

  const handleEditJobSubmit = async (jobData: any) => {
    try {
      if (selectedJob) {
        const response = await jobsAPI.updateJob(selectedJob.id, jobData);
        if (response.success) {
          setError(''); // Clear any previous errors
          await loadJobs(page);
          setSelectedJob(null);
          setShowEditJobModal(false);
        } else {
          setError('Failed to update job');
        }
      }
    } catch (err) {
      console.error('Error updating job:', err);
      setError('Failed to update job');
    }
  };

  const handleAddJobSubmit = async (jobData: any) => {
    try {
      const response = await jobsAPI.createJob(jobData);
      if (response.success) {
        setError(''); // Clear any previous errors
        await loadJobs(page);
        setShowAddJobModal(false);
      } else {
        setError('Failed to create job');
      }
    } catch (err) {
      console.error('Error creating job:', err);
      setError('Failed to create job');
    }
  };

  // Toggle job selection for bulk actions
  const toggleJobSelection = (jobId: number) => {
    const newSelected = new Set(selectedJobIds);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobIds(newSelected);
  };

  // Select all visible jobs
  const selectAllJobs = () => {
    const allIds = new Set(displayJobs.map(job => job.id));
    setSelectedJobIds(allIds);
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedJobIds(new Set());
    setBulkSelectMode(false);
  };

  // Deactivate selected jobs
  const deactivateSelectedJobs = async () => {
    try {
      setLoading(true);
      // Update each selected job to set status as 'Closed' or add an 'archived' flag
      for (const jobId of selectedJobIds) {
        await jobsAPI.updateJob(jobId, { status: 'Closed' });
      }
      clearSelection();
      await loadJobs(page);
    } catch (err) {
      console.error('Error deactivating jobs:', err);
      setError('Failed to deactivate jobs');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <ProtectedComponent module="jobs" action="view">
      <div className="jobs-page-container">
        {/* Bottom-right stack: post new job, bulk import (candidates/create), then filter / archive / bulk select */}
        <div className="fab-bottom-right-stack">
          {/* Post New Job — only users with jobs/create */}
          {hasPermission('jobs', 'create') && (
            <button
              onClick={() => setShowAddJobModal(true)}
              className="fab fab-primary"
              title="Post New Job"
            >
              <Plus size={24} />
            </button>
          )}

          {hasPermission('candidates', 'create') && (
            <button
              onClick={() => setShowBulkImportModal(true)}
              className="fab fab-secondary"
              title="Bulk Import"
            >
              <Upload size={22} />
            </button>
          )}

          {/* Filter Button */}
          <div className="fab-filter-container">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className={`fab fab-filter ${showFilterMenu ? 'active' : ''}`}
              title="Filter by Status"
            >
              <Filter size={22} />
            </button>
            
            {/* Filter Menu */}
            {showFilterMenu && (
              <div className="filter-menu">
                <div className="filter-menu-header">Filter by Status</div>
                <button
                  onClick={() => {
                    setStatusFilter('All');
                    setPage(1);
                    setShowFilterMenu(false);
                  }}
                  className={`filter-menu-item ${statusFilter === 'All' ? 'active' : ''}`}
                >
                  All Status
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('Active');
                    setPage(1);
                    setShowFilterMenu(false);
                  }}
                  className={`filter-menu-item ${statusFilter === 'Active' ? 'active' : ''}`}
                >
                  Active
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('Paused');
                    setPage(1);
                    setShowFilterMenu(false);
                  }}
                  className={`filter-menu-item ${statusFilter === 'Paused' ? 'active' : ''}`}
                >
                  Paused
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('Closed');
                    setPage(1);
                    setShowFilterMenu(false);
                  }}
                  className={`filter-menu-item ${statusFilter === 'Closed' ? 'active' : ''}`}
                >
                  Closed
                </button>
              </div>
            )}
          </div>

          {/* Archived Jobs Button */}
          <button
            onClick={() => setShowArchivedJobs(!showArchivedJobs)}
            className={`fab fab-archive ${showArchivedJobs ? 'active' : ''}`}
            title="Archived Jobs"
          >
            <Briefcase size={22} />
          </button>

          {/* Bulk Select Button */}
          <button
            onClick={() => {
              setBulkSelectMode(!bulkSelectMode);
              if (bulkSelectMode) clearSelection();
            }}
            className={`fab fab-bulk-select ${bulkSelectMode ? 'active' : ''}`}
            title="Bulk Select"
          >
            <MoreVertical size={22} />
          </button>
        </div>



        {/* Loading State */}
        {loading && (
          <div className="jobs-loading" aria-live="polite">
            <span>Loading jobs...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="jobs-error">
            {error}
          </div>
        )}

        {/* Jobs Grid - Full Screen */}
        {!loading && (
          <>
            <div className="jobs-grid jobs-grid-compact jobs-grid-premium">
              {displayJobs.map((job) => (
                <div
                  key={job.id}
                  className={`job-card job-card-compact ${bulkSelectMode ? 'selectable' : ''} ${selectedJobIds.has(job.id) ? 'selected' : ''}`}
                >
                  {/* Bulk Select Checkbox */}
                  {bulkSelectMode && (
                    <div className="job-card-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedJobIds.has(job.id)}
                        onChange={() => toggleJobSelection(job.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}

                  <div className="job-card-header">
                    <div className="job-card-title-section">
                      <span className="job-department-tag">{job.department}</span>
                      <h3 className="job-title">{job.title}</h3>
                      <p className="job-location">
                        <MapPin size={12} className="job-location-icon" aria-hidden />
                        {job.location}
                      </p>
                    </div>
                    <div className="job-card-badges">
                      <span className={getStatusColor(job.status)}>
                        {job.status}
                      </span>
                    </div>
                  </div>

                  <div className="job-card-meta">
                    <div className="job-meta-row">
                      <span className="job-meta-label">
                        <Building2 size={12} className="job-meta-icon" aria-hidden />
                        Type
                      </span>
                      <span className="job-meta-value">{job.jobType}</span>
                    </div>
                    <div className="job-meta-row">
                      <span className="job-meta-label">
                        <CalendarDays size={12} className="job-meta-icon" aria-hidden />
                        Posted
                      </span>
                      <span className="job-meta-value">{new Date(job.postedDate).toLocaleDateString()}</span>
                    </div>
                    <div className="job-meta-row">
                      <span className="job-meta-label">
                        <Clock size={12} className="job-meta-icon" aria-hidden />
                        Deadline
                      </span>
                      <span className="job-meta-value job-deadline">
                        {isDeadlineNear(job.deadline) && (
                          <AlertCircle size={12} className="deadline-warning-icon" />
                        )}
                        {new Date(job.deadline).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="job-card-stats">
                    <div className="job-applicant-count">
                      <Users size={14} />
                      <span>{job.applicantCount || 0} applicants</span>
                    </div>
                  </div>

                  <div className="job-card-actions">
                    <button
                      onClick={() => handleViewJobDetails(job)}
                      className="btn-ghost btn-compact"
                    >
                      <Eye size={14} />
                      <span>Details</span>
                    </button>
                    <button
                      onClick={() => handleViewApplicants(job)}
                      className="btn-lavender btn-compact"
                    >
                      <Users size={14} />
                      <span>Applicants</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {(displayJobs?.length || 0) === 0 && (
              <div className="jobs-empty-state">
                <Briefcase size={48} className="empty-icon" />
                <h3 className="empty-title">No jobs found</h3>
                <p className="empty-description">
                  {hasPermission('jobs', 'create')
                    ? 'Try adjusting your filters or create a new job posting.'
                    : 'Try adjusting your filters or ask an admin to publish job postings.'}
                </p>
              </div>
            )}
          </>
        )}

        {/* Archived Jobs Modal */}
        {showArchivedJobs && (
          <div className="archived-jobs-modal">
            <div className="archived-jobs-content">
              <div className="archived-jobs-header">
                <h2>Archived Jobs</h2>
                <button onClick={() => setShowArchivedJobs(false)} className="close-btn">
                  ×
                </button>
              </div>
              <div className="archived-jobs-body">
                <p className="archived-jobs-info">Closed and deactivated jobs appear here.</p>
                {/* Placeholder for archived jobs - would need separate API call */}
                <div className="archived-jobs-list">
                  {displayJobs.filter(job => job.status === 'Closed').map((job) => (
                    <div key={job.id} className="archived-job-item">
                      <div className="archived-job-info">
                        <h4>{job.title}</h4>
                        <p>{job.department} • {job.location}</p>
                      </div>
                      <button
                        onClick={async () => {
                          await jobsAPI.updateJob(job.id, { status: 'Active' });
                          loadJobs(page);
                        }}
                        className="btn-reactivate"
                      >
                        Reactivate
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Job Modal */}
        <AddJobModal
          isOpen={showAddJobModal}
          onClose={() => setShowAddJobModal(false)}
          onSubmit={handleAddJobSubmit}
        />

        {/* Job Details Modal */}
        {showJobDetailsModal && selectedJob && (
          <JobDetailsModal
            job={selectedJob}
            allowEdit={hasPermission('jobs', 'edit')}
            onClose={() => {
              setShowJobDetailsModal(false);
              setSelectedJob(null);
            }}
            onEdit={(job) => {
              setShowJobDetailsModal(false);
              handleEditJob(job);
            }}
          />
        )}

        {/* Edit Job Modal */}
        {showEditJobModal && selectedJob && (
          <AddJobModal
            isOpen={showEditJobModal}
            onClose={() => {
              setShowEditJobModal(false);
              setSelectedJob(null);
            }}
            onSubmit={handleEditJobSubmit}
            editingJob={selectedJob}
          />
        )}
        {/* Add Candidate Modal */}
        <AddCandidateModal
          isOpen={showAddCandidateModal}
          onClose={() => {
            setShowAddCandidateModal(false);
            setSelectedJobForCandidate(null);
            setEditingCandidate(null);
          }}
          onSubmit={handleCandidateSubmit}
          jobs={selectedJobForCandidate ? [selectedJobForCandidate] : jobs}
          editingCandidate={editingCandidate}
          onEditExisting={(candidate) => setEditingCandidate(candidate)}
        />

        {/* Job Applicants Modal */}
        {selectedJob && (
          <JobApplicantsModal
            isOpen={showApplicantsModal}
            onClose={() => {
              setShowApplicantsModal(false);
              setSelectedJob(null);
            }}
            job={selectedJob}
            matchedJobIds={(selectedJob as any)._matchedIds}
            onAddCandidate={() => {
              setShowApplicantsModal(false);
              setSelectedJobForCandidate(selectedJob);
              setShowAddCandidateModal(true);
            }}
            onViewApplicantDetails={(applicant) => {
              setSelectedApplicant(applicant);
              setShowApplicantDetails(true);
            }}
            onEditApplicant={handleEditCandidate}
            onBulkImport={() => setShowBulkImportModal(true)}
          />
        )}

        {/* Applicant Details Modal */}
        <CandidateViewModal
          isOpen={showApplicantDetails}
          onClose={() => {
            setShowApplicantDetails(false);
            setSelectedApplicant(null);
          }}
          candidate={selectedApplicant}
        />

        {/* Bulk Import Modal */}
        <CandidateImportContainer
          isOpen={showBulkImportModal}
          onClose={() => setShowBulkImportModal(false)}
          onImportComplete={() => {
            setShowBulkImportModal(false);
            loadJobs(page);
          }}
        />
      </div>
    </ProtectedComponent>
  );
}