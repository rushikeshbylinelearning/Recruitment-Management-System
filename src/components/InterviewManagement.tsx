import { useState, useEffect } from 'react';
import { Plus, Search, Calendar, Clock, User, MapPin, Video, Phone, Edit, Trash2, Eye, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { interviewsAPI, candidatesAPI, usersAPI } from '../services/api';

interface Interview {
  id: number;
  candidate_id: number;
  interviewer_id: number;
  scheduled_date: string;
  type: string;
  status: string;
  location?: string;
  meeting_link?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  candidate_name?: string;
  interviewer_name?: string;
  candidate_position?: string;
}

interface InterviewFormData {
  candidate_id: string;
  interviewer_id: string;
  scheduled_date: string;
  type: string;
  location: string;
  meeting_link: string;
  notes: string;
}

export default function InterviewManagement() {
  const { hasPermission } = useAuth();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [interviewers, setInterviewers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [formData, setFormData] = useState<InterviewFormData>({
    candidate_id: '',
    interviewer_id: '',
    scheduled_date: '',
    type: 'Video',
    location: '',
    meeting_link: '',
    notes: ''
  });

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch interviews
      const interviewsResponse = await interviewsAPI.getInterviews({ limit: 100 });
      if (interviewsResponse.success && interviewsResponse.data) {
        setInterviews(interviewsResponse.data.interviews || []);
      }

      // Fetch candidates
      const candidatesResponse = await candidatesAPI.getCandidates({ limit: 100 });
      if (candidatesResponse.success && candidatesResponse.data) {
        setCandidates(candidatesResponse.data.candidates || []);
      }

      // Fetch interviewers (users with Interviewer role)
      const usersResponse = await usersAPI.getUsers();
      if (usersResponse.success && usersResponse.data) {
        const interviewerUsers = usersResponse.data.users.filter((u: any) => u.role === 'Interviewer');
        setInterviewers(interviewerUsers);
      }
    } catch (err) {
      console.error('Error fetching interview data:', err);
      setError('Failed to load interview data');
    } finally {
      setLoading(false);
    }
  };

  // Filter interviews based on search and filters
  const filteredInterviews = interviews.filter(interview => {
    const matchesSearch = 
      interview.candidate_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      interview.interviewer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      interview.candidate_position?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || interview.status === statusFilter;
    const matchesType = typeFilter === 'All' || interview.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-100 text-blue-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Video': return <Video size={16} className="text-blue-500" />;
      case 'Phone': return <Phone size={16} className="text-green-500" />;
      case 'In-Person': return <MapPin size={16} className="text-purple-500" />;
      default: return <Calendar size={16} className="text-gray-500" />;
    }
  };

  const handleCreateInterview = async () => {
    if (!formData.candidate_id || !formData.interviewer_id || !formData.scheduled_date) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const interviewData = {
        candidate_id: parseInt(formData.candidate_id),
        interviewer_id: parseInt(formData.interviewer_id),
        scheduled_date: formData.scheduled_date,
        type: formData.type,
        location: formData.location,
        meeting_link: formData.meeting_link,
        notes: formData.notes,
        status: 'Scheduled'
      };

      const response = await interviewsAPI.createInterview(interviewData);
      
      if (response.success) {
        await fetchData(); // Refresh the list
        setShowCreateModal(false);
        resetForm();
        alert('Interview created successfully!');
      } else {
        alert('Failed to create interview. Please try again.');
      }
    } catch (error) {
      console.error('Error creating interview:', error);
      alert('Failed to create interview. Please try again.');
    }
  };

  const handleUpdateInterview = async () => {
    if (!selectedInterview) return;

    try {
      const updateData = {
        candidate_id: parseInt(formData.candidate_id),
        interviewer_id: parseInt(formData.interviewer_id),
        scheduled_date: formData.scheduled_date,
        type: formData.type,
        location: formData.location,
        meeting_link: formData.meeting_link,
        notes: formData.notes,
        status: selectedInterview.status
      };

      const response = await interviewsAPI.updateInterview(selectedInterview.id, updateData);
      
      if (response.success) {
        await fetchData(); // Refresh the list
        setShowEditModal(false);
        setSelectedInterview(null);
        resetForm();
        alert('Interview updated successfully!');
      } else {
        alert('Failed to update interview. Please try again.');
      }
    } catch (error) {
      console.error('Error updating interview:', error);
      alert('Failed to update interview. Please try again.');
    }
  };

  const handleDeleteInterview = async (interviewId: number) => {
    if (!confirm('Are you sure you want to delete this interview?')) return;

    try {
      const response = await interviewsAPI.deleteInterview(interviewId);
      
      if (response.success) {
        await fetchData(); // Refresh the list
        alert('Interview deleted successfully!');
      } else {
        alert('Failed to delete interview. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting interview:', error);
      alert('Failed to delete interview. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      candidate_id: '',
      interviewer_id: '',
      scheduled_date: '',
      type: 'Video',
      location: '',
      meeting_link: '',
      notes: ''
    });
  };

  const openEditModal = (interview: Interview) => {
    setSelectedInterview(interview);
    setFormData({
      candidate_id: interview.candidate_id.toString(),
      interviewer_id: interview.interviewer_id.toString(),
      scheduled_date: interview.scheduled_date,
      type: interview.type,
      location: interview.location || '',
      meeting_link: interview.meeting_link || '',
      notes: interview.notes || ''
    });
    setShowEditModal(true);
  };

  const openViewModal = (interview: Interview) => {
    setSelectedInterview(interview);
    setShowViewModal(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading interviews...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error loading interviews</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Interview Management</h1>
          <p className="text-gray-600 mt-1">Schedule and manage candidate interviews</p>
        </div>
        {hasPermission('interviews', 'create') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            <span>Schedule Interview</span>
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Interviews</p>
              <p className="text-2xl font-bold text-gray-900">{interviews.length}</p>
            </div>
            <Calendar className="text-blue-500" size={24} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Scheduled</p>
              <p className="text-2xl font-bold text-gray-900">
                {interviews.filter(i => i.status === 'Scheduled').length}
              </p>
            </div>
            <Clock className="text-yellow-500" size={24} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">
                {interviews.filter(i => i.status === 'Completed').length}
              </p>
            </div>
            <User className="text-green-500" size={24} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">This Week</p>
              <p className="text-2xl font-bold text-gray-900">
                {interviews.filter(i => {
                  const interviewDate = new Date(i.scheduled_date);
                  const now = new Date();
                  const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
                  return interviewDate >= weekStart;
                }).length}
              </p>
            </div>
            <Calendar className="text-purple-500" size={24} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search interviews..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="All">All Status</option>
          <option value="Scheduled">Scheduled</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
          <option value="In Progress">In Progress</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="All">All Types</option>
          <option value="Video">Video</option>
          <option value="Phone">Phone</option>
          <option value="In-Person">In-Person</option>
        </select>
      </div>

      {/* Interviews List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Interviews</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredInterviews.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No interviews found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {interviews.length === 0 
                  ? "No interviews have been scheduled yet. Start by creating a new interview."
                  : "No interviews match your current filters. Try adjusting your search criteria."
                }
              </p>
              {interviews.length === 0 && hasPermission('interviews', 'create') && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus size={16} className="mr-2" />
                    Schedule First Interview
                  </button>
                </div>
              )}
            </div>
          ) : (
            filteredInterviews.map((interview) => (
              <div key={interview.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="mt-1">
                      {getTypeIcon(interview.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-medium text-gray-900">{interview.candidate_name}</h4>
                        <span className="text-sm text-gray-500">{interview.candidate_position}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(interview.status)}`}>
                          {interview.status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                        <div className="flex items-center space-x-1">
                          <User size={14} />
                          <span>Interviewer: {interview.interviewer_name}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock size={14} />
                          <span>{new Date(interview.scheduled_date).toLocaleString()}</span>
                        </div>
                        {interview.location && (
                          <div className="flex items-center space-x-1">
                            <MapPin size={14} />
                            <span>{interview.location}</span>
                          </div>
                        )}
                      </div>
                      {interview.notes && (
                        <p className="text-sm text-gray-600">{interview.notes}</p>
                      )}
                      
                      {/* Interviewer Assessment - Show notes and recommendations */}
                      {(() => {
                        const candidate = candidates.find(c => c.id === interview.candidate_id);
                        if (candidate && candidate.notes && Array.isArray(candidate.notes)) {
                          const interviewerNotes = candidate.notes.filter((note: any) => note.user_id === interview.interviewer_id);
                          if (interviewerNotes.length > 0) {
                            const latestNote = interviewerNotes[interviewerNotes.length - 1];
                            return (
                              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="text-sm font-medium text-blue-900">Interviewer Assessment</h5>
                                  <span className="text-xs text-blue-700">
                                    {new Date(latestNote.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                                
                                {/* Recommendation Badge */}
                                {latestNote.recommendation && (
                                  <div className="mb-2">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      latestNote.recommendation === 'Recommend' ? 'bg-green-100 text-green-800' :
                                      latestNote.recommendation === 'Don\'t Recommend' ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {latestNote.recommendation === 'Recommend' ? '✓ Recommend for next round' :
                                       latestNote.recommendation === 'Don\'t Recommend' ? '✗ Don\'t recommend' :
                                       '○ Neutral'}
                                    </span>
                                  </div>
                                )}
                                
                                {/* Notes */}
                                {latestNote.notes && (
                                  <div className="text-blue-800 text-sm">
                                    <p className="line-clamp-2">{latestNote.notes}</p>
                                  </div>
                                )}
                                
                                {/* Show count if multiple assessments */}
                                {interviewerNotes.length > 1 && (
                                  <div className="mt-2 pt-2 border-t border-blue-200">
                                    <p className="text-xs text-blue-600">
                                      {interviewerNotes.length} assessment{interviewerNotes.length > 1 ? 's' : ''} submitted
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          }
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {hasPermission('interviews', 'view') && (
                      <button 
                        onClick={() => openViewModal(interview)}
                        className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                      >
                        <Eye size={14} className="inline mr-1" />
                        View
                      </button>
                    )}
                    {hasPermission('interviews', 'edit') && (
                      <button 
                        onClick={() => openEditModal(interview)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        <Edit size={14} className="inline mr-1" />
                        Edit
                      </button>
                    )}
                    {hasPermission('interviews', 'delete') && (
                      <button 
                        onClick={() => handleDeleteInterview(interview.id)}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                      >
                        <Trash2 size={14} className="inline mr-1" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Interview Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Schedule New Interview</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Candidate *
                  </label>
                  <select
                    value={formData.candidate_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, candidate_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Choose a candidate</option>
                    {candidates.map(candidate => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} - {candidate.position}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Interviewer *
                  </label>
                  <select
                    value={formData.interviewer_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, interviewer_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Choose an interviewer</option>
                    {interviewers.map(interviewer => (
                      <option key={interviewer.id} value={interviewer.id}>
                        {interviewer.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scheduled Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interview Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Video">Video Call</option>
                    <option value="Phone">Phone Call</option>
                    <option value="In-Person">In-Person</option>
                  </select>
                </div>
              </div>

              {formData.type === 'In-Person' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter interview location"
                  />
                </div>
              )}

              {formData.type === 'Video' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meeting Link
                  </label>
                  <input
                    type="url"
                    value={formData.meeting_link}
                    onChange={(e) => setFormData(prev => ({ ...prev, meeting_link: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter meeting link (Zoom, Teams, etc.)"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Any additional notes for the interview"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateInterview}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Calendar size={16} />
                <span>Schedule Interview</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Interview Modal */}
      {showEditModal && selectedInterview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Edit Interview</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedInterview(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Same form fields as create modal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Candidate *
                  </label>
                  <select
                    value={formData.candidate_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, candidate_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Choose a candidate</option>
                    {candidates.map(candidate => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} - {candidate.position}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Interviewer *
                  </label>
                  <select
                    value={formData.interviewer_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, interviewer_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Choose an interviewer</option>
                    {interviewers.map(interviewer => (
                      <option key={interviewer.id} value={interviewer.id}>
                        {interviewer.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scheduled Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interview Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Video">Video Call</option>
                    <option value="Phone">Phone Call</option>
                    <option value="In-Person">In-Person</option>
                  </select>
                </div>
              </div>

              {formData.type === 'In-Person' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter interview location"
                  />
                </div>
              )}

              {formData.type === 'Video' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meeting Link
                  </label>
                  <input
                    type="url"
                    value={formData.meeting_link}
                    onChange={(e) => setFormData(prev => ({ ...prev, meeting_link: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter meeting link (Zoom, Teams, etc.)"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Any additional notes for the interview"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedInterview(null);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateInterview}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Edit size={16} />
                <span>Update Interview</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Interview Modal */}
      {showViewModal && selectedInterview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Interview Details</h2>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedInterview(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Candidate</label>
                  <p className="text-gray-900">{selectedInterview.candidate_name}</p>
                  <p className="text-sm text-gray-500">{selectedInterview.candidate_position}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Interviewer</label>
                  <p className="text-gray-900">{selectedInterview.interviewer_name}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Date</label>
                  <p className="text-gray-900">{new Date(selectedInterview.scheduled_date).toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <div className="flex items-center space-x-2">
                    {getTypeIcon(selectedInterview.type)}
                    <span className="text-gray-900">{selectedInterview.type}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedInterview.status)}`}>
                  {selectedInterview.status}
                </span>
              </div>

              {selectedInterview.location && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <p className="text-gray-900">{selectedInterview.location}</p>
                </div>
              )}

              {selectedInterview.meeting_link && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Link</label>
                  <a 
                    href={selectedInterview.meeting_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    {selectedInterview.meeting_link}
                  </a>
                </div>
              )}

              {selectedInterview.notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <p className="text-gray-900">{selectedInterview.notes}</p>
                </div>
              )}

              {/* Interviewer Assessment */}
              {(() => {
                const candidate = candidates.find(c => c.id === selectedInterview.candidate_id);
                if (candidate && candidate.notes && Array.isArray(candidate.notes)) {
                  const interviewerNotes = candidate.notes.filter((note: any) => note.user_id === selectedInterview.interviewer_id);
                  if (interviewerNotes.length > 0) {
                    return (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Interviewer Assessment</label>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          {interviewerNotes.map((note: any, index: number) => (
                            <div key={note.id || index} className={index > 0 ? 'mt-4 pt-4 border-t border-blue-200' : ''}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-blue-900">Assessment #{index + 1}</span>
                                <span className="text-xs text-blue-700">
                                  {new Date(note.created_at).toLocaleString()}
                                </span>
                              </div>
                              
                              {/* Recommendation */}
                              {note.recommendation && (
                                <div className="mb-2">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                    note.recommendation === 'Recommend' ? 'bg-green-100 text-green-800' :
                                    note.recommendation === 'Don\'t Recommend' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {note.recommendation === 'Recommend' ? '✓ Recommend for next round' :
                                     note.recommendation === 'Don\'t Recommend' ? '✗ Don\'t recommend' :
                                     '○ Neutral'}
                                  </span>
                                </div>
                              )}
                              
                              {/* Notes */}
                              {note.notes && (
                                <div className="text-blue-800 text-sm">
                                  <p className="whitespace-pre-wrap">{note.notes}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                }
                return null;
              })()}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedInterview(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}