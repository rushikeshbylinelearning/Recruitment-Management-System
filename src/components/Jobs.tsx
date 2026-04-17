import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, MoreVertical, Eye, Edit, Users, UserPlus, Briefcase, ChevronLeft, ChevronRight } from 'lucide-react';
import { JobPosting } from '../types';
import { jobsAPI, JobPosting as ApiJobPosting, candidatesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ProtectedComponent from './ProtectedComponent';
import AddCandidateModal from './AddCandidateModal';
import AddJobModal from './AddJobModal';
import JobDetailsModal from './JobDetailsModal';
import JobApplicantsModal from './JobApplicantsModal';
import ApplicantDetailsModal from './ApplicantDetailsModal';

const JOBS_PAGE_SIZE = 10;

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
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false);
  const [showEditJobModal, setShowEditJobModal] = useState(false);
  const [selectedJobForCandidate, setSelectedJobForCandidate] = useState<JobPosting | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [showApplicantsModal, setShowApplicantsModal] = useState(false);
  const [showApplicantDetails, setShowApplicantDetails] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState<any>(null);
  const [editingCandidate, setEditingCandidate] = useState<any>(null);

  // Load jobs from backend with pagination and filters
  const loadJobs = useCallback(async (pageNum: number) => {
    try {
      setLoading(true);
      const response = await jobsAPI.getJobs({
        page: pageNum,
        limit: JOBS_PAGE_SIZE,
        search: searchTerm.trim() || undefined,
        status: statusFilter === 'All' ? undefined : statusFilter,
      });
      if (response.success && response.data) {
        setJobs(response.data.jobs || []);
        setPagination(response.data.pagination ?? null);
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

  // Jobs are already filtered by the API; display current page results
  const displayJobs = jobs || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Paused': return 'bg-yellow-100 text-yellow-800';
      case 'Closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
  
  return (
    <ProtectedComponent module="jobs" action="view">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Job Openings</h1>
          <p className="text-gray-600 mt-1">Manage all your job postings and requirements</p>
        </div>
        {hasPermission('jobs', 'create') && (
          <button
            onClick={() => setShowAddJobModal(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            <span>Post New Job</span>
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading jobs...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters and Jobs List */}
      {!loading && (
        <>
          {/* Filters */}
          <div className="flex space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Paused">Paused</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayJobs.map((job) => (
          <div key={job.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
                <p className="text-sm text-gray-600">{job.department} • {job.location}</p>
              </div>
              <div className="flex space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                  {job.status}
                </span>
                <button className="text-gray-400 hover:text-gray-600">
                  <MoreVertical size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Job Type:</span>
                <span className="text-gray-900">{job.jobType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Posted:</span>
                <span className="text-gray-900">{new Date(job.postedDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Deadline:</span>
                <span className="text-gray-900">{new Date(job.deadline).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Users size={16} className="text-blue-600" />
                <span className="text-sm text-gray-600">{job.applicantCount} applicants</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-500">{job.portals.length} portals</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex space-x-2">
                <button
                  onClick={() => handleViewJobDetails(job)}
                  className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Eye size={16} />
                  <span>View Details</span>
                </button>
                {hasPermission('jobs', 'edit') && (
                  <button 
                    onClick={() => handleEditJob(job)}
                    className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Edit job"
                  >
                    <Edit size={16} className="text-gray-600" />
                  </button>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleViewApplicants(job)}
                  className="flex-1 flex items-center justify-center space-x-2 bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  <Users size={16} />
                  <span>View Applicants</span>
                </button>
                {hasPermission('candidates', 'create') && (
                  <button 
                    onClick={() => handleAddCandidateToJob(job)}
                    className="flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    title="Add candidate to this job"
                  >
                    <UserPlus size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

          {(displayJobs?.length || 0) === 0 && (
            <div className="text-center py-12">
              <Briefcase size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
              <p className="text-gray-600">Try adjusting your search criteria or create a new job posting.</p>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} jobs
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={18} />
                  Previous
                </button>
                <span className="px-3 py-2 text-sm text-gray-600">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={pagination.page >= pagination.pages}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
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
        />
      )}

      {/* Applicant Details Modal */}
      <ApplicantDetailsModal
        isOpen={showApplicantDetails}
        onClose={() => {
          setShowApplicantDetails(false);
          setSelectedApplicant(null);
        }}
        applicant={selectedApplicant}
      />

      </div>
    </ProtectedComponent>
  );
}