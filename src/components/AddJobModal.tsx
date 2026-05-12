import React, { useState } from 'react';
import { X, Briefcase, MapPin, Calendar, AlignLeft, ListChecks, Globe, ChevronDown } from 'lucide-react';
import { JobPosting } from '../types';
import '../styles/AddJobModal.css';
import '../styles/JobModalAnimations.css';

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
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const jobTypes = ['Full-time', 'Part-time', 'Contract', 'Internship'];
  const departments = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'HR', 'Finance'];
  const availablePortals = [
    'Naukri.com', 'LinkedIn', 'Indeed',
    'Monster', 'Shine', 'TimesJobs',
    'Freshersworld', 'AngelList', 'Glassdoor', 'ZipRecruiter'
  ];

  React.useEffect(() => {
    if (editingJob) {
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
    if (!formData.title.trim()) newErrors.title = 'Required';
    if (!formData.department.trim()) newErrors.department = 'Required';
    if (!formData.location.trim()) newErrors.location = 'Required';
    if (!formData.description.trim()) newErrors.description = 'Required';
    if (!formData.deadline) newErrors.deadline = 'Required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
        url: '',
        status: 'Draft',
        applicants: 0
      }))
    };
    onSubmit(jobData);
    setFormData({
      title: '', department: '', location: '',
      jobType: 'Full-time', description: '', requirements: '', deadline: '', portals: []
    });
    setErrors({});
    onClose();
  };

  return (
    <div className="ajm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ajm-modal">
        {/* Header */}
        <div className="ajm-header">
          <div className="ajm-header-left">
            <div className="ajm-header-icon">
              <Briefcase size={16} />
            </div>
            <div>
              <h2 className="ajm-title">{editingJob ? 'Edit Job' : 'Post New Job'}</h2>
              <p className="ajm-subtitle">Fill in the details to {editingJob ? 'update this' : 'publish a new'} position</p>
            </div>
          </div>
          <button onClick={onClose} className="ajm-close-btn" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="ajm-body">
          <form onSubmit={handleSubmit} noValidate>

            {/* Section: Role */}
            <div className="ajm-section">
              <div className="ajm-section-label">
                <Briefcase size={13} />
                <span>Role Details</span>
              </div>
              <div className="ajm-row-2">
                <div className={`ajm-field ${errors.title ? 'ajm-field-error' : ''}`}>
                  <label className="ajm-label">Job Title <span className="ajm-required">*</span></label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="ajm-input"
                    placeholder="e.g., Instructional Designer"
                    onFocus={() => setActiveSection('title')}
                    onBlur={() => setActiveSection(null)}
                  />
                  {errors.title && <span className="ajm-error-msg">{errors.title}</span>}
                </div>

                <div className={`ajm-field ${errors.department ? 'ajm-field-error' : ''}`}>
                  <label className="ajm-label">Department <span className="ajm-required">*</span></label>
                  <div className="ajm-select-wrap">
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                      className="ajm-select"
                    >
                      <option value="">Select Department</option>
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="ajm-select-icon" />
                  </div>
                  {errors.department && <span className="ajm-error-msg">{errors.department}</span>}
                </div>
              </div>

              <div className="ajm-row-3">
                <div className={`ajm-field ${errors.location ? 'ajm-field-error' : ''}`}>
                  <label className="ajm-label">
                    <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
                    Location <span className="ajm-required">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    className="ajm-input"
                    placeholder="e.g., Baner, Pune or Remote"
                  />
                  {errors.location && <span className="ajm-error-msg">{errors.location}</span>}
                </div>

                <div className="ajm-field">
                  <label className="ajm-label">Job Type</label>
                  <div className="ajm-type-pills">
                    {jobTypes.map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, jobType: type as any }))}
                        className={`ajm-pill ${formData.jobType === type ? 'ajm-pill-active' : ''}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`ajm-field ${errors.deadline ? 'ajm-field-error' : ''}`}>
                  <label className="ajm-label">
                    <Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />
                    Deadline <span className="ajm-required">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                    className="ajm-input"
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {errors.deadline && <span className="ajm-error-msg">{errors.deadline}</span>}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="ajm-divider" />

            {/* Section: Description */}
            <div className="ajm-section">
              <div className="ajm-section-label">
                <AlignLeft size={13} />
                <span>Job Description</span>
              </div>
              <div className={`ajm-field ${errors.description ? 'ajm-field-error' : ''}`}>
                <label className="ajm-label">Description <span className="ajm-required">*</span></label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="ajm-textarea"
                  placeholder="Describe the role, responsibilities, and what you're looking for..."
                />
                {errors.description && <span className="ajm-error-msg">{errors.description}</span>}
              </div>

              <div className="ajm-field">
                <label className="ajm-label">
                  <ListChecks size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Requirements <span className="ajm-hint">(one per line)</span>
                </label>
                <textarea
                  value={formData.requirements}
                  onChange={(e) => setFormData(prev => ({ ...prev, requirements: e.target.value }))}
                  rows={3}
                  className="ajm-textarea ajm-textarea-mono"
                  placeholder={"React experience\nTypeScript knowledge\n3+ years frontend development"}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="ajm-divider" />

            {/* Section: Portals */}
            <div className="ajm-section">
              <div className="ajm-section-label">
                <Globe size={13} />
                <span>Post on Job Portals</span>
                {formData.portals.length > 0 && (
                  <span className="ajm-portal-count">{formData.portals.length} selected</span>
                )}
              </div>
              <div className="ajm-portals-grid">
                {availablePortals.map(portal => (
                  <label key={portal} className={`ajm-portal-chip ${formData.portals.includes(portal) ? 'ajm-portal-chip-active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={formData.portals.includes(portal)}
                      onChange={() => handlePortalToggle(portal)}
                      className="ajm-portal-checkbox"
                    />
                    <span>{portal}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="ajm-footer">
              <button type="button" onClick={onClose} className="ajm-btn-cancel">
                Cancel
              </button>
              <button type="submit" className="ajm-btn-submit">
                {editingJob ? 'Update Job' : 'Post Job'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}