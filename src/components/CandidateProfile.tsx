import React, { useState } from 'react';
import { X, User, Mail, Phone, Calendar, DollarSign, Clock, Star, MessageSquare, FileText, Video, MapPin } from 'lucide-react';
import { Candidate, Interview } from '../types';

interface CandidateProfileProps {
  candidate: Candidate;
  onClose: () => void;
  onUpdateCandidate: (candidate: Candidate) => void;
}

export default function CandidateProfile({ candidate, onClose, onUpdateCandidate }: CandidateProfileProps) {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'interviews', label: 'Interviews' },
    { id: 'feedback', label: 'Feedback' },
    { id: 'communications', label: 'Communications' }
  ];

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Applied': return 'bg-blue-100 text-blue-800';
      case 'Screening': return 'bg-yellow-100 text-yellow-800';
      case 'Interview': return 'bg-orange-100 text-orange-800';
      case 'Offer': return 'bg-purple-100 text-purple-800';
      case 'Hired': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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

  const renderStarRating = (rating: number) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            className={star <= rating ? 'text-yellow-500 fill-current' : 'text-gray-300'}
          />
        ))}
        <span className="text-sm text-gray-600 ml-2">{rating}/5</span>
      </div>
    );
  };

  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-3">
            <User className="text-gray-400" size={20} />
            <div>
              <p className="text-sm text-gray-600">Full Name</p>
              <p className="font-medium text-gray-900">{candidate.name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Mail className="text-gray-400" size={20} />
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-medium text-gray-900">{candidate.email}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Phone className="text-gray-400" size={20} />
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <p className="font-medium text-gray-900">{candidate.phone}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Calendar className="text-gray-400" size={20} />
            <div>
              <p className="text-sm text-gray-600">Applied Date</p>
              <p className="font-medium text-gray-900">{new Date(candidate.appliedDate).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Salary & Availability */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Salary Information</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <DollarSign className="text-green-500" size={20} />
              <div>
                <p className="text-sm text-gray-600">Expected Salary</p>
                <p className="font-medium text-gray-900">{candidate.salary?.expected || 'Not specified'}</p>
              </div>
            </div>
            {candidate.salary?.offered && (
              <div className="flex items-center space-x-3">
                <DollarSign className="text-blue-500" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Offered Salary</p>
                  <p className="font-medium text-gray-900">{candidate.salary.offered}</p>
                </div>
              </div>
            )}
            <div className="flex items-center space-x-3">
              <div className="w-5 h-5 flex items-center justify-center">
                <div className={`w-3 h-3 rounded-full ${candidate.salary?.negotiable ? 'bg-green-500' : 'bg-red-500'}`}></div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Negotiable</p>
                <p className="font-medium text-gray-900">{candidate.salary?.negotiable ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Availability</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Clock className="text-blue-500" size={20} />
              <div>
                <p className="text-sm text-gray-600">Joining Time</p>
                <p className="font-medium text-gray-900">{candidate.availability?.joiningTime || 'Not specified'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Calendar className="text-orange-500" size={20} />
              <div>
                <p className="text-sm text-gray-600">Notice Period</p>
                <p className="font-medium text-gray-900">{candidate.availability?.noticePeriod || 'Not specified'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-5 h-5 flex items-center justify-center">
                <div className={`w-3 h-3 rounded-full ${candidate.availability?.immediateJoiner ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Immediate Joiner</p>
                <p className="font-medium text-gray-900">{candidate.availability?.immediateJoiner ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Skills & Experience */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills & Experience</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600 mb-2">Experience</p>
            <p className="font-medium text-gray-900 mb-4">{candidate.experience}</p>
            <p className="text-sm text-gray-600 mb-2">Overall Score</p>
            {renderStarRating(candidate.score)}
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Skills</p>
            <div className="flex flex-wrap gap-2">
              {candidate.skills.map((skill, index) => (
                <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {candidate.notes && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
          <p className="text-gray-700">{candidate.notes}</p>
        </div>
      )}
    </div>
  );

  const InterviewsTab = () => (
    <div className="space-y-4">
      {candidate.interviews && candidate.interviews.length > 0 ? (
        candidate.interviews.map((interview) => (
          <div key={interview.id} className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-semibold text-gray-900">Round {interview.round} - {interview.type} Interview</h4>
                <p className="text-sm text-gray-600">with {interview.interviewerName}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getInterviewStatusColor(interview.status)}`}>
                {interview.status}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="flex items-center space-x-2">
                <Calendar size={16} className="text-gray-400" />
                <span className="text-sm text-gray-600">
                  {new Date(interview.scheduledDate).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock size={16} className="text-gray-400" />
                <span className="text-sm text-gray-600">{interview.duration} minutes</span>
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

            {interview.feedback && (
              <div className="border-t pt-4">
                <h5 className="font-medium text-gray-900 mb-2">Interview Feedback</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Overall Rating</p>
                    {renderStarRating(interview.feedback.overallRating)}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Recommendation</p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      interview.feedback.recommendation === 'Selected' ? 'bg-green-100 text-green-800' :
                      interview.feedback.recommendation === 'On Hold' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {interview.feedback.recommendation}
                    </span>
                  </div>
                </div>
                {interview.feedback.comments && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-600 mb-1">Comments</p>
                    <p className="text-sm text-gray-700">{interview.feedback.comments}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="text-center py-8">
          <Video size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No interviews scheduled</h3>
          <p className="text-gray-600">Interviews will appear here once scheduled.</p>
        </div>
      )}
    </div>
  );

  const FeedbackTab = () => (
    <div className="space-y-6">
      {/* Pre-Interview Feedback */}
      {candidate.preInterviewFeedback && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pre-Interview Assessment</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Resume Review</p>
              {renderStarRating(candidate.preInterviewFeedback.resumeReview.rating)}
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Skills Assessment</p>
              {renderStarRating(candidate.preInterviewFeedback.skillsAssessment.rating)}
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Cultural Fit</p>
              {renderStarRating(candidate.preInterviewFeedback.culturalFit.rating)}
            </div>
          </div>
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-1">Recommendation</p>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              candidate.preInterviewFeedback.overallRecommendation === 'Proceed' ? 'bg-green-100 text-green-800' :
              candidate.preInterviewFeedback.overallRecommendation === 'Hold' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {candidate.preInterviewFeedback.overallRecommendation}
            </span>
          </div>
          {candidate.preInterviewFeedback.notes && (
            <div>
              <p className="text-sm text-gray-600 mb-1">Notes</p>
              <p className="text-sm text-gray-700">{candidate.preInterviewFeedback.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Post-Interview Feedback */}
      {candidate.postInterviewFeedback && candidate.postInterviewFeedback.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Post-Interview Feedback</h3>
          {candidate.postInterviewFeedback.map((feedback, index) => (
            <div key={feedback.id} className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-medium text-gray-900">Feedback #{index + 1}</h4>
                <span className="text-sm text-gray-500">
                  {new Date(feedback.submittedAt).toLocaleDateString()}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Overall Performance</p>
                  {renderStarRating(feedback.overallPerformance)}
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Recommendation</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    feedback.recommendation === 'Hire' ? 'bg-green-100 text-green-800' :
                    feedback.recommendation === 'Maybe' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {feedback.recommendation}
                  </span>
                </div>
              </div>

              {feedback.additionalComments && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Additional Comments</p>
                  <p className="text-sm text-gray-700">{feedback.additionalComments}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!candidate.preInterviewFeedback && (!candidate.postInterviewFeedback || candidate.postInterviewFeedback.length === 0) && (
        <div className="text-center py-8">
          <FileText size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No feedback available</h3>
          <p className="text-gray-600">Feedback will appear here once submitted.</p>
        </div>
      )}
    </div>
  );

  const CommunicationsTab = () => (
    <div className="space-y-4">
      {candidate.communications && candidate.communications.length > 0 ? (
        candidate.communications.map((comm) => (
          <div key={comm.id} className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center space-x-2">
                <MessageSquare size={16} className="text-blue-500" />
                <span className="font-medium text-gray-900">{comm.type}</span>
              </div>
              <span className="text-sm text-gray-500">{new Date(comm.date).toLocaleDateString()}</span>
            </div>
            <p className="text-gray-700 mb-2">{comm.content}</p>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              comm.status === 'Sent' ? 'bg-green-100 text-green-800' :
              comm.status === 'Received' ? 'bg-blue-100 text-blue-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {comm.status}
            </span>
          </div>
        ))
      ) : (
        <div className="text-center py-8">
          <MessageSquare size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No communications</h3>
          <p className="text-gray-600">Communication history will appear here.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-medium text-lg">
                {candidate.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{candidate.name}</h2>
              <div className="flex items-center space-x-3">
                <p className="text-gray-600">{candidate.position}</p>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStageColor(candidate.stage)}`}>
                  {candidate.stage}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'interviews' && <InterviewsTab />}
          {activeTab === 'feedback' && <FeedbackTab />}
          {activeTab === 'communications' && <CommunicationsTab />}
        </div>
      </div>
    </div>
  );
}