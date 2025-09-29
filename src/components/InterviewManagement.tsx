import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Video, MapPin, Plus, Edit, Trash2 } from 'lucide-react';
import { Interview, Candidate, TeamMember } from '../types';
import { interviewsAPI, usersAPI, candidatesAPI } from '../services/api';
import InterviewScheduler from './InterviewScheduler';

interface InterviewManagementProps {
  candidateId?: string;
  showAllInterviews?: boolean;
}

export default function InterviewManagement({ candidateId, showAllInterviews = false }: InterviewManagementProps) {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviewers, setInterviewers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScheduler, setShowScheduler] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);

  useEffect(() => {
    loadData();
  }, [candidateId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load interviews
      const interviewsResponse = await interviewsAPI.getInterviews();
      setInterviews(interviewsResponse.data?.interviews || []);

      // Load candidates and interviewers for scheduling
      if (showAllInterviews || !candidateId) {
        const [candidatesResponse, usersResponse] = await Promise.all([
          candidatesAPI.getCandidates(),
          usersAPI.getUsers()
        ]);
        
        setCandidates(candidatesResponse.data?.candidates || []);
        setInterviewers(usersResponse.data?.users?.filter((user: any) => user.role === 'Interviewer').map((user: any) => ({
          ...user,
          password: '',
          lastLogin: user.last_login,
          createdDate: user.created_at
        })) || []);
      }
    } catch (err) {
      console.error('Error loading interview data:', err);
      setError('Failed to load interview data');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleInterview = async (interviewData: any) => {
    try {
      await interviewsAPI.createInterview(interviewData);
      await loadData();
      setShowScheduler(false);
      setEditingInterview(null);
    } catch (err) {
      console.error('Error scheduling interview:', err);
      setError('Failed to schedule interview');
    }
  };

  const handleUpdateInterview = async (interviewData: any) => {
    if (!editingInterview) return;
    
    try {
      await interviewsAPI.updateInterview(editingInterview.id.toString(), interviewData);
      await loadData();
      setShowScheduler(false);
      setEditingInterview(null);
    } catch (err) {
      console.error('Error updating interview:', err);
      setError('Failed to update interview');
    }
  };

  const handleDeleteInterview = async (interviewId: string) => {
    if (!confirm('Are you sure you want to delete this interview?')) return;
    
    try {
      await interviewsAPI.deleteInterview(interviewId);
      await loadData();
    } catch (err) {
      console.error('Error deleting interview:', err);
      setError('Failed to delete interview');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-100 text-blue-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      case 'Rescheduled': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Technical': return 'bg-purple-100 text-purple-800';
      case 'HR': return 'bg-pink-100 text-pink-800';
      case 'Managerial': return 'bg-indigo-100 text-indigo-800';
      case 'Final': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {candidateId ? 'Candidate Interviews' : 'Interview Management'}
          </h2>
          <p className="text-gray-600">
            {candidateId ? 'Manage interviews for this candidate' : 'Schedule and manage all interviews'}
          </p>
        </div>
        <button
          onClick={() => setShowScheduler(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          <span>Schedule Interview</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Interviews List */}
      {interviews.length === 0 ? (
        <div className="text-center py-12">
          <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No interviews scheduled</h3>
          <p className="text-gray-600">Get started by scheduling an interview.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {interviews.map((interview) => (
            <div key={interview.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {interview.type} Interview - Round {interview.round}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(interview.type)}`}>
                      {interview.type}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(interview.status)}`}>
                      {interview.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center space-x-2">
                      <Calendar size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {new Date(interview.scheduledDate).toLocaleDateString()} at {new Date(interview.scheduledDate).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-600">{interview.duration} minutes</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <User size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-600">{(interview as any).interviewer_name || interview.interviewerName}</span>
                    </div>
                    {interview.meetingLink && (
                      <div className="flex items-center space-x-2">
                        <Video size={16} className="text-gray-400" />
                        <a href={interview.meetingLink} className="text-sm text-blue-600 hover:underline">
                          Join Meeting
                        </a>
                      </div>
                    )}
                    {interview.location && (
                      <div className="flex items-center space-x-2">
                        <MapPin size={16} className="text-gray-400" />
                        <span className="text-sm text-gray-600">{interview.location}</span>
                      </div>
                    )}
                  </div>

                  {interview.candidate_name && (
                    <div className="text-sm text-gray-600">
                      <strong>Candidate:</strong> {interview.candidate_name} - {interview.candidate_position}
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => {
                      setEditingInterview(interview);
                      setShowScheduler(true);
                    }}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit Interview"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteInterview(interview.id.toString())}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Interview"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Interview Scheduler Modal */}
      <InterviewScheduler
        isOpen={showScheduler}
        onClose={() => {
          setShowScheduler(false);
          setEditingInterview(null);
        }}
        onSchedule={editingInterview ? handleUpdateInterview : handleScheduleInterview}
        candidates={candidates}
        interviewers={interviewers}
        editingInterview={editingInterview || undefined}
      />
    </div>
  );
}
