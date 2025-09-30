import React, { useState, useEffect } from 'react';
import { X, Save, Send, Upload, FileText, Calendar, User, Briefcase } from 'lucide-react';
import { assignmentsAPI, candidatesAPI, jobsAPI, Assignment } from '../services/api';
import RichTextEditor from './RichTextEditor';

interface AssignmentFormModalProps {
  assignment?: Assignment | null;
  onClose: () => void;
  onSave: () => void;
}

const AssignmentFormModal: React.FC<AssignmentFormModalProps> = ({
  assignment,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    candidateId: '',
    jobId: '',
    title: '',
    descriptionHtml: '',
    dueDate: '',
    assignmentLocation: '',
    assignmentNotes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [currentCandidate, setCurrentCandidate] = useState<any>(null);

  useEffect(() => {
    fetchCandidates();
    fetchJobs();
    
    if (assignment) {
      setFormData({
        candidateId: assignment.candidate_id.toString(),
        jobId: assignment.job_id?.toString() || '',
        title: assignment.title,
        descriptionHtml: assignment.description_html || '',
        dueDate: assignment.due_date ? assignment.due_date.split('T')[0] : '',
        assignmentLocation: '',
        assignmentNotes: ''
      });
      // Fetch candidate data to populate assignment location and notes
      fetchCandidateData(assignment.candidate_id.toString());
    }
  }, [assignment]);

  const fetchCandidates = async () => {
    try {
      const response = await candidatesAPI.getCandidates({ page: 1, limit: 100 });
      if (response.success && response.data) {
        setCandidates(response.data.candidates || []);
      }
    } catch (err) {
      console.error('Error fetching candidates:', err);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await jobsAPI.getJobs({ page: 1, limit: 100 });
      if (response.success && response.data) {
        setJobs(response.data.jobs || []);
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    }
  };

  const fetchCandidateData = async (candidateId: string) => {
    try {
      const response = await candidatesAPI.getCandidate(parseInt(candidateId));
      if (response.success && response.data) {
        setCurrentCandidate(response.data);
        setFormData(prev => ({
          ...prev,
          assignmentLocation: response.data.assignmentLocation || '',
          assignmentNotes: response.data.assignmentDetails?.inOfficeAssignment || ''
        }));
      }
    } catch (err) {
      console.error('Error fetching candidate data:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // If candidate selection changed, fetch their data
    if (name === 'candidateId' && value) {
      fetchCandidateData(value);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(e.target.files);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const assignmentData = {
        candidateId: parseInt(formData.candidateId),
        jobId: formData.jobId ? parseInt(formData.jobId) : undefined,
        title: formData.title,
        descriptionHtml: formData.descriptionHtml,
        dueDate: formData.dueDate || undefined
      };

      let response;
      if (assignment) {
        response = await assignmentsAPI.updateAssignment(assignment.id, assignmentData);
      } else {
        response = await assignmentsAPI.createAssignment(assignmentData);
      }

      if (response.success) {
        // Upload files if any
        if (selectedFiles && selectedFiles.length > 0 && response.data) {
          await assignmentsAPI.uploadFiles(response.data.id, selectedFiles);
        }
        
        // Update candidate's assignment location and notes
        if (formData.candidateId) {
          try {
            await candidatesAPI.updateCandidatePartial(parseInt(formData.candidateId), {
              assignmentLocation: formData.assignmentLocation,
              inOfficeAssignment: formData.assignmentNotes
            });
          } catch (err) {
            console.error('Error updating candidate assignment details:', err);
            // Don't fail the whole operation if candidate update fails
          }
        }
        
        onSave();
      } else {
        setError(response.message || 'Failed to save assignment');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSendAssignment = async () => {
    if (!assignment) return;
    
    setLoading(true);
    setError(null);

    try {
      const response = await assignmentsAPI.sendAssignment(assignment.id);
      if (response.success) {
        onSave();
      } else {
        setError(response.message || 'Failed to send assignment');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {assignment ? 'Edit Assignment' : 'Create Assignment'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Candidate Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User size={16} className="inline mr-2" />
                Candidate *
              </label>
              <select
                name="candidateId"
                value={formData.candidateId}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a candidate</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} ({candidate.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Job Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Briefcase size={16} className="inline mr-2" />
                Job (Optional)
              </label>
              <select
                name="jobId"
                value={formData.jobId}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a job</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} - {job.department}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FileText size={16} className="inline mr-2" />
              Assignment Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter assignment title"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar size={16} className="inline mr-2" />
              Due Date
            </label>
            <input
              type="date"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assignment Description
            </label>
            <RichTextEditor
              value={formData.descriptionHtml}
              onChange={(value) => setFormData(prev => ({ ...prev, descriptionHtml: value }))}
              placeholder="Enter assignment description..."
              height={200}
            />
            <p className="text-sm text-gray-500 mt-1">
              Use the toolbar above to format your text with bold, italic, lists, links, and more.
            </p>
          </div>

          {/* Assignment Location and Notes Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Candidate Assignment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assignment Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assignment Location/Link
                </label>
                <input
                  type="text"
                  name="assignmentLocation"
                  value={formData.assignmentLocation}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="File path or URL to assignment file"
                />
                <p className="text-sm text-gray-500 mt-1">
                  This will be stored in the candidate's profile
                </p>
              </div>

              {/* Assignment Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assignment Notes
                </label>
                <textarea
                  name="assignmentNotes"
                  value={formData.assignmentNotes}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Additional notes about the assignment..."
                />
                <p className="text-sm text-gray-500 mt-1">
                  This will be stored in the candidate's profile
                </p>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Upload size={16} className="inline mr-2" />
              Attachments
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              accept=".pdf,.doc,.docx,.txt"
            />
            <p className="text-sm text-gray-500 mt-1">
              Supported formats: PDF, DOC, DOCX, TXT
            </p>
            {selectedFiles && selectedFiles.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-gray-600">Selected files:</p>
                <ul className="text-sm text-gray-500">
                  {Array.from(selectedFiles).map((file, index) => (
                    <li key={index}>{file.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save size={16} />
              {loading ? 'Saving...' : (assignment ? 'Update' : 'Save Draft')}
            </button>

            {assignment && assignment.status === 'Draft' && (
              <button
                type="button"
                onClick={handleSendAssignment}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Send size={16} />
                {loading ? 'Sending...' : 'Send Assignment'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignmentFormModal;
