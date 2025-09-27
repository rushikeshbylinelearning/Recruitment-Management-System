import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Interview, Candidate, TeamMember } from '../types';

interface InterviewSchedulerProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (interviewData: any) => void;
  candidates: Candidate[];
  interviewers: TeamMember[];
  editingInterview?: Interview;
}

export default function InterviewScheduler({ 
  isOpen, 
  onClose, 
  onSchedule, 
  candidates, 
  interviewers,
  editingInterview 
}: InterviewSchedulerProps) {
  const [formData, setFormData] = useState({
    candidateId: '',
    interviewerId: '',
    scheduledDate: '',
    duration: 60,
    type: 'Technical',
    location: '',
    meetingLink: '',
    notes: ''
  });

  // Update form data when editingInterview changes
  useEffect(() => {
    if (editingInterview) {
      setFormData({
        candidateId: editingInterview.candidateId?.toString() || '',
        interviewerId: editingInterview.interviewerId?.toString() || '',
        scheduledDate: editingInterview.scheduledDate ? new Date(editingInterview.scheduledDate).toISOString().slice(0, 16) : '',
        duration: editingInterview.duration || 60,
        type: editingInterview.type || 'Technical',
        location: editingInterview.location || '',
        meetingLink: editingInterview.meetingLink || '',
        notes: ''
      });
    } else {
      // Reset form when not editing
      setFormData({
        candidateId: '',
        interviewerId: '',
        scheduledDate: '',
        duration: 60,
        type: 'Technical',
        location: '',
        meetingLink: '',
        notes: ''
      });
    }
  }, [editingInterview]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.candidateId) newErrors.candidateId = 'Candidate is required';
    if (!formData.interviewerId) newErrors.interviewerId = 'Interviewer is required';
    if (!formData.scheduledDate) newErrors.scheduledDate = 'Date and time is required';
    if (!formData.duration || formData.duration < 15) newErrors.duration = 'Duration must be at least 15 minutes';

    setErrors(newErrors);
    return (Object.keys(newErrors)?.length || 0) === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const selectedCandidate = candidates.find(c => c.id.toString() === formData.candidateId);
    const selectedInterviewer = interviewers.find(i => i.id.toString() === formData.interviewerId);

    const interviewData = {
      id: editingInterview?.id || `interview-${Date.now()}`,
      candidateId: formData.candidateId,
      interviewerId: formData.interviewerId,
      interviewerName: selectedInterviewer?.name || '',
      scheduledDate: new Date(formData.scheduledDate).toISOString(),
      duration: formData.duration,
      type: formData.type,
      status: editingInterview?.status || 'Scheduled',
      location: formData.location,
      meetingLink: formData.meetingLink,
      round: editingInterview?.round || 1,
      candidateName: selectedCandidate?.name || '',
      candidateEmail: selectedCandidate?.email || '',
      position: selectedCandidate?.position || ''
    };

    onSchedule(interviewData);
    onClose();
    
    // Reset form
    setFormData({
      candidateId: '',
      interviewerId: '',
      scheduledDate: '',
      duration: 60,
      type: 'Technical',
      location: '',
      meetingLink: '',
      notes: ''
    });
    setErrors({});
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {editingInterview ? 'Edit Interview' : 'Schedule Interview'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Candidate *
              </label>
              <select
                value={formData.candidateId}
                onChange={(e) => setFormData(prev => ({ ...prev, candidateId: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.candidateId ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select candidate</option>
                {candidates.map(candidate => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} - {candidate.position}
                  </option>
                ))}
              </select>
              {errors.candidateId && <p className="text-red-500 text-sm mt-1">{errors.candidateId}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Interviewer *
              </label>
              <select
                value={formData.interviewerId}
                onChange={(e) => setFormData(prev => ({ ...prev, interviewerId: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.interviewerId ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select interviewer</option>
                {interviewers.filter(member => 
                  member.role === 'Interviewer' || 
                  member.role === 'HR Manager'
                ).map(interviewer => (
                  <option key={interviewer.id} value={interviewer.id}>
                    {interviewer.name} - {interviewer.role}
                  </option>
                ))}
              </select>
              {errors.interviewerId && <p className="text-red-500 text-sm mt-1">{errors.interviewerId}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date & Time *
              </label>
              <input
                type="datetime-local"
                value={formData.scheduledDate}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.scheduledDate ? 'border-red-300' : 'border-gray-300'
                }`}
                min={new Date().toISOString().slice(0, 16)}
              />
              {errors.scheduledDate && <p className="text-red-500 text-sm mt-1">{errors.scheduledDate}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (minutes) *
              </label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.duration ? 'border-red-300' : 'border-gray-300'
                }`}
                min="15"
                step="15"
              />
              {errors.duration && <p className="text-red-500 text-sm mt-1">{errors.duration}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Interview Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as "Technical" | "HR" | "Managerial" | "Final" }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Technical">Technical</option>
                <option value="HR">HR</option>
                <option value="Managerial">Managerial</option>
                <option value="Final">Final</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Office address or 'Remote'"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meeting Link (Optional)
            </label>
            <input
              type="url"
              value={formData.meetingLink}
              onChange={(e) => setFormData(prev => ({ ...prev, meetingLink: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://meet.google.com/..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Additional notes for the interview..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Save size={16} />
              <span>{editingInterview ? 'Update Interview' : 'Schedule Interview'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}