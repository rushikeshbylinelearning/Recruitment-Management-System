import React, { useState, useEffect } from 'react';
import { Plus, Search, Calendar, Clock, User, MapPin, Video, Phone, MessageSquare, Edit, Trash2, Eye, Filter, X } from 'lucide-react';
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
}

export default function RecruiterInterview() {
  const { user, hasPermission } = useAuth();
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
    type: 'Technical',
    location: '',
    meeting_link: ''
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
      try {
        const usersResponse = await usersAPI.getUsers();
        console.log('Users API response:', usersResponse);
        if (usersResponse.success && usersResponse.data) {
          const users = usersResponse.data.users || usersResponse.data || [];
          console.log('Users array:', users);
          if (Array.isArray(users)) {
            const interviewerUsers = users.filter((u: any) => u.role === 'Interviewer');
            console.log('Interviewer users:', interviewerUsers);
            setInterviewers(interviewerUsers);
          } else {
            console.warn('Users data is not an array:', users);
            setInterviewers([]);
          }
        } else {
          console.warn('Failed to fetch users:', usersResponse);
          setInterviewers([]);
        }
      } catch (usersError) {
        console.warn('Error fetching users (non-blocking):', usersError);
        setInterviewers([]);
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
      case 'Rescheduled': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Technical': return <Video size={16} className="text-blue-500" />;
      case 'HR': return <User size={16} className="text-green-500" />;
      case 'Managerial': return <User size={16} className="text-purple-500" />;
      case 'Final': return <Calendar size={16} className="text-orange-500" />;
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
      type: 'Technical',
      location: '',
      meeting_link: ''
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
      meeting_link: interview.meeting_link || ''
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

  // Check if user has any interview permissions
  if (!hasPermission('interviews', 'view')) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No Interview Access</h3>
            <p className="mt-1 text-sm text-gray-500">
              You don't have permission to view interviews. Please contact your administrator.
            </p>
          </div>
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
          <p className="text-gray-600 mt-1">Manage candidate interviews and scheduling</p>
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
              <p className="text-sm text-gray-600">Rescheduled</p>
              <p className="text-2xl font-bold text-gray-900">
                {interviews.filter(i => i.status === 'Rescheduled').length}
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
          <option value="Rescheduled">Rescheduled</option>
        </select>
        <select 
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="All">All Types</option>
          <option value="Technical">Technical</option>
          <option value="HR">HR</option>
          <option value="Managerial">Managerial</option>
          <option value="Final">Final</option>
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
                No interviews match your current filters. Try adjusting your search criteria.
              </p>
              {hasPermission('interviews', 'create') ? (
                <div className="mt-6">
                  <button 
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus size={16} className="mr-2" />
                    Schedule First Interview
                  </button>
                </div>
              ) : (
                <div className="mt-6">
                  <p className="text-sm text-gray-500">
                    You don't have permission to create interviews. Contact your administrator for access.
                  </p>
                </div>
              )}
            </div>
          ) : (
            filteredInterviews.map((interview) => (
              <div key={interview.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900">
                        {interview.candidate_name || 'Unknown Candidate'}
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(interview.status)}`}>
                        {interview.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Calendar size={16} />
                        <span>{new Date(interview.scheduled_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock size={16} />
                        <span>{new Date(interview.scheduled_date).toLocaleTimeString()}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {getTypeIcon(interview.type)}
                        <span>{interview.type}</span>
                      </div>
                      {interview.location && (
                        <div className="flex items-center space-x-1">
                          <MapPin size={16} />
                          <span>{interview.location}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">Interviewer:</span> {interview.interviewer_name || 'Not assigned'}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => openViewModal(interview)}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      title="View Details"
                    >
                      <Eye size={16} />
                    </button>
                    {hasPermission('interviews', 'edit') ? (
                      <button
                        onClick={() => openEditModal(interview)}
                        className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                        title="Edit Interview"
                      >
                        <Edit size={16} />
                      </button>
                    ) : (
                      <button
                        disabled
                        className="p-2 text-gray-300 cursor-not-allowed"
                        title="No permission to edit interviews"
                      >
                        <Edit size={16} />
                      </button>
                    )}
                    {hasPermission('interviews', 'delete') ? (
                      <button
                        onClick={() => handleDeleteInterview(interview.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete Interview"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <button
                        disabled
                        className="p-2 text-gray-300 cursor-not-allowed"
                        title="No permission to delete interviews"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {hasPermission('interviews', 'create') ? (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center space-x-3 mb-4">
              <Calendar className="text-blue-500" size={24} />
              <h3 className="font-semibold text-gray-900">Schedule Interview</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">Schedule a new interview with a candidate</p>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Schedule Now
            </button>
          </div>
        ) : (
          <div className="bg-gray-50 p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center space-x-3 mb-4">
              <Calendar className="text-gray-400" size={24} />
              <h3 className="font-semibold text-gray-500">Schedule Interview</h3>
            </div>
            <p className="text-gray-500 text-sm mb-4">You don't have permission to schedule interviews</p>
            <button 
              disabled
              className="w-full bg-gray-300 text-gray-500 py-2 rounded-lg cursor-not-allowed"
            >
              Schedule Now
            </button>
          </div>
        )}

        {hasPermission('interviews', 'view') && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center space-x-3 mb-4">
              <Video className="text-green-500" size={24} />
              <h3 className="font-semibold text-gray-900">Video Interviews</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">Manage video interview sessions</p>
            <button className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors">
              View Video Calls
            </button>
          </div>
        )}

        {hasPermission('interviews', 'view') && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center space-x-3 mb-4">
              <MessageSquare className="text-purple-500" size={24} />
              <h3 className="font-semibold text-gray-900">Interview Feedback</h3>
            </div>
            <p className="text-gray-600 text-sm mb-4">Review and manage interview feedback</p>
            <button className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors">
              View Feedback
            </button>
          </div>
        )}
      </div>

      {/* Create Interview Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Schedule New Interview</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Candidate *</label>
                <select
                  value={formData.candidate_id}
                  onChange={(e) => setFormData({...formData, candidate_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Candidate</option>
                  {candidates.map(candidate => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} - {candidate.position}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interviewer *</label>
                <select
                  value={formData.interviewer_id}
                  onChange={(e) => setFormData({...formData, interviewer_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Interviewer</option>
                  {interviewers.map(interviewer => (
                    <option key={interviewer.id} value={interviewer.id}>
                      {interviewer.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time *</label>
                <input
                  type="datetime-local"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({...formData, scheduled_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Technical">Technical</option>
                  <option value="HR">HR</option>
                  <option value="Managerial">Managerial</option>
                  <option value="Final">Final</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="Office address or meeting room"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link</label>
                <input
                  type="url"
                  value={formData.meeting_link}
                  onChange={(e) => setFormData({...formData, meeting_link: e.target.value})}
                  placeholder="Zoom, Teams, or other meeting link"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateInterview}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Schedule Interview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Interview Modal */}
      {showEditModal && selectedInterview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Edit Interview</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Candidate *</label>
                <select
                  value={formData.candidate_id}
                  onChange={(e) => setFormData({...formData, candidate_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Candidate</option>
                  {candidates.map(candidate => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} - {candidate.position}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interviewer *</label>
                <select
                  value={formData.interviewer_id}
                  onChange={(e) => setFormData({...formData, interviewer_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Interviewer</option>
                  {interviewers.map(interviewer => (
                    <option key={interviewer.id} value={interviewer.id}>
                      {interviewer.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time *</label>
                <input
                  type="datetime-local"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({...formData, scheduled_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Technical">Technical</option>
                  <option value="HR">HR</option>
                  <option value="Managerial">Managerial</option>
                  <option value="Final">Final</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="Office address or meeting room"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link</label>
                <input
                  type="url"
                  value={formData.meeting_link}
                  onChange={(e) => setFormData({...formData, meeting_link: e.target.value})}
                  placeholder="Zoom, Teams, or other meeting link"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateInterview}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Update Interview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Interview Modal */}
      {showViewModal && selectedInterview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Interview Details</h3>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Candidate</label>
                <p className="text-gray-900">{selectedInterview.candidate_name || 'Unknown'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interviewer</label>
                <p className="text-gray-900">{selectedInterview.interviewer_name || 'Not assigned'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                <p className="text-gray-900">
                  {new Date(selectedInterview.scheduled_date).toLocaleString()}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <p className="text-gray-900">{selectedInterview.type}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedInterview.status)}`}>
                  {selectedInterview.status}
                </span>
              </div>
              
              {selectedInterview.location && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <p className="text-gray-900">{selectedInterview.location}</p>
                </div>
              )}
              
              {selectedInterview.meeting_link && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link</label>
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
              
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
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
