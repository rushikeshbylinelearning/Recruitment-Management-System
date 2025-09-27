import { useState, useEffect } from 'react';
import { Search, User, Mail, Phone, Star, ArrowRight, UserPlus, Upload, Clock, Eye, Edit, Trash2, Download, FileText, Users, DollarSign, CheckCircle, XCircle, Briefcase } from 'lucide-react';
import { Candidate } from '../types';
import { candidatesAPI, Candidate as ApiCandidate, jobsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import AddCandidateModal from './AddCandidateModal';
import BulkImportModal from './BulkImportModal';
import CandidateViewModal from './CandidateViewModal';
import ProtectedComponent from './ProtectedComponent';

export default function Candidates() {
  const { hasPermission } = useAuth();
  const [candidates, setCandidates] = useState<ApiCandidate[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<ApiCandidate | null>(null);
  const [editingCandidate, setEditingCandidate] = useState<ApiCandidate | null>(null);

  const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

  // Load candidates and jobs from backend
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [candidatesResponse, jobsResponse] = await Promise.all([
          candidatesAPI.getCandidates(),
          jobsAPI.getJobs()
        ]);
        
        if (candidatesResponse.success && candidatesResponse.data) {
          setCandidates(candidatesResponse.data.candidates || []);
        } else {
          setError('Failed to load candidates');
        }
        
        if (jobsResponse.success && jobsResponse.data) {
          setJobs(jobsResponse.data.jobs || []);
        } else {
          setError('Failed to load jobs');
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);
  
  const filteredCandidates = candidates.filter((candidate) => {
    const matchesSearch = candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         candidate.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === 'All' || candidate.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Applied': return {
        header: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
        badge: 'bg-blue-100 text-blue-800 border-blue-200',
        accent: 'border-blue-200'
      };
      case 'Screening': return {
        header: 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white',
        badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        accent: 'border-yellow-200'
      };
      case 'Interview': return {
        header: 'bg-gradient-to-r from-orange-500 to-orange-600 text-white',
        badge: 'bg-orange-100 text-orange-800 border-orange-200',
        accent: 'border-orange-200'
      };
      case 'Offer': return {
        header: 'bg-gradient-to-r from-purple-500 to-purple-600 text-white',
        badge: 'bg-purple-100 text-purple-800 border-purple-200',
        accent: 'border-purple-200'
      };
      case 'Hired': return {
        header: 'bg-gradient-to-r from-green-500 to-green-600 text-white',
        badge: 'bg-green-100 text-green-800 border-green-200',
        accent: 'border-green-200'
      };
      case 'Rejected': return {
        header: 'bg-gradient-to-r from-red-500 to-red-600 text-white',
        badge: 'bg-red-100 text-red-800 border-red-200',
        accent: 'border-red-200'
      };
      default: return {
        header: 'bg-gradient-to-r from-gray-500 to-gray-600 text-white',
        badge: 'bg-gray-100 text-gray-800 border-gray-200',
        accent: 'border-gray-200'
      };
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'Applied': return <FileText size={20} className="text-blue-600" />;
      case 'Screening': return <Search size={20} className="text-yellow-600" />;
      case 'Interview': return <Users size={20} className="text-orange-600" />;
      case 'Offer': return <DollarSign size={20} className="text-purple-600" />;
      case 'Hired': return <CheckCircle size={20} className="text-green-600" />;
      case 'Rejected': return <XCircle size={20} className="text-red-600" />;
      default: return <Briefcase size={20} className="text-gray-600" />;
    }
  };

  const candidatesByStage = stages.reduce((acc, stage) => {
    acc[stage] = filteredCandidates.filter(candidate => candidate.stage === stage);
    return acc;
  }, {} as Record<string, Candidate[]>);

  // Handler functions

  const handleBulkImport = async (candidatesData: any[]) => {
    try {
      setLoading(true);
      
      // Use the bulk import endpoint
      const response = await candidatesAPI.bulkImportCandidates(candidatesData);
      
      if (response.success) {
        setError('');
        // Reload candidates
        const candidatesResponse = await candidatesAPI.getCandidates();
        if (candidatesResponse.success && candidatesResponse.data) {
          setCandidates(candidatesResponse.data.candidates || []);
        }
        setShowBulkImportModal(false);
      } else {
        setError('Failed to import candidates');
      }
    } catch (err) {
      setError('Failed to import candidates');
    } finally {
      setLoading(false);
    }
  };


  const handleShowResumeParser = () => {
    // Create a hidden file input for resume parsing
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.txt';
    input.style.display = 'none';
    
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        setLoading(true);
        
        // Import the resume parser
        const { parseResume } = await import('../utils/resumeParser');
        
        // Parse the resume
        const parsedData = await parseResume(file);
        
        // Set the parsed data and open the modal
        setEditingCandidate({
          id: 0, // Temporary ID for new candidate
          name: parsedData.name || '',
          email: parsedData.email || '',
          phone: parsedData.phone || '',
          position: parsedData.expertise || '',
          stage: 'Applied',
          source: 'Resume Parser',
          appliedDate: new Date().toISOString(),
          notes: parsedData.notes || '',
          score: 0,
          skills: parsedData.skills || [],
          experience: parsedData.experience || '',
          salary: {
            expected: parsedData.expectedSalary || '',
            offered: '',
            negotiable: true
          },
          availability: {
            joiningTime: '',
            noticePeriod: parsedData.noticePeriod || '',
            immediateJoiner: parsedData.immediateJoiner || false
          },
          location: parsedData.location || '',
          expertise: parsedData.expertise || '',
          willingAlternateSaturday: parsedData.willingAlternateSaturday,
          workPreference: parsedData.workPreference || '',
          currentCtc: parsedData.currentCtc || '',
          ctcFrequency: 'Annual',
          inHouseAssignmentStatus: 'Pending',
          interviewDate: '',
          interviewerId: null,
          inOfficeAssignment: '',
          assignmentLocation: '',
          resumeLocation: '',
          communications: [],
          interviews: [],
          communicationsCount: 0,
          interviewsCount: 0,
          assignedTo: 'Unassigned',
          jobId: jobs.length > 0 ? jobs[0].id : null,
          resumeFileId: null,
          resume: file.name
        } as any);
        
        setShowAddModal(true);
        setError('');
        
      } catch (error) {
        console.error('Resume parsing error:', error);
        setError(error instanceof Error ? error.message : 'Failed to parse resume');
      } finally {
        setLoading(false);
      }
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  // CRUD Operations
  const handleViewCandidate = (candidate: ApiCandidate) => {
    setSelectedCandidate(candidate);
    setShowViewModal(true);
  };

  const handleEditCandidate = (candidate: ApiCandidate) => {
    setEditingCandidate(candidate);
    setShowAddModal(true);
  };

  const handleDeleteCandidate = async (candidateId: number) => {
    if (!confirm('Are you sure you want to delete this candidate?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await candidatesAPI.deleteCandidate(candidateId);
      if (response.success) {
        setCandidates(candidates.filter(c => c.id !== candidateId));
        setError('');
      } else {
        setError('Failed to delete candidate');
      }
    } catch (err) {
      console.error('Error deleting candidate:', err);
      setError('Failed to delete candidate');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadResume = async (candidateId: number) => {
    try {
      setLoading(true);
      const blob = await candidatesAPI.downloadResume(candidateId);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Get original filename from metadata
      const metadataResponse = await candidatesAPI.getResumeMetadata(candidateId);
      const filename = metadataResponse.data?.originalName || `resume_${candidateId}.pdf`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading resume:', err);
      setError('Failed to download resume');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCandidate = async (candidateData: any) => {
    try {
      setLoading(true);
      
      if (editingCandidate && editingCandidate.id > 0) {
        // Update existing candidate
        const response = await candidatesAPI.updateCandidate(editingCandidate.id, candidateData);
        if (response.success) {
          // Refresh candidates list
          const candidatesResponse = await candidatesAPI.getCandidates();
          if (candidatesResponse.success && candidatesResponse.data) {
            setCandidates(candidatesResponse.data.candidates || []);
          }
          setEditingCandidate(null);
          setShowAddModal(false);
          setError('');
        } else {
          setError('Failed to update candidate');
        }
      } else {
        // Create new candidate
        const response = await candidatesAPI.createCandidate(candidateData);
        if (response.success) {
          // Refresh candidates list
          const candidatesResponse = await candidatesAPI.getCandidates();
          if (candidatesResponse.success && candidatesResponse.data) {
            setCandidates(candidatesResponse.data.candidates || []);
          }
          setShowAddModal(false);
          setError('');
        } else {
          setError('Failed to create candidate');
        }
      }
    } catch (err) {
      console.error('Error saving candidate:', err);
      setError('Failed to save candidate');
    } finally {
      setLoading(false);
    }
  };

  // Function for list view candidate selection
  const onCandidateSelect = (candidate: ApiCandidate) => {
    setSelectedCandidate(candidate);
    setShowViewModal(true);
  };

  const CandidateCard = ({ candidate }: { candidate: ApiCandidate }) => {
    return (
      <div 
        className="group relative bg-white rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-lg hover:border-gray-300 transition-all duration-200 transform hover:-translate-y-1"
        onClick={() => onCandidateSelect(candidate)}
      >
        {/* Header with avatar and score */}
        <div className="p-4 pb-3">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {candidate.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 text-sm">{candidate.name}</h4>
                <p className="text-xs text-gray-600 truncate max-w-32">{candidate.position}</p>
              </div>
            </div>
            <div className="flex items-center space-x-1 bg-yellow-50 px-2 py-1 rounded-full">
              <Star size={12} className="text-yellow-500 fill-current" />
              <span className="text-xs font-medium text-yellow-700">{candidate.score}/5</span>
            </div>
          </div>
          
          {/* Salary info */}
          {candidate.salary?.expected && (
            <div className="mb-3">
              <div className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                Expected: {candidate.salary.expected}
              </div>
            </div>
          )}
        </div>
        
        {/* Contact info */}
        <div className="px-4 pb-3 space-y-2">
          <div className="flex items-center space-x-2 text-xs text-gray-600">
            <Mail size={12} className="text-gray-400" />
            <span className="truncate">{candidate.email}</span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-600">
            <Phone size={12} className="text-gray-400" />
            <span>{candidate.phone}</span>
          </div>
          {candidate.availability?.joiningTime && (
            <div className="flex items-center space-x-2 text-xs text-gray-600">
              <Clock size={12} className="text-gray-400" />
              <span>Can join in {candidate.availability.joiningTime}</span>
            </div>
          )}
        </div>
        
        {/* Interview status */}
        {candidate.interviews && (candidate.interviews?.length || 0) > 0 && (
          <div className="px-4 pb-3">
            <div className="bg-blue-50 rounded-lg p-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-700 font-medium">
                  {candidate.interviews?.filter(i => i.status === 'Completed')?.length || 0} interviews done
                </span>
                {candidate.interviews?.some(i => i.status === 'Scheduled') && (
                  <span className="px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full text-xs font-medium">
                    Scheduled
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Footer with source and date */}
        <div className="px-4 py-3 bg-gray-50 rounded-b-xl border-t border-gray-100">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span className="font-medium">{candidate.source}</span>
            <span>{new Date(candidate.appliedDate).toLocaleDateString()}</span>
          </div>
        </div>
        
        {/* Action buttons overlay */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex space-x-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewCandidate(candidate);
              }}
              className="p-1.5 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors"
              title="View Details"
            >
              <Eye size={12} className="text-gray-600" />
            </button>
            {hasPermission('candidates', 'edit') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditCandidate(candidate);
                }}
                className="p-1.5 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-green-50 hover:border-green-200 transition-colors"
                title="Edit Candidate"
              >
                <Edit size={12} className="text-gray-600" />
              </button>
            )}
            {(candidate as any).resumeFileId && hasPermission('candidates', 'view') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadResume(candidate.id);
                }}
                className="p-1.5 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-purple-50 hover:border-purple-200 transition-colors"
                title="Download Resume"
              >
                <Download size={12} className="text-gray-600" />
              </button>
            )}
            {hasPermission('candidates', 'delete') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCandidate(candidate.id);
                }}
                className="p-1.5 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-colors"
                title="Delete Candidate"
              >
                <Trash2 size={12} className="text-gray-600" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading candidates...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedComponent module="candidates" action="view">
      <div className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Candidates</h1>
            <p className="text-gray-600 mt-1">Track and manage all your job applicants</p>
          </div>
          <div className="flex space-x-3">
            {hasPermission('candidates', 'create') && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <UserPlus size={20} />
                <span>Add Candidate</span>
              </button>
            )}
            {hasPermission('candidates', 'create') && (
              <button
                onClick={handleShowResumeParser}
                className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Upload size={20} />
                <span>Parse Resume</span>
              </button>
            )}
            {hasPermission('candidates', 'create') && (
              <button
                onClick={() => setShowBulkImportModal(true)}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Upload size={20} />
                <span>Bulk Import</span>
              </button>
            )}
          {/* <button
            onClick={handleShowAdvancedSearch}
            className="flex items-center space-x-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
          >
            <Search size={20} />
            <span>Advanced Search</span>
          </button> */}
          <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200 shadow-inner">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ease-in-out transform ${
                viewMode === 'kanban' 
                  ? 'bg-white text-blue-600 shadow-md border border-blue-200 scale-105' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ease-in-out transform ${
                viewMode === 'list' 
                  ? 'bg-white text-blue-600 shadow-md border border-blue-200 scale-105' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search candidates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="All">All Stages</option>
          {stages.map(stage => (
            <option key={stage} value={stage}>{stage}</option>
          ))}
        </select>
      </div>

      {/* Kanban View */}
      {viewMode === 'kanban' && (
        <div className="space-y-6">
          {/* Kanban Board */}
          <div className="flex gap-6 overflow-x-auto pb-4">
            {stages.map((stage) => {
              const stageColors = getStageColor(stage);
              const stageCandidates = candidatesByStage[stage] || [];
              
              return (
                <div key={stage} className="flex-shrink-0 w-80">
                  {/* Stage Header */}
                  <div className={`${stageColors.header} p-4 rounded-t-xl shadow-sm`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-white text-sm">{stage}</h3>
                        <span className="bg-white bg-opacity-20 text-white text-xs px-2 py-1 rounded-full font-medium">
                          {stageCandidates.length}
                        </span>
                      </div>
                      {stageCandidates.length > 0 && (
                        <div className="text-white text-xs opacity-75">
                          {stageCandidates.length} candidate{stageCandidates.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Stage Content */}
                  <div className="bg-gray-50 p-4 rounded-b-xl min-h-96 border-l-4 border-r border-b border-gray-200" style={{borderLeftColor: stageColors.header.includes('blue') ? '#3B82F6' : stageColors.header.includes('yellow') ? '#EAB308' : stageColors.header.includes('orange') ? '#F97316' : stageColors.header.includes('purple') ? '#8B5CF6' : stageColors.header.includes('green') ? '#10B981' : stageColors.header.includes('red') ? '#EF4444' : '#6B7280'}}>
                    {stageCandidates.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-3">
                          <User size={24} className="text-gray-400" />
                        </div>
                        <p className="text-sm font-medium">No candidates</p>
                        <p className="text-xs text-center">Candidates will appear here when they reach this stage</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {stageCandidates.map((candidate) => (
                          <CandidateCard key={candidate.id} candidate={candidate} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Kanban Stats */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {stages.map((stage) => {
                const count = candidatesByStage[stage]?.length || 0;
                const percentage = filteredCandidates.length > 0 ? Math.round((count / filteredCandidates.length) * 100) : 0;
                const stageColors = getStageColor(stage);
                
                return (
                  <div key={stage} className="text-center">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${stageColors.badge} mb-2`}>
                      <span className="text-lg font-bold">{count}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{stage}</p>
                    <p className="text-xs text-gray-500">{percentage}% of total</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Candidate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Applied
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCandidates.map((candidate) => (
                  <tr key={candidate.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{candidate.name}</div>
                        <div className="text-sm text-gray-500">{candidate.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {candidate.position}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStageColor(candidate.stage).badge}`}>
                        {candidate.stage}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {candidate.source}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(candidate.appliedDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Star size={14} className="text-yellow-500 mr-1" />
                        <span className="text-sm text-gray-900">{candidate.score}/5</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => onCandidateSelect(candidate)}
                        className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                      >
                        <span>View</span>
                        <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(filteredCandidates?.length || 0) === 0 && (
        <div className="text-center py-12">
          <User size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No candidates found</h3>
          <p className="text-gray-600">Try adjusting your search criteria.</p>
        </div>
      )}

      {/* Add/Edit Candidate Modal */}
      <AddCandidateModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingCandidate(null);
        }}
        onSubmit={handleUpdateCandidate}
        jobs={jobs}
        editingCandidate={editingCandidate}
      />

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onImport={handleBulkImport}
        jobs={jobs}
      />

      {/* Candidate View Modal */}
      <CandidateViewModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedCandidate(null);
        }}
        candidate={selectedCandidate}
      />

      </div>
    </ProtectedComponent>
  );
}