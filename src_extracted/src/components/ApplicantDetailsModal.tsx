import { X, Mail, Phone, MapPin, Calendar, FileText, Star, DollarSign, Clock, Download, Briefcase, Award, TrendingUp } from 'lucide-react';
import { Candidate } from '../types';
import { candidatesAPI } from '../services/api';
import { formatToDDMMYYYY } from '../utils/dateFormatter';

interface ApplicantDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicant: Candidate | null;
}

const getStageColor = (stage: string) => {
  const stageColors: { [key: string]: { bg: string; text: string; border: string } } = {
    'Applied': { bg: 'bg-gradient-to-r from-blue-50 to-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    'Screening': { bg: 'bg-gradient-to-r from-amber-50 to-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    'Interview': { bg: 'bg-gradient-to-r from-purple-50 to-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
    'Offer': { bg: 'bg-gradient-to-r from-green-50 to-green-100', text: 'text-green-700', border: 'border-green-200' },
    'Hired': { bg: 'bg-gradient-to-r from-emerald-50 to-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  };
  return stageColors[stage] || { bg: 'bg-gradient-to-r from-red-50 to-red-100', text: 'text-red-700', border: 'border-red-200' };
};

export default function ApplicantDetailsModal({ isOpen, onClose, applicant }: ApplicantDetailsModalProps) {
  if (!isOpen || !applicant) return null;

  const stageColor = getStageColor(applicant.stage);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Premium Header with Gradient Background */}
        <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-8 border-b border-slate-700">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-slate-300 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg"
          >
            <X size={24} />
          </button>
          
          <div className="flex items-start space-x-6">
            {/* Avatar with Premium Styling */}
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-blue-300 ring-opacity-30">
                <span className="text-white font-bold text-2xl">
                  {applicant.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white ${
                applicant.stage === 'Hired' ? 'bg-green-500' :
                applicant.stage === 'Offer' ? 'bg-blue-500' :
                applicant.stage === 'Interview' ? 'bg-purple-500' :
                applicant.stage === 'Screening' ? 'bg-amber-500' :
                'bg-gray-500'
              }`}></div>
            </div>
            
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-2">{applicant.name}</h2>
              <div className="flex items-center space-x-3 mb-4">
                <Briefcase size={18} className="text-blue-300" />
                <p className="text-lg text-slate-200">{applicant.position}</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className={`px-4 py-2 rounded-xl font-semibold text-sm border-2 ${stageColor.bg} ${stageColor.text} ${stageColor.border}`}>
                  {applicant.stage}
                </div>
                {applicant.score && (
                  <div className="flex items-center space-x-2 bg-slate-700 px-4 py-2 rounded-xl">
                    <Star size={16} className="text-yellow-400 fill-yellow-400" />
                    <span className="font-semibold">{applicant.score}/10</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8 bg-gradient-to-b from-white to-slate-50">
          {/* Contact & Application Details - Premium Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contact Information Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3 mb-5">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Mail size={20} className="text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Contact Information</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-start space-x-3 pb-3 border-b border-slate-100">
                  <Mail size={16} className="text-slate-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</p>
                    <p className="text-slate-900 font-medium">{applicant.email}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 pb-3 border-b border-slate-100">
                  <Phone size={16} className="text-slate-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</p>
                    <p className="text-slate-900 font-medium">{applicant.phone}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <MapPin size={16} className="text-slate-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Location</p>
                    <p className="text-slate-900 font-medium">{applicant.location || 'Not specified'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Application Details Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3 mb-5">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar size={20} className="text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Application Details</h3>
              </div>
              <div className="space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Applied Date</p>
                  <p className="text-slate-900 font-medium">{formatToDDMMYYYY(applicant.appliedDate)}</p>
                </div>
                <div className="pb-3 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Source</p>
                  <p className="text-slate-900 font-medium">{applicant.source}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Current Stage</p>
                  <div className={`inline-block px-4 py-2 rounded-lg font-semibold text-sm border-2 ${stageColor.bg} ${stageColor.text} ${stageColor.border}`}>
                    {applicant.stage}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Experience and Skills - Premium Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Experience Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3 mb-5">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp size={20} className="text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Experience</h3>
              </div>
              <p className="text-slate-700 leading-relaxed">{applicant.experience || 'Not specified'}</p>
            </div>

            {/* Skills Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3 mb-5">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Award size={20} className="text-amber-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Skills</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {applicant.skills && applicant.skills.length > 0 ? (
                  applicant.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 rounded-full text-sm font-medium border border-blue-200 hover:shadow-md transition-shadow"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 italic">No skills specified</span>
                )}
              </div>
            </div>
          </div>

          {/* Salary Information - Premium Card */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center space-x-3 mb-5">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <DollarSign size={20} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Salary Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Expected Salary</p>
                <p className="text-xl font-bold text-slate-900">{applicant.salary?.expected || 'Not specified'}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Offered Salary</p>
                <p className="text-xl font-bold text-slate-900">{applicant.salary?.offered || 'Not specified'}</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Negotiable</p>
                <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-semibold ${
                  applicant.salary?.negotiable ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {applicant.salary?.negotiable ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Availability - Premium Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3 mb-5">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Clock size={20} className="text-indigo-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Availability</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Joining Time</p>
                <p className="text-slate-900 font-medium">{applicant.availability?.joiningTime || 'Not specified'}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notice Period</p>
                <p className="text-slate-900 font-medium">{applicant.availability?.noticePeriod || 'Not specified'}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Immediate Joiner</p>
                <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-semibold ${
                  applicant.availability?.immediateJoiner ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {applicant.availability?.immediateJoiner ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {applicant.notes && Array.isArray(applicant.notes) && applicant.notes.length > 0 && (
            <div>
              <div className="flex items-center space-x-3 mb-5">
                <div className="p-2 bg-cyan-100 rounded-lg">
                  <FileText size={20} className="text-cyan-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Notes & Feedback</h3>
              </div>
              <div className="space-y-3">
                {applicant.notes.map((note: any, index: number) => (
                  <div key={note.id || index} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {note.user_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{note.user_name}</p>
                          <p className="text-xs text-slate-500">{new Date(note.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                        {note.user_role}
                      </span>
                    </div>
                    {note.notes && (
                      <p className="text-slate-700 text-sm mb-3 leading-relaxed">{note.notes}</p>
                    )}
                    {note.rating && (
                      <div className="flex items-center space-x-3 pt-3 border-t border-slate-100">
                        <span className="text-sm font-semibold text-slate-600">Rating:</span>
                        <div className="flex items-center space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span
                              key={star}
                              className={`text-lg ${star <= note.rating ? 'text-yellow-400' : 'text-slate-300'}`}
                            >
                              ★
                            </span>
                          ))}
                          <span className="text-sm font-semibold text-slate-600 ml-2">({note.rating}/5)</span>
                        </div>
                      </div>
                    )}
                    {note.rating_comments && (
                      <p className="text-slate-600 text-sm mt-2 italic border-l-2 border-blue-300 pl-3">"{note.rating_comments}"</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resume */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center space-x-3 mb-5">
              <div className="p-2 bg-red-100 rounded-lg">
                <FileText size={20} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Resume</h3>
            </div>
            <div className="flex items-center justify-between">
              {applicant.resume || applicant.resumeFileId ? (
                <div className="flex items-center space-x-4 flex-1">
                  <div className="p-3 bg-red-50 rounded-lg">
                    <FileText size={24} className="text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-600 mb-1">Resume Document</p>
                    <p className="text-slate-900 font-medium">{applicant.name}_Resume.pdf</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {applicant.resume && (
                      <a
                        href={applicant.resume}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
                      >
                        View
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
                          if (applicant.resume) {
                            window.open(applicant.resume, '_blank');
                          } else {
                            alert('Resume not available for download');
                          }
                        }
                      }}
                      className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:shadow-lg transition-all font-medium text-sm"
                    >
                      <Download size={16} />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-3 text-slate-500">
                  <FileText size={20} className="text-slate-300" />
                  <span className="italic">No resume uploaded</span>
                </div>
              )}
            </div>
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-3 text-xs text-slate-400 bg-slate-50 p-2 rounded">
                Debug: resume={applicant.resume || 'null'}, resumeFileId={applicant.resumeFileId || 'null'}
              </div>
            )}
          </div>

          {/* Communications */}
          {applicant.communications && applicant.communications.length > 0 && (
            <div>
              <div className="flex items-center space-x-3 mb-5">
                <div className="p-2 bg-teal-100 rounded-lg">
                  <Mail size={20} className="text-teal-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Communication History</h3>
              </div>
              <div className="space-y-3">
                {applicant.communications.map((comm, index) => (
                  <div key={index} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          comm.status === 'Sent' ? 'bg-green-500' :
                          comm.status === 'Received' ? 'bg-blue-500' :
                          'bg-amber-500'
                        }`}></div>
                        <span className="font-semibold text-slate-900">{comm.type}</span>
                      </div>
                      <span className="text-sm text-slate-500">
                        {new Date(comm.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-slate-700 mb-3">{comm.content}</p>
                    <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      comm.status === 'Sent' ? 'bg-green-100 text-green-700 border border-green-200' :
                      comm.status === 'Received' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                      'bg-amber-100 text-amber-700 border border-amber-200'
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
