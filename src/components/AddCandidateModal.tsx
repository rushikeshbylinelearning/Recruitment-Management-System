import React, { useState, useEffect } from 'react';
import { X, Upload, Plus, Trash2, FileText, Loader } from 'lucide-react';
import { JobPosting } from '../types';
import { filesAPI } from '../services/api';
import { parseResume, ParsedCandidateData } from '../utils/resumeParser';

interface AddCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (candidateData: any) => void;
  jobs: JobPosting[];
  editingCandidate?: any;
}

export default function AddCandidateModal({ isOpen, onClose, onSubmit, jobs, editingCandidate }: AddCandidateModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    jobId: jobs.length > 0 ? jobs[0].id : 0,
    source: 'Manual Entry',
    resume: '',
    experience: '',
    skills: '',
    stage: 'Applied',
    expectedSalary: '',
    offeredSalary: '',
    salaryNegotiable: true,
    joiningTime: '',
    noticePeriod: '',
    immediateJoiner: false,
    // New fields
    location: '',
    expertise: '',
    willingAlternateSaturday: null as boolean | null,
    workPreference: '',
    currentCtc: '',
    ctcFrequency: 'Annual',
    inHouseAssignmentStatus: 'Pending',
    interviewDate: '',
    interviewerId: null as number | null,
    inOfficeAssignment: '',
    // New location fields
    assignmentLocation: '',
    resumeLocation: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadedFile, setUploadedFile] = useState<{
    fileId: string;
    originalName: string;
    size: number;
  } | null>(null);

  // Helper function to handle numeric input
  const handleNumericInput = (value: string, allowDecimals: boolean = false) => {
    // Remove all non-numeric characters except decimal point if allowed
    let cleaned = value.replace(/[^0-9.]/g, '');
    
    if (allowDecimals) {
      // Ensure only one decimal point
      const parts = cleaned.split('.');
      if (parts.length > 2) {
        cleaned = parts[0] + '.' + parts.slice(1).join('');
      }
    } else {
      // Remove decimal points if not allowed
      cleaned = cleaned.replace(/\./g, '');
    }
    
    return cleaned;
  };

  const handleLPAInput = (value: string) => {
    // Allow numbers, decimal point, and LPA text (case insensitive)
    let cleaned = value.replace(/[^0-9.LPA]/gi, '');
    
    // Convert to uppercase for consistency
    cleaned = cleaned.toUpperCase();
    
    // If the value is empty or just whitespace, return empty string
    if (!cleaned.trim()) {
      return '';
    }
    
    // If user is typing and it's just numbers (no LPA yet), don't auto-add LPA
    // This allows users to edit the number part freely
    if (/^[0-9]+\.?[0-9]*$/.test(cleaned)) {
      return cleaned; // Return as-is, let user decide when to add LPA
    }
    
    // If LPA is present, ensure it's at the end and only once
    const lpaIndex = cleaned.indexOf('LPA');
    if (lpaIndex !== -1) {
      // Remove any LPA that's not at the end
      const beforeLPA = cleaned.substring(0, lpaIndex);
      const afterLPA = cleaned.substring(lpaIndex + 3);
      
      // Only keep the first LPA and put it at the end
      cleaned = beforeLPA + afterLPA + 'LPA';
    }
    
    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    
    return cleaned;
  };

  const [uploading, setUploading] = useState(false);
  const [parsingResume, setParsingResume] = useState(false);
  const [parseError, setParseError] = useState<string>('');

  // Populate form when editing
  useEffect(() => {
    if (editingCandidate) {
      setFormData({
        name: editingCandidate.name || '',
        email: editingCandidate.email || '',
        phone: editingCandidate.phone || '',
        position: editingCandidate.position || '',
        jobId: editingCandidate.jobId || (jobs.length > 0 ? jobs[0].id : 0),
        source: editingCandidate.source || 'Manual Entry',
        stage: editingCandidate.stage || 'Applied',
        skills: Array.isArray(editingCandidate.skills) 
          ? editingCandidate.skills.join(', ') 
          : (editingCandidate.skills || ''),
        experience: editingCandidate.experience || '',
        expectedSalary: editingCandidate.salary?.expected || '',
        offeredSalary: editingCandidate.salary?.offered || '',
        salaryNegotiable: editingCandidate.salary?.negotiable || false,
        joiningTime: editingCandidate.availability?.joiningTime || '',
        noticePeriod: editingCandidate.availability?.noticePeriod || '',
        immediateJoiner: editingCandidate.availability?.immediateJoiner || false,
        resume: editingCandidate.resume || '',
        // New fields - handle both structured and flat data
        location: editingCandidate.location || '',
        expertise: editingCandidate.expertise || '',
        willingAlternateSaturday: editingCandidate.workPreferences?.willingAlternateSaturday !== undefined ? 
                                 editingCandidate.workPreferences.willingAlternateSaturday :
                                 editingCandidate.willingAlternateSaturday !== undefined ? 
                                 editingCandidate.willingAlternateSaturday : null,
        workPreference: editingCandidate.workPreferences?.workPreference || 
                       editingCandidate.workPreference || '',
        currentCtc: editingCandidate.workPreferences?.currentCtc || 
                   editingCandidate.currentCtc || '',
        ctcFrequency: editingCandidate.workPreferences?.ctcFrequency || 
                     editingCandidate.ctcFrequency || 'Annual',
        inHouseAssignmentStatus: editingCandidate.assignmentDetails?.inHouseAssignmentStatus || 
                               editingCandidate.inHouseAssignmentStatus || 'Pending',
        interviewDate: editingCandidate.assignmentDetails?.interviewDate ? 
                      new Date(editingCandidate.assignmentDetails.interviewDate).toISOString().split('T')[0] :
                      editingCandidate.interviewDate ? 
                      new Date(editingCandidate.interviewDate).toISOString().split('T')[0] : '',
        interviewerId: editingCandidate.assignmentDetails?.interviewerId || 
                      editingCandidate.interviewerId || null,
        inOfficeAssignment: editingCandidate.assignmentDetails?.inOfficeAssignment || 
                           editingCandidate.inOfficeAssignment || '',
        // New location fields
        assignmentLocation: editingCandidate.assignmentLocation || '',
        resumeLocation: editingCandidate.resumeLocation || ''
      });

      // Set uploaded file if exists
      if (editingCandidate.resumeFileId) {
        setUploadedFile({
          fileId: editingCandidate.resumeFileId,
          originalName: editingCandidate.resume || 'Resume',
          size: 0 // We don't have size info in the candidate object
        });
      }
    } else {
      // Reset form for new candidate
      setFormData({
        name: '',
        email: '',
        phone: '',
        position: '',
        jobId: jobs.length > 0 ? jobs[0].id : 0,
        source: 'Manual Entry',
        stage: 'Applied',
        skills: '',
        experience: '',
        expectedSalary: '',
        offeredSalary: '',
        salaryNegotiable: false,
        joiningTime: '',
        noticePeriod: '',
        immediateJoiner: false,
        resume: '',
        // New fields
        location: '',
        expertise: '',
        willingAlternateSaturday: null as boolean | null,
        workPreference: '',
        currentCtc: '',
        ctcFrequency: 'Annual',
        inHouseAssignmentStatus: 'Pending',
        interviewDate: '',
        interviewerId: null as number | null,
        inOfficeAssignment: '',
        // New location fields
        assignmentLocation: '',
        resumeLocation: ''
      });
      setUploadedFile(null);
    }
  }, [editingCandidate, jobs]);

  const sources = [
    'Manual Entry',
    'LinkedIn',
    'Indeed',
    'Naukri.com',
    'Company Website',
    'Referral',
    'Glassdoor',
    'AngelList',
    'Monster.com',
    'CareerBuilder'
  ];

  const stages = [
    'Applied',
    'Screening',
    'Interview',
    'Offer',
    'Hired',
    'Rejected'
  ];

  if (!isOpen) return null;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
    if (!formData.jobId) newErrors.jobId = 'Job position is required';
    if (!formData.experience.trim()) newErrors.experience = 'Experience is required';

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return (Object.keys(newErrors)?.length || 0) === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const selectedJob = jobs.find(job => job.id === formData.jobId);
    
    // Notes and score are now handled by the new notes/ratings system
    // No need to remove them as they're not in the formData anymore
    
    const candidateData = {
      ...formData,
      position: selectedJob?.title || formData.position,
      skills: formData.skills.split(',').map(skill => skill.trim()).filter(Boolean),
      appliedDate: editingCandidate ? editingCandidate.appliedDate : new Date().toISOString(),
      assignedTo: editingCandidate ? editingCandidate.assignedTo : (selectedJob?.assignedTo[0] || 'Unassigned'),
      communications: [],
      resumeFileId: uploadedFile?.fileId || null,
      // Send salary fields as flat fields for backend compatibility
      salaryExpected: formData.expectedSalary,
      salaryOffered: formData.offeredSalary,
      salaryNegotiable: formData.salaryNegotiable,
      // Send availability fields as flat fields for backend compatibility
      joiningTime: formData.joiningTime,
      noticePeriod: formData.noticePeriod,
      immediateJoiner: formData.immediateJoiner,
      // Send new fields as flat fields for backend compatibility
      location: formData.location,
      expertise: formData.expertise,
      willingAlternateSaturday: formData.willingAlternateSaturday,
      workPreference: formData.workPreference,
      currentCtc: formData.currentCtc,
      ctcFrequency: formData.ctcFrequency,
      inHouseAssignmentStatus: formData.inHouseAssignmentStatus,
      interviewDate: formData.interviewDate,
      interviewerId: formData.interviewerId,
      inOfficeAssignment: formData.inOfficeAssignment,
      // New location fields
      assignmentLocation: formData.assignmentLocation,
      resumeLocation: formData.resumeLocation,
      interviews: []
    };

    onSubmit(candidateData);
    
    // Reset form
    setFormData({
      name: '',
      email: '',
      phone: '',
      position: '',
      jobId: jobs.length > 0 ? jobs[0].id : 0,
      source: 'Manual Entry',
      resume: '',
      experience: '',
      skills: '',
      stage: 'Applied',
      expectedSalary: '',
      offeredSalary: '',
      salaryNegotiable: true,
      joiningTime: '',
      noticePeriod: '',
      immediateJoiner: false,
      // New fields
      location: '',
      expertise: '',
      willingAlternateSaturday: null as boolean | null,
      workPreference: '',
      currentCtc: '',
      ctcFrequency: 'Annual',
      inHouseAssignmentStatus: 'Pending',
      interviewDate: '',
      interviewerId: null as number | null,
      inOfficeAssignment: '',
      // New location fields
      assignmentLocation: '',
      resumeLocation: ''
    });
    setErrors({});
    setUploadedFile(null);
    onClose();
  };

  const handleJobChange = (jobId: string) => {
    const selectedJob = jobs.find(job => job.id.toString() === jobId);
    setFormData(prev => ({
      ...prev,
      jobId: parseInt(jobId),
      position: selectedJob?.title || ''
    }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setErrors(prev => ({ ...prev, resume: '' }));

      // Upload file to backend
      const response = await filesAPI.uploadFile(file);
      
      if (response.success && response.data) {
        setUploadedFile({
          fileId: response.data.fileId,
          originalName: response.data.originalName,
          size: response.data.size
        });
        
        setFormData(prev => ({
          ...prev,
          resume: response.data!.originalName
        }));
      } else {
        setErrors(prev => ({ ...prev, resume: 'Failed to upload file' }));
      }
    } catch (error) {
      console.error('File upload error:', error);
      setErrors(prev => ({ ...prev, resume: 'Failed to upload file' }));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setFormData(prev => ({
      ...prev,
      resume: ''
    }));
  };

  const handleParseResume = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      setParseError('Please select a PDF, Word document, or text file.');
      return;
    }

    try {
      setParsingResume(true);
      setParseError('');
      
      // Parse the resume
      const parsedData: ParsedCandidateData = await parseResume(file);
      
      // Update form data with parsed information
      setFormData(prev => ({
        ...prev,
        name: parsedData.name || prev.name,
        email: parsedData.email || prev.email,
        phone: parsedData.phone || prev.phone,
        location: parsedData.location || prev.location,
        experience: parsedData.experience || prev.experience,
        skills: parsedData.skills ? parsedData.skills.join(', ') : prev.skills,
        expertise: parsedData.expertise || prev.expertise,
        expectedSalary: parsedData.expectedSalary || prev.expectedSalary,
        currentCtc: parsedData.currentCtc || prev.currentCtc,
        noticePeriod: parsedData.noticePeriod || prev.noticePeriod,
        immediateJoiner: parsedData.immediateJoiner !== undefined ? parsedData.immediateJoiner : prev.immediateJoiner,
        workPreference: parsedData.workPreference || prev.workPreference,
        willingAlternateSaturday: parsedData.willingAlternateSaturday !== undefined ? parsedData.willingAlternateSaturday : prev.willingAlternateSaturday,
        // Notes will be handled through the new notes system after candidate creation
      }));
      
      // Also upload the file
      await handleFileUpload(event);
      
    } catch (error) {
      console.error('Resume parsing error:', error);
      setParseError(error instanceof Error ? error.message : 'Failed to parse resume');
    } finally {
      setParsingResume(false);
      // Reset the file input
      event.target.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {editingCandidate ? (editingCandidate.id === 0 ? 'Add Candidate from Resume' : 'Edit Candidate') : 'Add New Candidate'}
            </h2>
            {editingCandidate?.id === 0 && (
              <p className="text-sm text-blue-600 mt-1 flex items-center">
                <FileText size={16} className="mr-1" />
                Information extracted from resume - please review and edit as needed
              </p>
            )}
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
            {/* Personal Information */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter candidate's full name"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.email ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="candidate@email.com"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  const numericValue = handleNumericInput(e.target.value);
                  setFormData(prev => ({ ...prev, phone: numericValue }));
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.phone ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g., 1234567890"
              />
              {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Position *
              </label>
              <select
                value={formData.jobId}
                onChange={(e) => handleJobChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.jobId ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select a job position</option>
                {jobs.filter(job => job.status === 'Active').map(job => (
                  <option key={job.id} value={job.id}>
                    {job.title} - {job.department}
                  </option>
                ))}
              </select>
              {errors.jobId && <p className="text-red-500 text-sm mt-1">{errors.jobId}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source
              </label>
              <select
                value={formData.source}
                onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {sources.map(source => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Stage
              </label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData(prev => ({ ...prev, stage: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {stages.map(stage => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Experience and Skills */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Years of Experience *
              </label>
              <input
                type="text"
                value={formData.experience}
                onChange={(e) => {
                  const numericValue = handleNumericInput(e.target.value, true);
                  setFormData(prev => ({ ...prev, experience: numericValue }));
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.experience ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="e.g., 5.5"
              />
              {errors.experience && <p className="text-red-500 text-sm mt-1">{errors.experience}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resume/CV
              </label>
              
              {uploadedFile ? (
                <div className="border border-green-200 bg-green-50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <Upload size={16} className="text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{uploadedFile.originalName}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(uploadedFile.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={formData.resume}
                      onChange={(e) => setFormData(prev => ({ ...prev, resume: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Resume filename or URL"
                    />
                    <label className={`px-3 py-2 bg-gray-100 text-gray-600 rounded-lg transition-colors cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200'}`}>
                      {uploading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                      ) : (
                        <Upload size={16} />
                      )}
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                  </div>
                </div>
              )}
              
              {errors.resume && (
                <p className="text-red-500 text-sm mt-1">{errors.resume}</p>
              )}
              
              {parseError && (
                <p className="text-red-500 text-sm mt-1">{parseError}</p>
              )}
            </div>
          </div>

          {/* Salary and Availability */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expected Salary (LPA)
              </label>
              <input
                type="text"
                value={formData.expectedSalary}
                onChange={(e) => {
                  const lpaValue = handleLPAInput(e.target.value);
                  setFormData(prev => ({ ...prev, expectedSalary: lpaValue }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 8 or 8.5 or 8LPA"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Offered Salary (LPA)
              </label>
              <input
                type="text"
                value={formData.offeredSalary}
                onChange={(e) => {
                  const lpaValue = handleLPAInput(e.target.value);
                  setFormData(prev => ({ ...prev, offeredSalary: lpaValue }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 9 or 9.5 or 9LPA"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Joining Time
              </label>
              <input
                type="text"
                value={formData.joiningTime}
                onChange={(e) => setFormData(prev => ({ ...prev, joiningTime: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 2 weeks, 1 month"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notice Period
              </label>
              <input
                type="text"
                value={formData.noticePeriod}
                onChange={(e) => {
                  const numericValue = handleNumericInput(e.target.value, true);
                  setFormData(prev => ({ ...prev, noticePeriod: numericValue }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 30"
              />
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="immediateJoiner"
                checked={formData.immediateJoiner}
                onChange={(e) => setFormData(prev => ({ ...prev, immediateJoiner: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="immediateJoiner" className="text-sm text-gray-700">
                Immediate Joiner
              </label>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="salaryNegotiable"
              checked={formData.salaryNegotiable}
              onChange={(e) => setFormData(prev => ({ ...prev, salaryNegotiable: e.target.checked }))}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="salaryNegotiable" className="text-sm text-gray-700">
              Salary is negotiable
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Skills (comma-separated)
            </label>
            <input
              type="text"
              value={formData.skills}
              onChange={(e) => setFormData(prev => ({ ...prev, skills: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="React, TypeScript, Node.js, Python"
            />
          </div>

          {/* New Fields Section */}
          <div className="col-span-2">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Current location"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expertise
            </label>
            <input
              type="text"
              value={formData.expertise}
              onChange={(e) => setFormData(prev => ({ ...prev, expertise: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Primary expertise/domain"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Work Preference
            </label>
            <select
              value={formData.workPreference}
              onChange={(e) => setFormData(prev => ({ ...prev, workPreference: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select work preference</option>
              <option value="Onsite">Onsite</option>
              <option value="WFH">Work From Home</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Willing to work on Alternate Saturday
            </label>
            <select
              value={formData.willingAlternateSaturday === null ? '' : formData.willingAlternateSaturday.toString()}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                willingAlternateSaturday: e.target.value === '' ? null : e.target.value === 'true' 
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current CTC (LPA)
            </label>
            <input
              type="text"
              value={formData.currentCtc}
              onChange={(e) => {
                const lpaValue = handleLPAInput(e.target.value);
                setFormData(prev => ({ ...prev, currentCtc: lpaValue }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 7 or 7.5 or 7LPA"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CTC Frequency
            </label>
            <select
              value={formData.ctcFrequency}
              onChange={(e) => setFormData(prev => ({ ...prev, ctcFrequency: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Annual">Annual</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              In House Assignment Status
            </label>
            <select
              value={formData.inHouseAssignmentStatus}
              onChange={(e) => setFormData(prev => ({ ...prev, inHouseAssignmentStatus: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Pending">Pending</option>
              <option value="Shortlisted">Shortlisted</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Interview Date
            </label>
            <input
              type="date"
              value={formData.interviewDate}
              onChange={(e) => setFormData(prev => ({ ...prev, interviewDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              In Office Assignment
            </label>
            <textarea
              value={formData.inOfficeAssignment}
              onChange={(e) => setFormData(prev => ({ ...prev, inOfficeAssignment: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Details about in-office assignment..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assignment Location/Link
            </label>
            <input
              type="text"
              value={formData.assignmentLocation}
              onChange={(e) => setFormData(prev => ({ ...prev, assignmentLocation: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="File path or URL to assignment file"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resume Location/Link
            </label>
            <input
              type="text"
              value={formData.resumeLocation}
              onChange={(e) => setFormData(prev => ({ ...prev, resumeLocation: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="File path or URL to resume file"
            />
          </div>

          {/* Notes are now handled through the new multi-user notes system after candidate creation */}

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
              <span>{editingCandidate ? 'Edit Candidate' : 'Add Candidate'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}