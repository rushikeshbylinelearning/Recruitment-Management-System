import React, { useState } from 'react';
import { Calendar, Clock, User, Star, MessageSquare, CheckCircle, XCircle, Pause } from 'lucide-react';
import { Interview, InterviewFeedback, SkillRating } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface InterviewerDashboardProps {
  interviews: Interview[];
  onSubmitFeedback: (interviewId: string, feedback: InterviewFeedback) => void;
}

export default function InterviewerDashboard({ interviews, onSubmitFeedback }: InterviewerDashboardProps) {
  const { user } = useAuth();
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackData, setFeedbackData] = useState<Partial<InterviewFeedback>>({
    ratings: [],
    overallRating: 0,
    comments: '',
    recommendation: 'Selected',
    strengths: [],
    weaknesses: [],
    additionalNotes: ''
  });

  // Filter interviews for current user
  const myInterviews = interviews.filter(interview => interview.interviewerId === user?.id);
  const upcomingInterviews = myInterviews.filter(interview => 
    interview.status === 'Scheduled' && new Date(interview.scheduledDate) > new Date()
  );
  const completedInterviews = myInterviews.filter(interview => interview.status === 'Completed');
  const pendingFeedback = myInterviews.filter(interview => 
    interview.status === 'Completed' && !interview.feedback
  );

  const getInterviewStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-100 text-blue-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      case 'Rescheduled': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStartFeedback = (interview: Interview) => {
    setSelectedInterview(interview);
    setShowFeedbackForm(true);
    
    // Initialize skill ratings based on interview type
    const defaultSkills = interview.type === 'Technical' 
      ? ['Problem Solving', 'Technical Knowledge', 'Code Quality', 'Communication']
      : interview.type === 'HR'
      ? ['Communication', 'Cultural Fit', 'Motivation', 'Team Work']
      : ['Leadership', 'Strategic Thinking', 'Decision Making', 'Team Management'];
    
    setFeedbackData({
      ...feedbackData,
      ratings: defaultSkills.map(skill => ({ skill, rating: 0 }))
    });
  };

  const handleSkillRatingChange = (skillIndex: number, rating: number) => {
    const updatedRatings = [...(feedbackData.ratings || [])];
    updatedRatings[skillIndex] = { ...updatedRatings[skillIndex], rating };
    setFeedbackData({ ...feedbackData, ratings: updatedRatings });
  };

  const handleSubmitFeedback = () => {
    if (!selectedInterview) return;

    const feedback: InterviewFeedback = {
      id: `feedback-${Date.now()}`,
      interviewId: selectedInterview.id,
      interviewerId: user?.id || '',
      ratings: feedbackData.ratings || [],
      overallRating: feedbackData.overallRating || 0,
      comments: feedbackData.comments || '',
      recommendation: feedbackData.recommendation || 'Selected',
      strengths: feedbackData.strengths || [],
      weaknesses: feedbackData.weaknesses || [],
      additionalNotes: feedbackData.additionalNotes || '',
      submittedAt: new Date().toISOString()
    };

    onSubmitFeedback(selectedInterview.id, feedback);
    setShowFeedbackForm(false);
    setSelectedInterview(null);
    setFeedbackData({
      ratings: [],
      overallRating: 0,
      comments: '',
      recommendation: 'Selected',
      strengths: [],
      weaknesses: [],
      additionalNotes: ''
    });
  };

  const renderStarRating = (rating: number, onRatingChange?: (rating: number) => void) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onRatingChange && onRatingChange(star)}
            disabled={!onRatingChange}
            className={`${onRatingChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
          >
            <Star
              size={20}
              className={star <= rating ? 'text-yellow-500 fill-current' : 'text-gray-300'}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Interviewer Dashboard</h1>
        <p className="text-gray-600 mt-1">Manage your interviews and provide feedback</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Upcoming Interviews</p>
              <p className="text-2xl font-bold text-blue-600">{upcomingInterviews.length}</p>
            </div>
            <Calendar className="text-blue-500" size={24} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{completedInterviews.length}</p>
            </div>
            <CheckCircle className="text-green-500" size={24} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Feedback</p>
              <p className="text-2xl font-bold text-orange-600">{pendingFeedback.length}</p>
            </div>
            <MessageSquare className="text-orange-500" size={24} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Interviews</p>
              <p className="text-2xl font-bold text-purple-600">{myInterviews.length}</p>
            </div>
            <User className="text-purple-500" size={24} />
          </div>
        </div>
      </div>

      {/* Upcoming Interviews */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Upcoming Interviews</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {upcomingInterviews.length > 0 ? (
            upcomingInterviews.map((interview) => (
              <div key={interview.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-medium text-gray-900">Round {interview.round} - {interview.type}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getInterviewStatusColor(interview.status)}`}>
                        {interview.status}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-2">Candidate: {interview.candidateId}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Calendar size={14} />
                        <span>{new Date(interview.scheduledDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock size={14} />
                        <span>{new Date(interview.scheduledDate).toLocaleTimeString()}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock size={14} />
                        <span>{interview.duration} minutes</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {interview.meetingLink && (
                      <a
                        href={interview.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        Join Meeting
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center">
              <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No upcoming interviews</h3>
              <p className="text-gray-600">Your scheduled interviews will appear here.</p>
            </div>
          )}
        </div>
      </div>

      {/* Pending Feedback */}
      {pendingFeedback.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Pending Feedback</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {pendingFeedback.map((interview) => (
              <div key={interview.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-medium text-gray-900">Round {interview.round} - {interview.type}</h4>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        Feedback Pending
                      </span>
                    </div>
                    <p className="text-gray-600 mb-2">Candidate: {interview.candidateId}</p>
                    <p className="text-sm text-gray-500">
                      Completed on {new Date(interview.scheduledDate).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleStartFeedback(interview)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Add Feedback
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback Form Modal */}
      {showFeedbackForm && selectedInterview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Interview Feedback - Round {selectedInterview.round}
              </h2>
              <p className="text-gray-600">{selectedInterview.type} Interview</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Skill Ratings */}
              <div>
                <h3 className="font-medium text-gray-900 mb-4">Skill Assessment</h3>
                <div className="space-y-4">
                  {feedbackData.ratings?.map((skillRating, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span className="text-gray-700">{skillRating.skill}</span>
                      {renderStarRating(skillRating.rating, (rating) => handleSkillRatingChange(index, rating))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Overall Rating */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Overall Rating</h3>
                {renderStarRating(feedbackData.overallRating || 0, (rating) => 
                  setFeedbackData({ ...feedbackData, overallRating: rating })
                )}
              </div>

              {/* Recommendation */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Recommendation</h3>
                <div className="flex space-x-4">
                  {['Selected', 'On Hold', 'Rejected'].map((rec) => (
                    <button
                      key={rec}
                      onClick={() => setFeedbackData({ ...feedbackData, recommendation: rec as any })}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                        feedbackData.recommendation === rec
                          ? rec === 'Selected' ? 'bg-green-100 border-green-300 text-green-800'
                            : rec === 'On Hold' ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
                            : 'bg-red-100 border-red-300 text-red-800'
                          : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {rec === 'Selected' && <CheckCircle size={16} />}
                      {rec === 'On Hold' && <Pause size={16} />}
                      {rec === 'Rejected' && <XCircle size={16} />}
                      <span>{rec}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Comments */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Comments</h3>
                <textarea
                  value={feedbackData.comments}
                  onChange={(e) => setFeedbackData({ ...feedbackData, comments: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Share your detailed feedback about the candidate's performance..."
                />
              </div>

              {/* Additional Notes */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Additional Notes</h3>
                <textarea
                  value={feedbackData.additionalNotes}
                  onChange={(e) => setFeedbackData({ ...feedbackData, additionalNotes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Any additional observations or recommendations..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowFeedbackForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFeedback}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}