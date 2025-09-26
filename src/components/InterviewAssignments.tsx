import { useState, useEffect } from 'react';
import { Calendar, Clock, User, MapPin, Video, Plus, Edit, Trash2, Eye, Filter, XCircle } from 'lucide-react';
import { interviewAssignmentsAPI, InterviewAssignment, CreateInterviewAssignment, UpdateInterviewAssignment } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface InterviewAssignmentsProps {
  candidateId?: number;
  showCreateButton?: boolean;
}

const InterviewAssignments = ({ candidateId, showCreateButton = true }: InterviewAssignmentsProps) => {
  const { user, hasPermission } = useAuth();
  const [assignments, setAssignments] = useState<InterviewAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<InterviewAssignment | null>(null);
  const [availableInterviewers, setAvailableInterviewers] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');

  const [formData, setFormData] = useState<CreateInterviewAssignment>({
    candidateId: candidateId || 0,
    assignedTo: 0,
    interviewType: 'Technical',
    scheduledDate: '',
    duration: 60,
    location: '',
    meetingLink: '',
    notes: '',
    priority: 'Medium'
  });

  useEffect(() => {
    loadAssignments();
    loadAvailableInterviewers();
  }, [candidateId]);

  const loadAssignments = async () => {
    try {
      setLoading(true);
      setError('');
      
      let response;
      if (candidateId) {
        // Load assignments for specific candidate
        response = await interviewAssignmentsAPI.getAssignments();
        const candidateAssignments = response.data?.assignments.filter(
          (assignment: InterviewAssignment) => assignment.candidate_id === candidateId
        );
        setAssignments(candidateAssignments || []);
      } else {
        // Load all assignments
        response = await interviewAssignmentsAPI.getAssignments();
        setAssignments(response.data?.assignments || []);
      }
    } catch (err) {
      console.error('Error loading interview assignments:', err);
      setError('Failed to load interview assignments');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableInterviewers = async () => {
    try {
      const response = await interviewAssignmentsAPI.getAvailableInterviewers(candidateId);
      setAvailableInterviewers(response.data?.interviewers || []);
    } catch (err) {
      console.error('Error loading interviewers:', err);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.candidateId || !formData.assignedTo) {
      setError('Candidate and interviewer are required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await interviewAssignmentsAPI.createAssignment(formData);
      if (response.success) {
        setShowCreateModal(false);
        resetForm();
        loadAssignments();
      } else {
        setError('Failed to create interview assignment');
      }
    } catch (err) {
      console.error('Error creating assignment:', err);
      setError('Failed to create interview assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingAssignment) return;

    try {
      setLoading(true);
      setError('');
      
      const updateData: UpdateInterviewAssignment = {
        assignedTo: formData.assignedTo,
        interviewType: formData.interviewType,
        scheduledDate: formData.scheduledDate,
        duration: formData.duration,
        location: formData.location,
        meetingLink: formData.meetingLink,
        notes: formData.notes,
        priority: formData.priority
      };
      
      const response = await interviewAssignmentsAPI.updateAssignment(editingAssignment.id, updateData);
      if (response.success) {
        setShowEditModal(false);
        setEditingAssignment(null);
        resetForm();
        loadAssignments();
      } else {
        setError('Failed to update interview assignment');
      }
    } catch (err) {
      console.error('Error updating assignment:', err);
      setError('Failed to update interview assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssignment = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this interview assignment?')) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await interviewAssignmentsAPI.deleteAssignment(id);
      if (response.success) {
        loadAssignments();
      } else {
        setError('Failed to delete interview assignment');
      }
    } catch (err) {
      console.error('Error deleting assignment:', err);
      setError('Failed to delete interview assignment');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      candidateId: candidateId || 0,
      assignedTo: 0,
      interviewType: 'Technical',
      scheduledDate: '',
      duration: 60,
      location: '',
      meetingLink: '',
      notes: '',
      priority: 'Medium'
    });
  };

  const openEditModal = (assignment: InterviewAssignment) => {
    setEditingAssignment(assignment);
    setFormData({
      candidateId: assignment.candidate_id,
      assignedTo: assignment.assigned_to,
      interviewType: assignment.interview_type,
      scheduledDate: assignment.scheduled_date ? assignment.scheduled_date.split('T')[0] + 'T' + assignment.scheduled_date.split('T')[1].substring(0, 5) : '',
      duration: assignment.duration,
      location: assignment.location || '',
      meetingLink: assignment.meeting_link || '',
      notes: assignment.notes || '',
      priority: assignment.priority
    });
    setShowEditModal(true);
  };

  const filteredAssignments = assignments.filter(assignment => {
    if (filterStatus && assignment.status !== filterStatus) return false;
    if (filterType && assignment.interview_type !== filterType) return false;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-100 text-blue-800';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      case 'Rescheduled': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-100 text-red-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && assignments.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Interview Assignments</h3>
          <p className="text-sm text-gray-600">Manage interview assignments for candidates</p>
        </div>
        {showCreateButton && hasPermission('interviews', 'create') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            <span>Assign Interview</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Filter size={16} className="text-gray-500" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
          >
            <option value="">All Status</option>
            <option value="Scheduled">Scheduled</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Rescheduled">Rescheduled</option>
          </select>
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
        >
          <option value="">All Types</option>
          <option value="Technical">Technical</option>
          <option value="HR">HR</option>
          <option value="Managerial">Managerial</option>
          <option value="Final">Final</option>
          <option value="Screening">Screening</option>
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Assignments List */}
      {filteredAssignments.length === 0 ? (
        <div className="text-center py-8">
          <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Interview Assignments</h3>
          <p className="text-gray-600">No interview assignments found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredAssignments.map((assignment) => (
            <div key={assignment.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h4 className="font-semibold text-gray-900">
                      {assignment.candidate_name} - {assignment.job_title}
                    </h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}>
                      {assignment.status}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(assignment.priority)}`}>
                      {assignment.priority}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <User size={16} />
                      <span>Interviewer: {assignment.interviewer_name} ({assignment.interviewer_role})</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Calendar size={16} />
                      <span>Type: {assignment.interview_type}</span>
                    </div>
                    {assignment.scheduled_date && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Clock size={16} />
                        <span>
                          {new Date(assignment.scheduled_date).toLocaleDateString()} at{' '}
                          {new Date(assignment.scheduled_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                    {assignment.location && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <MapPin size={16} />
                        <span>{assignment.location}</span>
                      </div>
                    )}
                    {assignment.meeting_link && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Video size={16} />
                        <a href={assignment.meeting_link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                          Join Meeting
                        </a>
                      </div>
                    )}
                  </div>
                  
                  {assignment.notes && (
                    <div className="text-sm text-gray-600 mb-3">
                      <strong>Notes:</strong> {assignment.notes}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  {hasPermission('interviews', 'edit') && (
                    <button
                      onClick={() => openEditModal(assignment)}
                      className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                      title="Edit Assignment"
                    >
                      <Edit size={16} />
                    </button>
                  )}
                  {hasPermission('interviews', 'delete') && (
                    <button
                      onClick={() => handleDeleteAssignment(assignment.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete Assignment"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Assignment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Assign Interview</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCreateAssignment} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interview Type *
                  </label>
                  <select
                    value={formData.interviewType}
                    onChange={(e) => setFormData(prev => ({ ...prev, interviewType: e.target.value as any }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  >
                    <option value="Technical">Technical</option>
                    <option value="HR">HR</option>
                    <option value="Managerial">Managerial</option>
                    <option value="Final">Final</option>
                    <option value="Screening">Screening</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign To *
                  </label>
                  <select
                    value={formData.assignedTo}
                    onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  >
                    <option value={0}>Select Interviewer</option>
                    {availableInterviewers.map((interviewer) => (
                      <option key={interviewer.id} value={interviewer.id}>
                        {interviewer.name} ({interviewer.role})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scheduled Date
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    min="15"
                    max="300"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Conference Room A"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meeting Link
                  </label>
                  <input
                    type="url"
                    value={formData.meetingLink}
                    onChange={(e) => setFormData(prev => ({ ...prev, meetingLink: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="https://meet.google.com/..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Additional notes about the interview..."
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {showEditModal && editingAssignment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit Interview Assignment</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingAssignment(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateAssignment} className="p-6 space-y-4">
              {/* Same form fields as create modal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interview Type *
                  </label>
                  <select
                    value={formData.interviewType}
                    onChange={(e) => setFormData(prev => ({ ...prev, interviewType: e.target.value as any }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  >
                    <option value="Technical">Technical</option>
                    <option value="HR">HR</option>
                    <option value="Managerial">Managerial</option>
                    <option value="Final">Final</option>
                    <option value="Screening">Screening</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign To *
                  </label>
                  <select
                    value={formData.assignedTo}
                    onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  >
                    <option value={0}>Select Interviewer</option>
                    {availableInterviewers.map((interviewer) => (
                      <option key={interviewer.id} value={interviewer.id}>
                        {interviewer.name} ({interviewer.role})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scheduled Date
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    min="15"
                    max="300"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Conference Room A"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Meeting Link
                  </label>
                  <input
                    type="url"
                    value={formData.meetingLink}
                    onChange={(e) => setFormData(prev => ({ ...prev, meetingLink: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="https://meet.google.com/..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Additional notes about the interview..."
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingAssignment(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewAssignments;
