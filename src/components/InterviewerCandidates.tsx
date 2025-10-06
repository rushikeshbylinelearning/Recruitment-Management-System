import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, Clock, MapPin, Phone, Mail, Star, Users, ChevronDown, Calendar, Video, User } from 'lucide-react';
import { candidatesAPI, interviewsAPI, Candidate } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface InterviewData {
  id: number;
  candidate_id: number;
  scheduled_date: string;
  type: string;
  status: string;
  location?: string;
  meeting_link?: string;
  notes?: string;
  candidate_name?: string;
  candidate_position?: string;
}

export default function InterviewerCandidates() {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<InterviewData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [recommendation, setRecommendation] = useState('');
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
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      // Get interviews assigned to this interviewer
      const interviewsResponse = await interviewsAPI.getInterviews({ 
        interviewerId: user.id,
        limit: 100 
      });
      
      if (interviewsResponse.success && interviewsResponse.data) {
        const allInterviews = interviewsResponse.data.interviews || [];
        setInterviews(allInterviews);
        
        // Get unique candidate IDs from interviews
        const candidateIds = [...new Set(allInterviews.map(i => i.candidate_id))];
        
        // Get candidate details for assigned candidates
        const candidatesResponse = await candidatesAPI.getCandidates({ limit: 100 });
        const allCandidates = candidatesResponse.success && candidatesResponse.data ? candidatesResponse.data.candidates || [] : [];
        
        // Filter candidates to only show assigned ones
        let assignedCandidates = allCandidates.filter(c => candidateIds.includes(c.id));
        
        // Apply search filter
        if (searchTerm) {
          assignedCandidates = assignedCandidates.filter(candidate =>
            candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            candidate.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
            candidate.email.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        
        // Apply stage filter
        if (selectedStage) {
          assignedCandidates = assignedCandidates.filter(candidate => candidate.stage === selectedStage);
        }
        
        // Apply pagination
        const startIndex = (pagination.page - 1) * pagination.limit;
        const endIndex = startIndex + pagination.limit;
        const paginatedCandidates = assignedCandidates.slice(startIndex, endIndex);
        
        setCandidates(paginatedCandidates);
        setPagination(prev => ({
          ...prev,
          total: assignedCandidates.length,
          pages: Math.ceil(assignedCandidates.length / pagination.limit)
        }));
      } else {
        setError('Failed to load assigned candidates');
      }
    } catch (err) {
      console.error('Error fetching assigned candidates:', err);
      setError('Failed to load assigned candidates');
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
    // Handle new notes format - if it's an array, get the latest note or empty string
    let existingNotes = '';
    let existingRecommendation = '';
    
    if (candidate.notes && Array.isArray(candidate.notes) && candidate.notes.length > 0) {
      // Find the latest note from the current interviewer
      const interviewerNotes = candidate.notes.filter((note: any) => note.user_id === user?.id);
      if (interviewerNotes.length > 0) {
        const latestNote = interviewerNotes[interviewerNotes.length - 1];
        existingNotes = latestNote.notes || '';
        existingRecommendation = latestNote.recommendation || '';
      }
    } else if (typeof candidate.notes === 'string') {
      existingNotes = candidate.notes;
    }
    
    setNotes(existingNotes);
    setRecommendation(existingRecommendation);
    setShowNotesModal(true);
  };

  const handleSaveNotes = async () => {
    if (!selectedCandidate) return;

    try {
      setUpdatingNotes(true);
      // Use the interview-specific notes endpoint for interviewers
      const response = await candidatesAPI.addInterviewNote(selectedCandidate.id, {
        notes: notes,
        recommendation: recommendation
      });

      if (response.success) {
        // Refresh the candidates list to get updated notes
        fetchCandidates();
        setShowNotesModal(false);
        setSelectedCandidate(null);
        setNotes('');
        setRecommendation('');
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

  const getScoreColor = (score: number | string) => {
    const numScore = typeof score === 'string' ? parseFloat(score) : score;
    if (numScore >= 4) return 'text-green-600';
    if (numScore >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getInterviewForCandidate = (candidateId: number) => {
    return interviews.find(interview => interview.candidate_id === candidateId);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    };
  };

  const getInterviewStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-100 text-blue-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      case 'Rescheduled': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
        <h1 className="text-3xl font-bold text-gray-900">Your Assigned Candidates</h1>
        <p className="text-gray-600 mt-1">Review candidates assigned to you for interviews and manage interview notes</p>
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
                      {parseFloat(String(candidate.score || '0')) > 0 && (
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

                {/* Interview Details */}
                {(() => {
                  const interview = getInterviewForCandidate(candidate.id);
                  if (interview) {
                    const { date, time } = formatDateTime(interview.scheduled_date);
                    return (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-blue-900">Interview Details</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getInterviewStatusColor(interview.status)}`}>
                            {interview.status}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center text-blue-700 text-sm">
                            <Calendar size={14} className="mr-2" />
                            <span>{date} at {time}</span>
                          </div>
                          <div className="flex items-center text-blue-700 text-sm">
                            <User size={14} className="mr-2" />
                            <span>{interview.type}</span>
                          </div>
                          {interview.location && (
                            <div className="flex items-center text-blue-700 text-sm">
                              <MapPin size={14} className="mr-2" />
                              <span>{interview.location}</span>
                            </div>
                          )}
                          {interview.meeting_link && (
                            <div className="flex items-center text-blue-700 text-sm">
                              <Video size={14} className="mr-2" />
                              <a href={interview.meeting_link} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800">
                                Join Meeting
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

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

                {/* Notes Preview - Only show interviewer's notes */}
                {candidate.notes && Array.isArray(candidate.notes) && (
                  <div className="mb-4">
                    {(() => {
                      const interviewerNotes = candidate.notes.filter((note: any) => note.user_id === user?.id);
                      if (interviewerNotes.length > 0) {
                        return (
                          <div className="space-y-2">
                            {interviewerNotes.slice(0, 2).map((note: any, index: number) => (
                              <div key={note.id || index} className="text-gray-700 text-sm">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-xs text-blue-600">Your Note</span>
                                  <span className="text-xs text-gray-500">
                                    {new Date(note.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="line-clamp-1">{note.notes}</p>
                                {note.recommendation && (
                                  <div className="mt-1">
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                      note.recommendation === 'Recommend' ? 'bg-green-100 text-green-800' :
                                      note.recommendation === 'Don\'t Recommend' ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {note.recommendation === 'Recommend' ? 'Recommend for next round' :
                                       note.recommendation === 'Don\'t Recommend' ? 'Don\'t recommend' :
                                       'Neutral'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                            {interviewerNotes.length > 2 && (
                              <p className="text-xs text-gray-500">+{interviewerNotes.length - 2} more notes</p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-center items-center pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleAddNotes(candidate)}
                    className="flex items-center space-x-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100 transition-colors"
                  >
                    <MessageSquare size={16} />
                    <span>Add Notes & Recommendation</span>
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">No assigned candidates found</h3>
            <p className="text-gray-600">You don't have any candidates assigned for interviews yet. Contact your HR team to get assigned interviews.</p>
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
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add Notes & Recommendation for {selectedCandidate.name}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Interview Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add your interview notes..."
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recommendation
                </label>
                <div className="relative">
                  <select
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                  >
                    <option value="">Select Recommendation</option>
                    <option value="Recommend">Recommend for next round</option>
                    <option value="Don't Recommend">Don't recommend</option>
                    <option value="Neutral">Neutral</option>
                  </select>
                  <ChevronDown size={20} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  setNotes('');
                  setRecommendation('');
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                disabled={updatingNotes}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {updatingNotes ? 'Saving...' : 'Save Notes & Recommendation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
