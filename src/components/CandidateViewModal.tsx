import React from 'react';
import { X, Mail, Phone, MapPin, Calendar, Star, Download, FileText, User } from 'lucide-react';
import { Candidate } from '../types';
import { candidatesAPI } from '../services/api';

interface CandidateViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
}

export default function CandidateViewModal({ isOpen, onClose, candidate }: CandidateViewModalProps) {
  if (!isOpen || !candidate) return null;

  const handleDownloadResume = async () => {
    try {
      const blob = await candidatesAPI.downloadResume(candidate.id);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Get original filename from metadata
      const metadataResponse = await candidatesAPI.getResumeMetadata(candidate.id);
      const filename = metadataResponse.data?.originalName || `resume_${candidate.id}.pdf`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading resume:', err);
      alert('Failed to download resume');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <User size={24} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{candidate.name}</h2>
              <p className="text-gray-600">{candidate.position}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Basic Info */}
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Mail size={16} className="text-gray-400" />
                    <span className="text-gray-700">{candidate.email}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Phone size={16} className="text-gray-400" />
                    <span className="text-gray-700">{candidate.phone}</span>
                  </div>
                  {candidate.source && (
                    <div className="flex items-center space-x-3">
                      <MapPin size={16} className="text-gray-400" />
                      <span className="text-gray-700">Source: {candidate.source}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Application Details</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Applied Date:</span>
                    <span className="text-gray-900">{new Date(candidate.appliedDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Stage:</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      {candidate.stage}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Score:</span>
                    <div className="flex items-center space-x-1">
                      <Star size={16} className="text-yellow-500" />
                      <span className="text-gray-900">{candidate.score}/5</span>
                    </div>
                  </div>
                </div>
              </div>

              {candidate.skills && candidate.skills.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {candidate.skills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Additional Info */}
            <div className="space-y-6">
              {candidate.salary && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Salary Information</h3>
                  <div className="space-y-3">
                    {candidate.salary.expected && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Expected:</span>
                        <span className="text-gray-900">₹{candidate.salary.expected}</span>
                      </div>
                    )}
                    {candidate.salary.offered && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Offered:</span>
                        <span className="text-gray-900">₹{candidate.salary.offered}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Negotiable:</span>
                      <span className={`px-2 py-1 rounded-full text-sm ${
                        candidate.salary.negotiable 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {candidate.salary.negotiable ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {candidate.availability && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Availability</h3>
                  <div className="space-y-3">
                    {candidate.availability.joiningTime && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Joining Time:</span>
                        <span className="text-gray-900">{candidate.availability.joiningTime}</span>
                      </div>
                    )}
                    {candidate.availability.noticePeriod && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Notice Period:</span>
                        <span className="text-gray-900">{candidate.availability.noticePeriod}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Immediate Joiner:</span>
                      <span className={`px-2 py-1 rounded-full text-sm ${
                        candidate.availability.immediateJoiner 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {candidate.availability.immediateJoiner ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Resume</h3>
                {candidate.resumeFileId ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FileText size={20} className="text-gray-400" />
                      <span className="text-gray-700">Resume available</span>
                    </div>
                    <button
                      onClick={handleDownloadResume}
                      className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Download size={16} />
                      <span>Download</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <FileText size={20} className="text-gray-400" />
                    <span className="text-gray-500">No resume uploaded</span>
                  </div>
                )}
              </div>

              {candidate.notes && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Notes</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{candidate.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

