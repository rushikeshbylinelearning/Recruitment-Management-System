import React, { useState, useEffect } from 'react';
import { Search, Filter, Eye, MessageSquare, UserCheck, UserX, Clock, MapPin, Phone, Mail, Star } from 'lucide-react';
import { candidatesAPI } from '../services/api';

interface Candidate {
  id: number;
  jobId: number | null;
  name: string;
  email: string;
  phone: string;
  position: string;
  stage: string;
  source: string;
  appliedDate: string;
  resumePath: string | null;
  notes: string | null;
  score: number;
  assignedTo: string;
  skills: string[];
  experience: string;
  salary: {
    expected: string;
    offered: string;
    negotiable: boolean;
  };
  availability: {
    joiningTime: string;
    noticePeriod: string;
    immediateJoiner: boolean;
  };
  communications: any[];
  interviews: any[];
  communicationsCount: number;
  interviewsCount: number;
  location?: string;
  expertise?: string;
  workPreference?: string;
  currentCtc?: string;
  interviewDate?: string;
  interviewerId?: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function InterviewerCandidates() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [updatingNotes, setUpdatingNotes] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  // Fetch candidates data
  useEffect(() => {
    fetchCandidates();
  }, [pagination.page, searchTerm, selectedStage]);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const response = await candidatesAPI.getCandidates({
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        stage: selectedStage
      });

      if (response.success && response.data) {
        setCandidates(response.data.candidates || []);
        setPagination(prev => ({
          ...prev,
          ...response.data.pagination
        }));
      } else {
        setError('Failed to load candidates');
      }
    } catch (err) {
      console.error('Error fetching candidates:', err);
      setError('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchCandidates();
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleAddNotes = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setNotes(candidate.notes || '');
    setShowNotesModal(true);
  };

  const handleSaveNotes = async () => {
    if (!selectedCandidate) return;

    try {
      setUpdatingNotes(true);
      const response = await candidatesAPI.updateCandidate(selectedCandidate.id, {
        notes: notes
      });

      if (response.success) {
        // Update the candidate in the list
        setCandidates(prev => prev.map(c => 
          c.id === selectedCandidate.id ? { ...c, notes } : c
        ));
        setShowNotesModal(false);
        setSelectedCandidate(null);
        setNotes('');
      } else {
        setError('Failed to update notes');
      }
    } catch (err) {
      console.error('Error updating notes:', err);
      setError('Failed to update notes');
    } finally {
      setUpdatingNotes(false);
    }
  };

  const handleStageUpdate = async (candidateId: number, newStage: string) => {
    try {
      const response = await candidatesAPI.updateCandidate(candidateId, {
        stage: newStage
      });

      if (response.success) {
        // Update the candidate in the list
        setCandidates(prev => prev.map(c => 
          c.id === candidateId ? { ...c, stage: newStage } : c
        ));
      } else {
        setError('Failed to update candidate stage');
      }
    } catch (err) {
      console.error('Error updating stage:', err);
      setError('Failed to update candidate stage');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStageColor = (stage: string) => {
    switch (stage.toLowerCase()) {
      case 'applied':
        return 'bg-blue-100 text-blue-800';
      case 'screening':
        return 'bg-yellow-100 text-yellow-800';
      case 'interview':
        return 'bg-orange-100 text-orange-800';
      case 'offer':
        return 'bg-purple-100 text-purple-800';
      case 'hired':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-green-600';
    if (score >= 3) return 'text-yellow-600';
    return 'text-red-600';
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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Candidates</h1>
        <p className="text-gray-600 mt-1">Review candidates and provide interview feedback</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <form onSubmit={handleSearch} className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search candidates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex gap-4">
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Stages</option>
              <option value="Applied">Applied</option>
              <option value="Screening">Screening</option>
              <option value="Interview">Interview</option>
              <option value="Offer">Offer</option>
              <option value="Hired">Hired</option>
              <option value="Rejected">Rejected</option>
            </select>

            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Candidates Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {candidates.length > 0 ? (
          candidates.map((candidate) => (
            <div key={candidate.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="p-6">
                {/* Candidate Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{candidate.name}</h3>
                    <p className="text-gray-600 text-sm">{candidate.position}</p>
                    <div className="flex items-center mt-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStageColor(candidate.stage)}`}>
                        {candidate.stage}
                      </span>
                      {candidate.score > 0 && (
                        <div className="flex items-center ml-2">
                          <Star size={14} className={`mr-1 ${getScoreColor(candidate.score)}`} />
                          <span className={`text-xs font-medium ${getScoreColor(candidate.score)}`}>
                            {candidate.score}/5
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Candidate Details */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-gray-600 text-sm">
                    <Mail size={16} className="mr-2" />
                    <span className="truncate">{candidate.email}</span>
                  </div>
                  
                  <div className="flex items-center text-gray-600 text-sm">
                    <Phone size={16} className="mr-2" />
                    <span>{candidate.phone}</span>
                  </div>
                  
                  {candidate.location && (
                    <div className="flex items-center text-gray-600 text-sm">
                      <MapPin size={16} className="mr-2" />
                      <span>{candidate.location}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center text-gray-600 text-sm">
                    <Clock size={16} className="mr-2" />
                    <span>Applied: {formatDate(candidate.appliedDate)}</span>
                  </div>
                </div>

                {/* Skills */}
                {candidate.skills && candidate.skills.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {candidate.skills.slice(0, 3).map((skill, index) => (
                        <span key={index} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                          {skill}
                        </span>
                      ))}
                      {candidate.skills.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          +{candidate.skills.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes Preview */}
                {candidate.notes && (
                  <div className="mb-4">
                    <p className="text-gray-700 text-sm line-clamp-2">
                      {candidate.notes}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleStageUpdate(candidate.id, 'Interview')}
                      className="flex items-center space-x-1 px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs hover:bg-orange-100 transition-colors"
                    >
                      <UserCheck size={14} />
                      <span>Interview</span>
                    </button>
                    <button
                      onClick={() => handleStageUpdate(candidate.id, 'Rejected')}
                      className="flex items-center space-x-1 px-2 py-1 bg-red-50 text-red-700 rounded text-xs hover:bg-red-100 transition-colors"
                    >
                      <UserX size={14} />
                      <span>Reject</span>
                    </button>
                  </div>
                  <button
                    onClick={() => handleAddNotes(candidate)}
                    className="flex items-center space-x-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs hover:bg-blue-100 transition-colors"
                  >
                    <MessageSquare size={14} />
                    <span>Notes</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <div className="text-gray-400 mb-4">
              <Users size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No candidates found</h3>
            <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center items-center space-x-2">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`px-3 py-2 text-sm border rounded-lg ${
                page === pagination.page
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {page}
            </button>
          ))}
          
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.pages}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}

      {/* Notes Modal */}
      {showNotesModal && selectedCandidate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add Notes for {selectedCandidate.name}
            </h3>
            
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your interview notes and feedback..."
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => setShowNotesModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                disabled={updatingNotes}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {updatingNotes ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
