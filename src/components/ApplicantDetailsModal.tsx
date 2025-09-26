import React from 'react';
import { X, Mail, Phone, MapPin, Calendar, FileText, Star, DollarSign, Clock, Download } from 'lucide-react';
import { Candidate } from '../types';
import { candidatesAPI } from '../services/api';

interface ApplicantDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicant: Candidate | null;
}

export default function ApplicantDetailsModal({ isOpen, onClose, applicant }: ApplicantDetailsModalProps) {
  if (!isOpen || !applicant) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-medium text-lg">
                {applicant.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{applicant.name}</h2>
              <p className="text-gray-600">{applicant.position}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Contact Information</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Mail size={16} className="text-gray-400" />
                  <span className="text-gray-900">{applicant.email}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Phone size={16} className="text-gray-400" />
                  <span className="text-gray-900">{applicant.phone}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <MapPin size={16} className="text-gray-400" />
                  <span className="text-gray-900">{applicant.location || 'Not specified'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Application Details</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Calendar size={16} className="text-gray-400" />
                  <span className="text-gray-900">
                    Applied: {new Date(applicant.appliedDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <Star size={16} className="text-gray-400" />
                  <span className="text-gray-900">Score: {applicant.score}/10</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-gray-400">Source:</span>
                  <span className="text-gray-900">{applicant.source}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-gray-400">Stage:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    applicant.stage === 'Applied' ? 'bg-blue-100 text-blue-800' :
                    applicant.stage === 'Screening' ? 'bg-yellow-100 text-yellow-800' :
                    applicant.stage === 'Interview' ? 'bg-purple-100 text-purple-800' :
                    applicant.stage === 'Offer' ? 'bg-green-100 text-green-800' :
                    applicant.stage === 'Hired' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {applicant.stage}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Experience and Skills */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Experience</h3>
              <p className="text-gray-700">{applicant.experience || 'Not specified'}</p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {applicant.skills && applicant.skills.length > 0 ? (
                  applicant.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500">No skills specified</span>
                )}
              </div>
            </div>
          </div>

          {/* Salary Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Salary Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3">
                <DollarSign size={16} className="text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Expected</p>
                  <p className="text-gray-900">{applicant.salary?.expected || 'Not specified'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <DollarSign size={16} className="text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Offered</p>
                  <p className="text-gray-900">{applicant.salary?.offered || 'Not specified'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-gray-400">Negotiable:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  applicant.salary?.negotiable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {applicant.salary?.negotiable ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Availability */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Availability</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3">
                <Clock size={16} className="text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Joining Time</p>
                  <p className="text-gray-900">{applicant.availability?.joiningTime || 'Not specified'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Calendar size={16} className="text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Notice Period</p>
                  <p className="text-gray-900">{applicant.availability?.noticePeriod || 'Not specified'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-gray-400">Immediate Joiner:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  applicant.availability?.immediateJoiner ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {applicant.availability?.immediateJoiner ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {applicant.notes && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Notes</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-700">{applicant.notes}</p>
              </div>
            </div>
          )}

          {/* Resume */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Resume</h3>
            <div className="flex items-center space-x-4">
              <FileText size={16} className="text-gray-400" />
              {applicant.resume || applicant.resumeFileId ? (
                <>
                  {applicant.resume && (
                    <a
                      href={applicant.resume}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      View Resume
                    </a>
                  )}
                  <button
                    onClick={async () => {
                      try {
                        const blob = await candidatesAPI.downloadResume(applicant.id);
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `${applicant.name}_Resume.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                      } catch (error) {
                        console.error('Error downloading resume:', error);
                        // Fallback to direct link if available
                        if (applicant.resume) {
                          window.open(applicant.resume, '_blank');
                        } else {
                          alert('Resume not available for download');
                        }
                      }
                    }}
                    className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </button>
                </>
              ) : (
                <span className="text-gray-500 italic">No resume uploaded</span>
              )}
            </div>
            {/* Debug info - remove in production */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-2 text-xs text-gray-400">
                Debug: resume={applicant.resume || 'null'}, resumeFileId={applicant.resumeFileId || 'null'}
              </div>
            )}
          </div>

          {/* Communications */}
          {applicant.communications && applicant.communications.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Communication History</h3>
              <div className="space-y-3">
                {applicant.communications.map((comm, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{comm.type}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(comm.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-700">{comm.content}</p>
                    <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                      comm.status === 'Sent' ? 'bg-green-100 text-green-800' :
                      comm.status === 'Received' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {comm.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
