import { X, Mail, Phone, MapPin, Star, Download, FileText, User, Calendar, Clock } from 'lucide-react';
import { Candidate } from '../types';
import { candidatesAPI, assignmentsAPI, Assignment } from '../services/api';
import { useState, useEffect } from 'react';

interface CandidateViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
}

export default function CandidateViewModal({ isOpen, onClose, candidate }: CandidateViewModalProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && candidate) {
      fetchAssignments();
    }
  }, [isOpen, candidate]);

  const fetchAssignments = async () => {
    if (!candidate) return;
    
    setAssignmentsLoading(true);
    try {
      console.log('Fetching assignments for candidate ID:', candidate.id);
      const response = await assignmentsAPI.getCandidateAssignments(Number(candidate.id));
      console.log('Assignments API response:', response);
      if (response.success && response.data) {
        setAssignments(response.data);
        console.log('Set assignments:', response.data);
      } else {
        console.log('No assignments data or API failed');
        setAssignments([]);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setAssignments([]);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  if (!isOpen || !candidate) return null;

  const getAssignmentStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-800';
      case 'Assigned': return 'bg-blue-100 text-blue-800';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800';
      case 'Submitted': return 'bg-purple-100 text-purple-800';
      case 'Approved': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      case 'Cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

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
                  {candidate.location && (
                    <div className="flex items-center space-x-3">
                      <MapPin size={16} className="text-gray-400" />
                      <span className="text-gray-700">Location: {candidate.location}</span>
                    </div>
                  )}
                </div>
              </div>

              {candidate.workPreferences && (
                 <div className="bg-gray-50 rounded-lg p-4">
                   <h3 className="text-lg font-medium text-gray-900 mb-4">Work Preferences</h3>
                   <div className="space-y-3">
                     {candidate.workPreferences.workPreference && (
                       <div className="flex items-center justify-between">
                         <span className="text-gray-600">Work Preference:</span>
                         <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                           {candidate.workPreferences.workPreference}
                         </span>
                       </div>
                     )}
                     {candidate.workPreferences.currentCtc && (
                       <div className="flex items-center justify-between">
                         <span className="text-gray-600">Current CTC:</span>
                         <span className="text-gray-900">₹{candidate.workPreferences.currentCtc} ({candidate.workPreferences.ctcFrequency || 'Annual'})</span>
                       </div>
                     )}
                     <div className="flex items-center justify-between">
                       <span className="text-gray-600">Alternate Saturday:</span>
                       <span className={`px-2 py-1 rounded-full text-sm ${
                         candidate.workPreferences.willingAlternateSaturday === true
                           ? 'bg-green-100 text-green-800'
                           : candidate.workPreferences.willingAlternateSaturday === false
                           ? 'bg-red-100 text-red-800'
                           : 'bg-gray-100 text-gray-800'
                       }`}>
                         {candidate.workPreferences.willingAlternateSaturday === true ? 'Yes' : 
                          candidate.workPreferences.willingAlternateSaturday === false ? 'No' : 'Not Specified'}
                       </span>
                     </div>
                   </div>
                 </div>
               )}

               {(candidate.skills && candidate.skills.length > 0) || candidate.expertise && (
                 <div className="bg-gray-50 rounded-lg p-4">
                   <h3 className="text-lg font-medium text-gray-900 mb-4">Skills & Expertise</h3>
                   {candidate.expertise && (
                     <div className="mb-3">
                       <span className="text-sm text-gray-600">Primary Expertise:</span>
                       <p className="text-gray-900 font-medium">{candidate.expertise}</p>
                     </div>
                   )}
                   {candidate.skills && candidate.skills.length > 0 && (
                     <div>
                       <span className="text-sm text-gray-600 mb-2 block">Technical Skills:</span>
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
               )}

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

               {candidate.notes && Array.isArray(candidate.notes) && candidate.notes.length > 0 && (
                 <div className="bg-gray-50 rounded-lg p-4">
                   <h3 className="text-lg font-medium text-gray-900 mb-4">Notes</h3>
                   <div className="space-y-3">
                     {candidate.notes.map((note: any, index: number) => (
                       <div key={note.id || index} className="border-l-4 border-blue-200 pl-4 py-2 bg-white rounded">
                         <div className="flex items-center justify-between mb-2">
                           <div className="flex items-center space-x-2">
                             <span className="text-sm font-medium text-gray-900">{note.user_name}</span>
                             <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                               {note.user_role}
                             </span>
                           </div>
                           <span className="text-xs text-gray-500">
                             {new Date(note.created_at).toLocaleDateString()}
                           </span>
                         </div>
                         {note.notes && (
                           <p className="text-gray-700 text-sm whitespace-pre-wrap">{note.notes}</p>
                         )}
                         {note.rating && (
                           <div className="mt-2 flex items-center space-x-2">
                             <span className="text-sm text-gray-600">Rating:</span>
                             <div className="flex items-center space-x-1">
                               {[1, 2, 3, 4, 5].map((star) => (
                                 <span
                                   key={star}
                                   className={`text-sm ${star <= note.rating ? 'text-yellow-500' : 'text-gray-300'}`}
                                 >
                                   ★
                                 </span>
                               ))}
                               <span className="text-sm text-gray-600 ml-1">({note.rating}/5)</span>
                             </div>
                           </div>
                         )}
                         {note.rating_comments && (
                           <p className="text-gray-600 text-sm mt-1 italic">"{note.rating_comments}"</p>
                         )}
                       </div>
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

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Assignment Details</h3>
                {assignmentsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600">Loading assignments...</span>
                  </div>
                ) : assignments.length > 0 ? (
                  <div className="space-y-4">
                    {assignments.map((assignment) => (
                      <div key={assignment.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{assignment.title}</h4>
                          <span className={`px-2 py-1 text-xs rounded-full ${getAssignmentStatusColor(assignment.status)}`}>
                            {assignment.status}
                          </span>
                        </div>
                        {assignment.due_date && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                            <Calendar size={14} />
                            <span>Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        {candidate.assignmentDetails?.inOfficeAssignment && (
                          <div className="mb-2">
                            <span className="text-sm text-gray-600 block mb-1">Assignment Notes:</span>
                            <div className="text-sm text-gray-700 bg-white p-2 rounded border">
                              {candidate.assignmentDetails.inOfficeAssignment}
                            </div>
                          </div>
                        )}
                        {candidate.assignmentLocation && (
                          <div>
                            <span className="text-sm text-gray-600 block mb-1">Assignment Location:</span>
                            <a 
                              href={candidate.assignmentLocation} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm break-all"
                            >
                              {candidate.assignmentLocation}
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Clock size={32} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-500 italic">No assignments assigned</p>
                  </div>
                )}
              </div>

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

