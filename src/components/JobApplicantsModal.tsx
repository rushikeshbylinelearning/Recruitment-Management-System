import { useState, useEffect } from 'react';
import { X, Eye, Edit, Trash2, Plus, Search } from 'lucide-react';
import { JobPosting, Candidate } from '../types';
import { candidatesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface JobApplicantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobPosting;
  onAddCandidate: () => void;
  onViewApplicantDetails?: (applicant: Candidate) => void;
  onEditApplicant?: (applicant: Candidate) => void;
}

export default function JobApplicantsModal({ isOpen, onClose, job, onAddCandidate, onViewApplicantDetails, onEditApplicant }: JobApplicantsModalProps) {
  const { hasPermission } = useAuth();
  const [applicants, setApplicants] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  // const [selectedApplicant, setSelectedApplicant] = useState<Candidate | null>(null);

  // Load applicants for this job
  useEffect(() => {
    if (isOpen && job) {
      loadApplicants();
    }
  }, [isOpen, job]);

  const loadApplicants = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get all candidates and filter by job
      const response = await candidatesAPI.getCandidates();
      if (response.success && response.data) {
        // Filter candidates by position (since jobId might not be available in the type)
        const jobApplicants = response.data.candidates.filter(candidate => 
          candidate.position === job.title
        );
        setApplicants(jobApplicants);
      } else {
        setError('Failed to load applicants');
      }
    } catch (err) {
      console.error('Error loading applicants:', err);
      setError('Failed to load applicants');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteApplicant = async (applicantId: number) => {
    if (!window.confirm('Are you sure you want to delete this applicant?')) {
      return;
    }

    try {
      const response = await candidatesAPI.deleteCandidate(applicantId);
      if (response.success) {
        setApplicants(prev => prev.filter(app => app.id !== applicantId));
        setError('');
      } else {
        setError('Failed to delete applicant');
      }
    } catch (err) {
      console.error('Error deleting applicant:', err);
      setError('Failed to delete applicant');
    }
  };

  const handleViewDetails = (applicant: Candidate) => {
    if (onViewApplicantDetails) {
      onViewApplicantDetails(applicant);
    }
  };

  const handleEditApplicant = (applicant: Candidate) => {
    if (onEditApplicant) {
      onEditApplicant(applicant);
    }
  };

  // This function can be used when edit functionality is implemented
  // const handleApplicantUpdated = (updatedApplicant: Candidate) => {
  //   setApplicants(prev => prev.map(app => 
  //     app.id === updatedApplicant.id ? updatedApplicant : app
  //   ));
  // };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Applied': return 'bg-blue-100 text-blue-800';
      case 'Screening': return 'bg-yellow-100 text-yellow-800';
      case 'Interview': return 'bg-purple-100 text-purple-800';
      case 'Offer': return 'bg-green-100 text-green-800';
      case 'Hired': return 'bg-emerald-100 text-emerald-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredApplicants = applicants.filter(applicant => {
    const matchesSearch = applicant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         applicant.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === 'All' || applicant.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Applicants for "{job.title}"</h2>
            <p className="text-sm text-gray-600 mt-1">{filteredApplicants.length} applicant(s) found</p>
          </div>
          <div className="flex items-center space-x-3">
            {hasPermission('candidates', 'create') && (
              <button
                onClick={onAddCandidate}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                <span>Add Candidate</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search applicants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600">{error}</p>
              <button
                onClick={loadApplicants}
                className="mt-2 text-blue-600 hover:text-blue-800"
              >
                Try again
              </button>
            </div>
          ) : filteredApplicants.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No applicants found for this job.</p>
              {hasPermission('candidates', 'create') && (
                <button
                  onClick={onAddCandidate}
                  className="mt-2 text-blue-600 hover:text-blue-800"
                >
                  Add the first candidate
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredApplicants.map((applicant) => (
                <div key={applicant.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium">
                            {applicant.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{applicant.name}</h3>
                          <p className="text-sm text-gray-600">{applicant.email}</p>
                          <p className="text-sm text-gray-500">{applicant.phone}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStageColor(applicant.stage)}`}>
                        {applicant.stage}
                      </span>
                      <span className="text-sm text-gray-500">
                        Score: {applicant.score}/10
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(applicant.appliedDate).toLocaleDateString()}
                      </span>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewDetails(applicant)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="View details"
                        >
                          <Eye size={16} />
                        </button>
                        {hasPermission('candidates', 'edit') && (
                          <button
                            onClick={() => handleEditApplicant(applicant)}
                            className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                            title="Edit applicant"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {hasPermission('candidates', 'delete') && (
                          <button
                            onClick={() => handleDeleteApplicant(applicant.id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="Delete applicant"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
