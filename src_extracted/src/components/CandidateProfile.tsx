import { useState, useEffect, useRef } from 'react';
import { X, User, Mail, Phone, Calendar, DollarSign, Clock, MessageSquare, ClipboardList, FileText, Send, CheckCircle, XCircle, AlertCircle, Download, StickyNote } from 'lucide-react';
import { Candidate } from '../types';
import { assignmentsAPI, Assignment } from '../services/api';
import InterviewManagement from './InterviewManagement';
import NotesPanel from './NotesPanel';
import FileViewer, { ViewerFile } from './FileViewer';

interface CandidateAssignmentNew {
  id: number;
  candidate_id: number;
  assignment_id: number;
  assignment_title: string;
  status: 'Assigned' | 'Submitted' | 'Reviewed';
  deadline: string;
  submitted_at?: string;
  email_status?: string;
  is_overdue?: boolean;
}

interface CandidateAssignmentFile {
  id: number;
  original_filename: string;
  stored_filename: string;
  mime_type: string;
  file_size: number;
}

interface CandidateProfileProps {
  candidate: Candidate;
  onClose: () => void;
  onUpdateCandidate: (candidate: Candidate) => void;
}

export default function CandidateProfile({ candidate, onClose }: CandidateProfileProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [candidateAssignmentsNew, setCandidateAssignmentsNew] = useState<CandidateAssignmentNew[]>([]);
  const [candidateAssignmentsNewLoading, setCandidateAssignmentsNewLoading] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Record<number, CandidateAssignmentFile[]>>({});
  const [loadingFiles, setLoadingFiles] = useState<Record<number, boolean>>({});
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const notesButtonRef = useRef<HTMLButtonElement>(null);

  // File viewer
  const [viewerFiles, setViewerFiles] = useState<ViewerFile[] | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);

  const openFileViewer = (files: CandidateAssignmentFile[], startIndex = 0) => {
    const viewable: ViewerFile[] = files.map(f => ({
      name: f.original_filename,
      url: `/uploads/assignment-submissions/${f.stored_filename}`,
      mimeType: f.mime_type,
    }));
    setViewerFiles(viewable);
    setViewerIndex(startIndex);
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'interviews', label: 'Interviews' },
    { id: 'communications', label: 'Communications' },
    { id: 'assignments', label: 'Assignments' }
  ];

  useEffect(() => {
    fetchAssignments();
    fetchCandidateAssignmentsNew();
    pollingRef.current = setInterval(fetchCandidateAssignmentsNew, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [candidate.id]);

  const fetchAssignments = async () => {
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

  const fetchCandidateAssignmentsNew = async () => {
    setCandidateAssignmentsNewLoading(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/candidate-assignments?candidateId=${candidate.id}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (data.success && data.data) {
        setCandidateAssignmentsNew(data.data);
      } else {
        setCandidateAssignmentsNew([]);
      }
    } catch (error) {
      console.error('Error fetching candidate assignments (new):', error);
    } finally {
      setCandidateAssignmentsNewLoading(false);
    }
  };

  const fetchAssignmentFiles = async (assignmentId: number) => {
    if (expandedFiles[assignmentId]) {
      setExpandedFiles(prev => { const next = { ...prev }; delete next[assignmentId]; return next; });
      return;
    }
    setLoadingFiles(prev => ({ ...prev, [assignmentId]: true }));
    try {
      const authToken = localStorage.getItem('authToken');
      const response = await fetch(`/api/candidate-assignments/${assignmentId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (data.success && data.data?.files) {
        setExpandedFiles(prev => ({ ...prev, [assignmentId]: data.data.files }));
      }
    } catch (error) {
      console.error('Error fetching assignment files:', error);
    } finally {
      setLoadingFiles(prev => ({ ...prev, [assignmentId]: false }));
    }
  };

  const getNewAssignmentStatusColor = (status: string) => {
    switch (status) {
      case 'Assigned': return 'bg-blue-100 text-blue-800';
      case 'Submitted': return 'bg-purple-100 text-purple-800';
      case 'Reviewed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
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

  const getAssignmentStatusIcon = (status: string) => {
    switch (status) {
      case 'Draft': return <FileText size={16} />;
      case 'Assigned': return <Send size={16} />;
      case 'In Progress': return <Clock size={16} />;
      case 'Submitted': return <FileText size={16} />;
      case 'Approved': return <CheckCircle size={16} />;
      case 'Rejected': return <XCircle size={16} />;
      case 'Cancelled': return <AlertCircle size={16} />;
      default: return <FileText size={16} />;
    }
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

      {/* Assignment Status */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignment Status</h3>
        {assignmentsLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading assignments...</span>
          </div>
        ) : assignments.length > 0 ? (
          <div className="space-y-4">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="border border-gray-200 rounded-lg p-4">
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
                {assignment.description_html && (
                  <div 
                    className="text-sm text-gray-700 prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: assignment.description_html }}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 italic">No assignments assigned</p>
        )}
      </div>

      {/* Notes */}
      {candidate.notes && Array.isArray(candidate.notes) && candidate.notes.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
          <div className="space-y-4">
            {candidate.notes.map((note: any, index: number) => (
              <div key={note.id || index} className="border-l-4 border-blue-200 pl-4 py-2">
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
                  <p className="text-gray-700 text-sm">{note.notes}</p>
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
  );

  const InterviewsTab = () => (
    <div className="space-y-4">
      <InterviewManagement />
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

  const AssignmentsTab = () => (
    <div className="space-y-4">
      {assignmentsLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : assignments.length > 0 ? (
        assignments.map((assignment) => (
          <div key={assignment.id} className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center space-x-3">
                <ClipboardList size={20} className="text-blue-500" />
                <div>
                  <h4 className="font-medium text-gray-900">{assignment.title}</h4>
                  {assignment.job_title && (
                    <p className="text-sm text-gray-600">{assignment.job_title}</p>
                  )}
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getAssignmentStatusColor(assignment.status)}`}>
                {getAssignmentStatusIcon(assignment.status)}
                {assignment.status}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Due Date:</span>
                <p className="font-medium">{assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'Not set'}</p>
              </div>
              <div>
                <span className="text-gray-500">Assigned By:</span>
                <p className="font-medium">{assignment.assigned_by_name}</p>
              </div>
              <div>
                <span className="text-gray-500">Attachments:</span>
                <p className="font-medium">{assignment.attachment_count || 0} files</p>
              </div>
            </div>

            {assignment.description_html && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-2">Description:</p>
                <div 
                  className="prose prose-sm max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: assignment.description_html }}
                />
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
              <span>Created: {new Date(assignment.created_at).toLocaleDateString()}</span>
              {assignment.last_sent && (
                <span>Last sent: {new Date(assignment.last_sent).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-8">
          <ClipboardList size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments</h3>
          <p className="text-gray-600">Assignment history will appear here.</p>
        </div>
      )}

      {/* Candidate Assignments (new) */}
      <div className="mt-6">
        <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Send size={16} className="text-blue-500" />
          Sent Assignments
        </h3>
        {candidateAssignmentsNewLoading && candidateAssignmentsNew.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : candidateAssignmentsNew.length > 0 ? (
          candidateAssignmentsNew.map((ca) => (
            <div key={ca.id} className="bg-white p-4 rounded-lg border border-gray-200 mb-3">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-3">
                  <ClipboardList size={20} className="text-blue-500" />
                  <h4 className="font-medium text-gray-900">{ca.assignment_title}</h4>
                </div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getNewAssignmentStatusColor(ca.status)}`}>
                  {ca.status}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Deadline:</span>
                  <p className="font-medium">{ca.deadline ? new Date(ca.deadline).toLocaleDateString() : 'Not set'}</p>
                </div>
                {ca.submitted_at && (
                  <div>
                    <span className="text-gray-500">Submitted:</span>
                    <p className="font-medium">{new Date(ca.submitted_at).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {(ca.status === 'Submitted' || ca.status === 'Reviewed') && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => fetchAssignmentFiles(ca.id)}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <Download size={14} />
                    {loadingFiles[ca.id] ? 'Loading...' : expandedFiles[ca.id] ? 'Hide Files' : 'View Files'}
                  </button>
                  {expandedFiles[ca.id] && expandedFiles[ca.id].length > 0 && (
                    <div className="mt-2 space-y-1">
                      {expandedFiles[ca.id].map((file, fi) => (
                        <div key={file.id} className="flex items-center gap-2">
                          <button
                            onClick={() => openFileViewer(expandedFiles[ca.id], fi)}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline text-left"
                          >
                            <FileText size={13} className="flex-shrink-0" />
                            {file.original_filename}
                            <span className="text-gray-400 text-xs">({(file.file_size / 1024).toFixed(1)} KB)</span>
                          </button>
                          <a
                            href={`/uploads/assignment-submissions/${file.stored_filename}`}
                            download={file.original_filename}
                            className="text-gray-400 hover:text-gray-600"
                            title="Download"
                          >
                            <Download size={12} />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                  {expandedFiles[ca.id] && expandedFiles[ca.id].length === 0 && (
                    <p className="mt-2 text-sm text-gray-500 italic">No files found.</p>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-6 bg-white rounded-lg border border-gray-200">
            <Send size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm">No sent assignments yet.</p>
          </div>
        )}
      </div>
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
          <div className="flex items-center gap-3">
            <button
              ref={notesButtonRef}
              onClick={() => setNotesOpen(o => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
              title="Add / view notes"
            >
              <StickyNote size={15} />
              Notes
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
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
          {activeTab === 'communications' && <CommunicationsTab />}
          {activeTab === 'assignments' && <AssignmentsTab />}
        </div>
      </div>

      <NotesPanel
        candidateId={String(candidate.id)}
        anchorRef={notesButtonRef as React.RefObject<HTMLElement>}
        isOpen={notesOpen}
        onClose={() => setNotesOpen(false)}
      />

      {viewerFiles && (
        <FileViewer
          files={viewerFiles}
          initialIndex={viewerIndex}
          onClose={() => setViewerFiles(null)}
        />
      )}
    </div>
  );
}