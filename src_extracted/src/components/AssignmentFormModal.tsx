import '../styles/JobApplicantsModal.css';
import React, { useState, useEffect } from 'react';
import { X, Save, Send, Upload, FileText, Calendar, Briefcase, Link, ChevronDown } from 'lucide-react';
import { assignmentsAPI, jobsAPI, Assignment } from '../services/api';
import RichTextEditor from './RichTextEditor';

interface AssignmentFormModalProps {
  assignment?: Assignment | null;
  onClose: () => void;
  onSave: () => void;
}

const AssignmentFormModal: React.FC<AssignmentFormModalProps> = ({
  assignment,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    jobId: '',
    title: '',
    descriptionHtml: '',
    dueDate: '',
    assignmentLocation: '',
    assignmentNotes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    fetchJobs();
    if (assignment) {
      setFormData({
        jobId: assignment.job_id?.toString() || '',
        title: assignment.title,
        descriptionHtml: assignment.description_html || '',
        dueDate: assignment.due_date ? assignment.due_date.split('T')[0] : '',
        assignmentLocation: '',
        assignmentNotes: '',
      });
    }
  }, [assignment]);

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

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setSelectedFiles(e.target.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Assignment title is required.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const assignmentData = {
        jobId: formData.jobId ? parseInt(formData.jobId) : undefined,
        title: formData.title,
        descriptionHtml: formData.descriptionHtml || undefined,
        dueDate: formData.dueDate || undefined,
      };

      let response;
      if (assignment) {
        response = await assignmentsAPI.updateAssignment(assignment.id, assignmentData);
      } else {
        response = await assignmentsAPI.createAssignment(assignmentData);
      }

      if (response.success) {
        if (selectedFiles && selectedFiles.length > 0 && response.data) {
          await assignmentsAPI.uploadFiles(response.data.id, selectedFiles);
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

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const isEdit = !!assignment;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className={`shared-modal-shell transition-all duration-200 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      >
        {/* Header */}
        <div className="shared-modal-header">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
              <FileText size={18} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isEdit ? 'Edit Assignment' : 'Create Assignment'}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {isEdit ? 'Update assignment details' : 'Define a reusable assignment template'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="shared-modal-form-body space-y-5">
          {error && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              Assignment Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              placeholder="e.g. Frontend Take-Home Task"
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
            />
          </div>

          {/* Job (optional) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              <span className="flex items-center gap-1">
                <Briefcase size={12} /> Linked Job (optional)
              </span>
            </label>
            <div className="relative">
              <select
                name="jobId"
                value={formData.jobId}
                onChange={handleInputChange}
                className="w-full appearance-none px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow pr-8"
              >
                <option value="">No job linked</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}{job.department ? ` — ${job.department}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              <span className="flex items-center gap-1">
                <Calendar size={12} /> Default Due Date (optional)
              </span>
            </label>
            <input
              type="date"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleInputChange}
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              Description
            </label>
            <RichTextEditor
              value={formData.descriptionHtml}
              onChange={(value) => setFormData((prev) => ({ ...prev, descriptionHtml: value }))}
              placeholder="Describe the assignment tasks, expectations, and deliverables…"
              height={180}
            />
          </div>

          {/* Assignment Link */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              <span className="flex items-center gap-1">
                <Link size={12} /> Assignment Link / Location (optional)
              </span>
            </label>
            <input
              type="text"
              name="assignmentLocation"
              value={formData.assignmentLocation}
              onChange={handleInputChange}
              placeholder="e.g. https://drive.google.com/… or /files/task.pdf"
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              <span className="flex items-center gap-1">
                <Upload size={12} /> Attachments (optional)
              </span>
            </label>
            <label className="flex flex-col items-center justify-center w-full px-4 py-5 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors">
              <Upload size={20} className="text-gray-400 mb-1.5" />
              <span className="text-sm text-gray-500">
                {selectedFiles && selectedFiles.length > 0
                  ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected`
                  : 'Click to upload — PDF, DOC, DOCX, TXT'}
              </span>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt"
              />
            </label>
            {selectedFiles && selectedFiles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {Array.from(selectedFiles).map((file, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                    <FileText size={12} className="text-indigo-400 shrink-0" />
                    {file.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="shared-modal-footer shared-modal-footer-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          {isEdit && assignment?.status === 'Draft' && (
            <button
              type="button"
              onClick={handleSendAssignment}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              <Send size={14} />
              {loading ? 'Sending…' : 'Send'}
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            <Save size={14} />
            {loading ? 'Saving…' : isEdit ? 'Update' : 'Save Draft'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignmentFormModal;