import React, { useState, useEffect } from 'react';
import { Search, Star, MessageSquare, Send, User, Calendar, Clock } from 'lucide-react';
import { candidatesAPI } from '../services/api';

interface Candidate {
  id: number;
  name: string;
  position: string;
  stage: string;
  interviewDate?: string;
  interviewerId?: number;
}

interface FeedbackForm {
  candidateId: number;
  technicalSkills: number;
  communicationSkills: number;
  problemSolving: number;
  culturalFit: number;
  overallRating: number;
  strengths: string;
  weaknesses: string;
  recommendation: 'Hire' | 'Maybe' | 'No Hire';
  additionalNotes: string;
}

export default function InterviewerFeedback() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [feedbackForm, setFeedbackForm] = useState<FeedbackForm>({
    candidateId: 0,
    technicalSkills: 0,
    communicationSkills: 0,
    problemSolving: 0,
    culturalFit: 0,
    overallRating: 0,
    strengths: '',
    weaknesses: '',
    recommendation: 'Maybe',
    additionalNotes: ''
  });

  // Fetch candidates data
  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const response = await candidatesAPI.getCandidates({
        page: 1,
        limit: 100,
        stage: 'Interview'
      });

      if (response.success && response.data) {
        setCandidates(response.data.candidates || []);
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

  const handleCandidateSelect = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setFeedbackForm(prev => ({
      ...prev,
      candidateId: candidate.id
    }));
  };

  const handleRatingChange = (field: keyof FeedbackForm, value: number) => {
    setFeedbackForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleInputChange = (field: keyof FeedbackForm, value: string) => {
    setFeedbackForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmitFeedback = async () => {
    if (!selectedCandidate) return;

    try {
      setSubmitting(true);
      
      // For now, we'll add the feedback as notes to the candidate
      // In a real implementation, you'd have a separate feedback table
      const feedbackText = `
INTERVIEW FEEDBACK:
Technical Skills: ${feedbackForm.technicalSkills}/5
Communication Skills: ${feedbackForm.communicationSkills}/5
Problem Solving: ${feedbackForm.problemSolving}/5
Cultural Fit: ${feedbackForm.culturalFit}/5
Overall Rating: ${feedbackForm.overallRating}/5

Strengths: ${feedbackForm.strengths}
Weaknesses: ${feedbackForm.weaknesses}
Recommendation: ${feedbackForm.recommendation}

Additional Notes: ${feedbackForm.additionalNotes}
      `.trim();

      const response = await candidatesAPI.updateCandidate(selectedCandidate.id, {
        notes: feedbackText
      });

      if (response.success) {
        // Reset form
        setFeedbackForm({
          candidateId: 0,
          technicalSkills: 0,
          communicationSkills: 0,
          problemSolving: 0,
          culturalFit: 0,
          overallRating: 0,
          strengths: '',
          weaknesses: '',
          recommendation: 'Maybe',
          additionalNotes: ''
        });
        setSelectedCandidate(null);
        alert('Feedback submitted successfully!');
      } else {
        setError('Failed to submit feedback');
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCandidates = candidates.filter(candidate =>
    candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    candidate.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const StarRating = ({ value, onChange }: { value: number; onChange: (value: number) => void }) => (
    <div className="flex space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`${star <= value ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400 transition-colors`}
        >
          <Star size={20} fill={star <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );

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
        <h1 className="text-3xl font-bold text-gray-900">Interview Feedback</h1>
        <p className="text-gray-600 mt-1">Submit detailed feedback for interviewed candidates</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Candidate Selection */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Candidate</h3>
          
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search candidates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Candidate List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredCandidates.length > 0 ? (
              filteredCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  onClick={() => handleCandidateSelect(candidate)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedCandidate?.id === candidate.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{candidate.name}</h4>
                      <p className="text-sm text-gray-600">{candidate.position}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {candidate.interviewDate && (
                        <div className="flex items-center text-xs text-gray-500">
                          <Calendar size={14} className="mr-1" />
                          <span>{new Date(candidate.interviewDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <User size={48} className="mx-auto mb-4 text-gray-300" />
                <p>No candidates found for interview feedback</p>
              </div>
            )}
          </div>
        </div>

        {/* Feedback Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          {selectedCandidate ? (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Feedback for {selectedCandidate.name}
              </h3>

              {/* Ratings */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Technical Skills
                  </label>
                  <StarRating
                    value={feedbackForm.technicalSkills}
                    onChange={(value) => handleRatingChange('technicalSkills', value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Communication Skills
                  </label>
                  <StarRating
                    value={feedbackForm.communicationSkills}
                    onChange={(value) => handleRatingChange('communicationSkills', value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Problem Solving
                  </label>
                  <StarRating
                    value={feedbackForm.problemSolving}
                    onChange={(value) => handleRatingChange('problemSolving', value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cultural Fit
                  </label>
                  <StarRating
                    value={feedbackForm.culturalFit}
                    onChange={(value) => handleRatingChange('culturalFit', value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Overall Rating
                  </label>
                  <StarRating
                    value={feedbackForm.overallRating}
                    onChange={(value) => handleRatingChange('overallRating', value)}
                  />
                </div>
              </div>

              {/* Text Fields */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Strengths
                  </label>
                  <textarea
                    value={feedbackForm.strengths}
                    onChange={(e) => handleInputChange('strengths', e.target.value)}
                    placeholder="What are the candidate's key strengths?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Areas for Improvement
                  </label>
                  <textarea
                    value={feedbackForm.weaknesses}
                    onChange={(e) => handleInputChange('weaknesses', e.target.value)}
                    placeholder="What areas need improvement?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recommendation
                  </label>
                  <select
                    value={feedbackForm.recommendation}
                    onChange={(e) => handleInputChange('recommendation', e.target.value as 'Hire' | 'Maybe' | 'No Hire')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Hire">Hire</option>
                    <option value="Maybe">Maybe</option>
                    <option value="No Hire">No Hire</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={feedbackForm.additionalNotes}
                    onChange={(e) => handleInputChange('additionalNotes', e.target.value)}
                    placeholder="Any additional comments or observations..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={4}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmitFeedback}
                disabled={submitting || feedbackForm.overallRating === 0}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={20} />
                <span>{submitting ? 'Submitting...' : 'Submit Feedback'}</span>
              </button>
            </div>
          ) : (
            <div className="text-center py-12">
              <MessageSquare size={48} className="mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Candidate</h3>
              <p className="text-gray-600">Choose a candidate from the list to provide interview feedback</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
