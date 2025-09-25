import React, { useState } from 'react';
import { X, Plus, Briefcase } from 'lucide-react';
import { JobPosting } from '../types';

interface AddJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (jobData: any) => void;
  editingJob?: JobPosting;
}

export default function AddJobModal({ isOpen, onClose, onSubmit, editingJob }: AddJobModalProps) {
  const [formData, setFormData] = useState({
    title: editingJob?.title || '',
    department: editingJob?.department || '',
    location: editingJob?.location || '',
    jobType: editingJob?.jobType || 'Full-time',
    description: editingJob?.description || '',
    requirements: editingJob?.requirements?.join('\n') || '',
    deadline: editingJob?.deadline || '',
    portals: editingJob?.portals?.map(p => p.name) || []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const jobTypes = ['Full-time', 'Part-time', 'Contract', 'Internship'];
  const departments = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'HR', 'Finance'];
  const availablePortals = [
    'Naukri.com',
    'LinkedIn',
    'Indeed',
    'Monster',
    'Shine',
    'TimesJobs',
    'Freshersworld',
    'AngelList',
    'Glassdoor',
    'ZipRecruiter'
  ];

  // Update form data when editingJob changes
  React.useEffect(() => {
    if (editingJob) {
      // Convert deadline from ISO format to YYYY-MM-DD format for date input
      let deadlineFormatted = editingJob.deadline;
      if (deadlineFormatted && deadlineFormatted.includes('T')) {
        deadlineFormatted = deadlineFormatted.split('T')[0];
      }
      
      setFormData({
        title: editingJob.title,
        department: editingJob.department,
        location: editingJob.location,
        jobType: editingJob.jobType,
        description: editingJob.description,
        requirements: editingJob.requirements?.join('\n') || '',
        deadline: deadlineFormatted,
        portals: editingJob.portals?.map(p => p.name) || []
      });
    }
  }, [editingJob]);

  if (!isOpen) return null;

  const handlePortalToggle = (portalName: string) => {
    setFormData(prev => ({
      ...prev,
      portals: prev.portals.includes(portalName)
        ? prev.portals.filter(p => p !== portalName)
        : [...prev.portals, portalName]
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) newErrors.title = 'Job title is required';
    if (!formData.department.trim()) newErrors.department = 'Department is required';
    if (!formData.location.trim()) newErrors.location = 'Location is required';
    if (!formData.description.trim()) newErrors.description = 'Job description is required';
    if (!formData.deadline) newErrors.deadline = 'Application deadline is required';

    setErrors(newErrors);
    return (Object.keys(newErrors)?.length || 0) === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const jobData = {
      ...formData,
      requirements: formData.requirements.split('\n').filter(req => req.trim()),
      postedDate: editingJob?.postedDate || new Date().toISOString().split('T')[0],
      status: editingJob?.status || 'Active',
      applicantCount: editingJob?.applicantCount || 0,
      assignedTo: editingJob?.assignedTo || ['HR Team'],
      portals: formData.portals.map(portalName => ({
        name: portalName,
        url: '', // Will be filled by backend or user later
        status: 'Draft',
        applicants: 0
      }))
    };

    onSubmit(jobData);
    
    // Reset form
    setFormData({
      title: editingJob?.title || '',
      department: editingJob?.department || '',
      location: editingJob?.location || '',
      jobType: editingJob?.jobType || 'Full-time',
      description: editingJob?.description || '',
      requirements: editingJob?.requirements?.join('\n') || '',
      deadline: editingJob?.deadline || '',
      portals: editingJob?.portals?.map(p => p.name) || []
    });
    setErrors({});
    onClose();
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Briefcase className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">
              {editingJob ? 'Edit Job' : 'Post New Job'}
            </h2>
          </div>
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
                Job Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g., Senior Frontend Developer"
              />
              {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department *
              </label>
              <select
                value={formData.department}
                onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.department ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              {errors.department && <p className="text-red-500 text-sm mt-1">{errors.department}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location *
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.location ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g., San Francisco, CA or Remote"
              />
              {errors.location && <p className="text-red-500 text-sm mt-1">{errors.location}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Type
              </label>
              <select
                value={formData.jobType}
                onChange={(e) => setFormData(prev => ({ ...prev, jobType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {jobTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Application Deadline *
              </label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.deadline ? 'border-red-300' : 'border-gray-300'
                }`}
                min={new Date().toISOString().split('T')[0]}
              />
              {errors.deadline && <p className="text-red-500 text-sm mt-1">{errors.deadline}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Job Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.description ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Describe the role, responsibilities, and what you're looking for..."
            />
            {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Requirements (one per line)
            </label>
            <textarea
              value={formData.requirements}
              onChange={(e) => setFormData(prev => ({ ...prev, requirements: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="React experience&#10;TypeScript knowledge&#10;3+ years frontend development&#10;Bachelor's degree preferred"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Post to Job Portals
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {availablePortals.map(portal => (
                <label key={portal} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.portals.includes(portal)}
                    onChange={() => handlePortalToggle(portal)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{portal}</span>
                </label>
              ))}
            </div>
            {formData.portals.length > 0 && (
              <p className="text-sm text-gray-500 mt-2">
                Selected: {formData.portals.join(', ')}
              </p>
            )}
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
              <Plus size={16} />
              <span>{editingJob ? 'Update Job' : 'Post Job'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}