import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';
import { X } from 'lucide-react';

const APP_URL = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');

interface FormBuilderModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface Job {
  id: number;
  title: string;
}

const FormBuilderModal: React.FC<FormBuilderModalProps> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    job_id: '',
    token_validity_hours: '24'
  });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API_BASE_URL}/jobs?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJobs(response.data.data.jobs || []);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      const parsedJobId = formData.job_id ? parseInt(formData.job_id, 10) : undefined;
      const parsedTokenValidity = parseInt(formData.token_validity_hours || '24', 10);
      await axios.post(
        `${API_BASE_URL}/form-builder/forms`,
        {
          name: formData.name.trim(),
          slug: formData.slug.trim(),
          description: formData.description.trim(),
          ...(parsedJobId !== undefined ? { job_id: parsedJobId } : {}),
          token_validity_hours: Number.isNaN(parsedTokenValidity) ? 24 : parsedTokenValidity
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onSuccess();
    } catch (err: any) {
      const serverMessage = err.response?.data?.message;
      const validationErrors = err.response?.data?.errors;
      if (validationErrors && validationErrors.length > 0) {
        setError(validationErrors.map((e: any) => e.msg).join(', '));
      } else if (serverMessage) {
        setError(serverMessage);
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        setError('Cannot reach the server. Please check your connection or contact support.');
      } else {
        setError(`Failed to create form (${err.response?.status || 'unknown error'})`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Create New Form</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Form Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Developer Application Form"
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
              URL Slug <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="slug"
              required
              value={formData.slug}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="developer-application-form"
            />
            <p className="mt-1 text-xs text-gray-500">
              Form will be accessible at: {APP_URL}/apply/{formData.slug}
            </p>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Brief description of this form"
            />
          </div>

          <div>
            <label htmlFor="token_validity_hours" className="block text-sm font-medium text-gray-700 mb-1">
              Link Validity (Hours)
            </label>
            <input
              type="number"
              id="token_validity_hours"
              min={1}
              max={720}
              value={formData.token_validity_hours}
              onChange={(e) => setFormData(prev => ({ ...prev, token_validity_hours: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Default is 24 hours. Set between 1 and 720 hours.
            </p>
          </div>

          <div>
            <label htmlFor="job_id" className="block text-sm font-medium text-gray-700 mb-1">
              Link to Job (Optional)
            </label>
            <select
              id="job_id"
              value={formData.job_id}
              onChange={(e) => setFormData(prev => ({ ...prev, job_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">No specific job</option>
              {jobs.map(job => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Form'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FormBuilderModal;