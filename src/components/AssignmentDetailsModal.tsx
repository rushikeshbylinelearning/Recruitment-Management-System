import React, { useState, useEffect } from 'react';
import { 
  X, 
  Edit, 
  Send, 
  Download, 
  Trash2, 
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Upload,
  MapPin,
  StickyNote
} from 'lucide-react';
import { assignmentsAPI, candidatesAPI, Assignment } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface AssignmentDetailsModalProps {
  assignment: Assignment;
  onClose: () => void;
  onUpdate: () => void;
}

const AssignmentDetailsModal: React.FC<AssignmentDetailsModalProps> = ({
  assignment,
  onClose,
  onUpdate
}) => {
  const { hasPermission } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);
  const [newStatus, setNewStatus] = useState(assignment.status);
  const [candidateData, setCandidateData] = useState<any>(null);
  const [candidateLoading, setCandidateLoading] = useState(false);

  const canEdit = hasPermission('assignments', 'edit');
  const canDelete = hasPermission('assignments', 'delete');

  // Fetch candidate data to get assignment location and notes
  useEffect(() => {
    const fetchCandidateData = async () => {
      setCandidateLoading(true);
      try {
        const response = await candidatesAPI.getCandidateById(assignment.candidate_id);
        if (response.success && response.data) {
          setCandidateData(response.data.candidate);
        }
      } catch (err) {
        console.error('Error fetching candidate data:', err);
      } finally {
        setCandidateLoading(false);
      }
    };

    fetchCandidateData();
  }, [assignment.candidate_id]);

  const getStatusColor = (status: string) => {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Draft': return <FileText size={16} />;
      case 'Assigned': return <Send size={16} />;
      case 'In Progress': return <Clock size={16} />;
      case 'Submitted': return <Upload size={16} />;
      case 'Approved': return <CheckCircle size={16} />;
      case 'Rejected': return <XCircle size={16} />;
      case 'Cancelled': return <AlertCircle size={16} />;
      default: return <FileText size={16} />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSendAssignment = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await assignmentsAPI.sendAssignment(assignment.id);
      if (response.success) {
        onUpdate();
        onClose();
      } else {
        setError(response.message || 'Failed to send assignment');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await assignmentsAPI.updateStatus(assignment.id, newStatus);
      if (response.success) {
        onUpdate();
        setShowStatusUpdate(false);
      } else {
        setError(response.message || 'Failed to update status');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssignment = async () => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await assignmentsAPI.deleteAssignment(assignment.id);
      if (response.success) {
        onUpdate();
        onClose();
      } else {
        setError(response.message || 'Failed to delete assignment');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFile = async (fileId: number) => {
    if (!window.confirm('Are you sure you want to remove this file?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await assignmentsAPI.removeFile(assignment.id, fileId);
      if (response.success) {
        onUpdate();
      } else {
        setError(response.message || 'Failed to remove file');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Assignment Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Header Actions */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(assignment.status)}`}>
                {getStatusIcon(assignment.status)}
                {assignment.status}
              </span>
              {assignment.due_date && (
                <span className="text-sm text-gray-600">
                  Due: {formatDate(assignment.due_date)}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {assignment.status === 'Draft' && canEdit && (
                <button
                  onClick={handleSendAssignment}
                  disabled={loading}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 text-sm"
                >
                  <Send size={14} />
                  Send
                </button>
              )}
              
              {canEdit && (
                <button
                  onClick={() => setShowStatusUpdate(true)}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1 text-sm"
                >
                  <Edit size={14} />
                  Update Status
                </button>
              )}

              {assignment.status === 'Draft' && canDelete && (
                <button
                  onClick={handleDeleteAssignment}
                  disabled={loading}
                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-1 text-sm"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* Assignment Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Assignment Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Title</label>
                  <p className="text-gray-900">{assignment.title}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-500">Candidate</label>
                  <p className="text-gray-900">{assignment.candidate_name}</p>
                  <p className="text-sm text-gray-600">{assignment.candidate_email}</p>
                </div>

                {assignment.job_title && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Job</label>
                    <p className="text-gray-900">{assignment.job_title}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-500">Assigned By</label>
                  <p className="text-gray-900">{assignment.assigned_by_name}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Created</label>
                  <p className="text-gray-900">{formatDateTime(assignment.created_at)}</p>
                </div>

                {assignment.updated_at !== assignment.created_at && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Last Updated</label>
                    <p className="text-gray-900">{formatDateTime(assignment.updated_at)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Description</h3>
              {assignment.description_html ? (
                <div 
                  className="prose max-w-none text-sm text-gray-700 border border-gray-200 rounded-lg p-4 bg-gray-50"
                  dangerouslySetInnerHTML={{ __html: assignment.description_html }}
                />
              ) : (
                <p className="text-gray-500 italic">No description provided</p>
              )}
            </div>
          </div>

          {/* Assignment Location and Notes */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Assignment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assignment Location */}
              <div>
                <label className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-2">
                  <MapPin size={16} />
                  Assignment Location/Link
                </label>
                {candidateLoading ? (
                  <div className="flex items-center justify-center py-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-sm text-gray-600">Loading...</span>
                  </div>
                ) : candidateData?.assignmentLocation ? (
                  <div>
                    <a 
                      href={candidateData.assignmentLocation} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm break-all"
                    >
                      {candidateData.assignmentLocation}
                    </a>
                  </div>
                ) : (
                  <p className="text-gray-500 italic text-sm">No assignment location provided</p>
                )}
              </div>

              {/* Assignment Notes */}
              <div>
                <label className="text-sm font-medium text-gray-500 flex items-center gap-2 mb-2">
                  <StickyNote size={16} />
                  Assignment Notes
                </label>
                {candidateLoading ? (
                  <div className="flex items-center justify-center py-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-sm text-gray-600">Loading...</span>
                  </div>
                ) : candidateData?.assignmentDetails?.inOfficeAssignment ? (
                  <div className="text-sm text-gray-700 bg-white p-3 rounded border">
                    {candidateData.assignmentDetails.inOfficeAssignment}
                  </div>
                ) : (
                  <p className="text-gray-500 italic text-sm">No assignment notes provided</p>
                )}
              </div>
            </div>
          </div>

          {/* Attachments */}
          {assignment.attachments && assignment.attachments.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Attachments</h3>
              <div className="space-y-2">
                {assignment.attachments.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText size={20} className="text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{file.original_name}</p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.file_size)} • {formatDateTime(file.uploaded_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => window.open(`/api/files/${file.id}/download`, '_blank')}
                        className="text-blue-600 hover:text-blue-800"
                        title="Download"
                      >
                        <Download size={16} />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => handleRemoveFile(file.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Remove"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Communications History */}
          {assignment.communications && assignment.communications.length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Communication History</h3>
              <div className="space-y-3">
                {assignment.communications.map((comm) => (
                  <div key={comm.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{comm.type}</span>
                      <span className="text-xs text-gray-500">{formatDateTime(comm.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700">{comm.content}</p>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      comm.status === 'Sent' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {comm.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Status Update Modal */}
        {showStatusUpdate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Update Status</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">New Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Assigned">Assigned</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Submitted">Submitted</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setShowStatusUpdate(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleStatusUpdate}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? 'Updating...' : 'Update Status'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignmentDetailsModal;
