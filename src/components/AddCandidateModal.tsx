import React, { useState, useEffect } from 'react';
import { X, Upload, Plus, Trash2, FileText } from 'lucide-react';
import { JobPosting } from '../types';
import { filesAPI, candidatesAPI } from '../services/api';

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
    notes: '',
    stage: 'Applied',
    score: 0,
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
    inHouseAssignmentStatus: 'Draft',
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
  
  // State for managing individual notes
  const [individualNotes, setIndividualNotes] = useState<Array<{
    id?: number;
    text: string;
    isNew?: boolean;
  }>>([]);

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
        notes: '', // Clear the single notes field since we're using individual notes
        score: editingCandidate.score || 0,
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
                               editingCandidate.inHouseAssignmentStatus || 'Draft',
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

      // Populate individual notes from existing notes
      if (Array.isArray(editingCandidate.notes)) {
        setIndividualNotes(
          editingCandidate.notes.map((note: any) => ({
            id: note.id,
            text: note.notes || note,
            isNew: false
          }))
        );
      } else {
        setIndividualNotes([]);
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
        notes: '',
        score: 0,
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
        inHouseAssignmentStatus: 'Draft',
        interviewDate: '',
        interviewerId: null as number | null,
        inOfficeAssignment: '',
        // New location fields
        assignmentLocation: '',
        resumeLocation: ''
      });
      
      // Reset individual notes for new candidate
      setIndividualNotes([]);
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
    'On Hold',
    'Rejected',
    'No Show - Interview',
    'No Show - Onboarding'
  ];

  if (!isOpen) return null;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.jobId) newErrors.jobId = 'Job position is required';
    if (!formData.experience.trim()) newErrors.experience = 'Experience is required';

    // Email validation - support multiple emails separated by commas (only if provided)
    if (formData.email && formData.email.trim()) {
      const emails = formData.email.split(',').map(email => email.trim()).filter(Boolean);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      for (const email of emails) {
        if (!emailRegex.test(email)) {
          newErrors.email = 'Please enter valid email addresses (separate multiple emails with commas)';
          break;
        }
      }
    }

    setErrors(newErrors);
    return (Object.keys(newErrors)?.length || 0) === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const selectedJob = jobs.find(job => job.id === formData.jobId);
    
    const candidateData = {
      ...formData,
      position: selectedJob?.title || formData.position,
      skills: typeof formData.skills === 'string' 
        ? formData.skills.split(',').map(skill => skill.trim()).filter(Boolean)
        : Array.isArray(formData.skills) 
        ? formData.skills 
        : [],
      appliedDate: editingCandidate ? editingCandidate.appliedDate : new Date().toISOString(),
      score: formData.score || 0,
      assignedTo: editingCandidate ? (editingCandidate.assignedToId || 'Unassigned') : (selectedJob?.assignedTo[0] || 'Unassigned'),
      communications: [],
      resumeFileId: uploadedFile?.fileId || null,
      // Include individual notes
      // For existing candidates, only send newly added notes to avoid duplicating older notes
      notes: (editingCandidate
        ? individualNotes.filter(note => note.isNew && note.text.trim() !== '')
        : individualNotes.filter(note => note.text.trim() !== '')
      )
        .map(note => note.text)
        .join('\n\n'), // Combine notes with double newline
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
      notes: '',
      stage: 'Applied',
      score: 0,
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
      inHouseAssignmentStatus: 'Draft',
      interviewDate: '',
      interviewerId: null as number | null,
      inOfficeAssignment: '',
      // New location fields
      assignmentLocation: '',
      resumeLocation: ''
    });
    setErrors({});
    setUploadedFile(null);
    setIndividualNotes([]); // Reset individual notes
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

  // Handler functions for individual notes
  const handleNoteChange = (index: number, text: string) => {
    setIndividualNotes(prev => 
      prev.map((note, i) => 
        i === index ? { ...note, text } : note
      )
    );
  };

  const handleAddNote = () => {
    setIndividualNotes(prev => [
      ...prev,
      { text: '', isNew: true }
    ]);
  };

  const handleRemoveNote = async (index: number) => {
    const noteToRemove = individualNotes[index];

    // Optimistically remove from UI
    setIndividualNotes(prev => 
      prev.filter((_, i) => i !== index)
    );

    // If this is an existing note on an existing candidate, delete it in the backend
    if (editingCandidate && noteToRemove?.id && !noteToRemove.isNew) {
      try {
        await candidatesAPI.deleteCandidateNote(editingCandidate.id, noteToRemove.id);
      } catch (error) {
        console.error('Failed to delete candidate note:', error);
        // Optional: in a future enhancement, we could restore the note or show a toast
      }
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {editingCandidate ? (editingCandidate.id === 0 ? 'Add Candidate from Resume' : 'Edit Candidate') : 'Add New Candidate'}
            </h2>
            {editingCandidate?.id === 0 && (
              <p className="text-sm text-indigo-600 mt-1 flex items-center">
                <FileText size={16} className="mr-1" />
                Information extracted from resume - please review and edit as needed
              </p>
            )}
            <p className="text-sm text-gray-500 mt-1">Fields marked with * are required</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-8">
            {/* Personal Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center border-b pb-2">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-indigo-600 font-bold">1</span>
                </div>
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${
                      errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    placeholder="Enter candidate's full name"
                  />
                  {errors.name && <p className="text-red-500 text-sm mt-1 flex items-center"><span className="mr-1">⚠</span>{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${
                      errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    placeholder="candidate@email.com (separate multiple with commas)"
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1 flex items-center"><span className="mr-1">⚠</span>{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      const numericValue = handleNumericInput(e.target.value);
                      setFormData(prev => ({ ...prev, phone: numericValue }));
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                    placeholder="e.g., 1234567890"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Job Position <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.jobId}
                    onChange={(e) => handleJobChange(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${
                      errors.jobId ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <option value="">Select a job position</option>
                    {jobs.filter(job => job.status === 'Active').map(job => (
                      <option key={job.id} value={job.id}>
                        {job.title} - {job.department}
                      </option>
                    ))}
                  </select>
                  {errors.jobId && <p className="text-red-500 text-sm mt-1 flex items-center"><span className="mr-1">⚠</span>{errors.jobId}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Source
                  </label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                  >
                    {sources.map(source => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Current Stage
                  </label>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData(prev => ({ ...prev, stage: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                  >
                    {stages.map(stage => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Experience and Skills Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center border-b pb-2">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-purple-600 font-bold">2</span>
                </div>
                Professional Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Years of Experience <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.experience}
                    onChange={(e) => {
                      const numericValue = handleNumericInput(e.target.value, true);
                      setFormData(prev => ({ ...prev, experience: numericValue }));
                    }}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${
                      errors.experience ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    placeholder="e.g., 5.5"
                  />
                  {errors.experience && <p className="text-red-500 text-sm mt-1 flex items-center"><span className="mr-1">⚠</span>{errors.experience}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Resume/CV
                  </label>
                  
                  {uploadedFile ? (
                    <div className="border-2 border-green-300 bg-green-50 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <Upload size={18} className="text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{uploadedFile.originalName}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(uploadedFile.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="text-red-500 hover:text-red-700 hover:bg-red-100 p-2 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
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
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                          placeholder="Resume filename or URL"
                        />
                        <label className={`px-4 py-3 bg-indigo-100 text-indigo-600 rounded-xl transition-all cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-200'}`}>
                          {uploading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                          ) : (
                            <Upload size={20} />
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
                    <p className="text-red-500 text-sm mt-1 flex items-center"><span className="mr-1">⚠</span>{errors.resume}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Salary and Availability Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center border-b pb-2">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-green-600 font-bold">3</span>
                </div>
                Compensation & Availability
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Expected Salary (LPA)
                  </label>
                  <input
                    type="text"
                    value={formData.expectedSalary}
                    onChange={(e) => {
                      const lpaValue = handleLPAInput(e.target.value);
                      setFormData(prev => ({ ...prev, expectedSalary: lpaValue }));
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                    placeholder="e.g., 8 or 8.5 or 8LPA"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Offered Salary (LPA)
                  </label>
                  <input
                    type="text"
                    value={formData.offeredSalary}
                    onChange={(e) => {
                      const lpaValue = handleLPAInput(e.target.value);
                      setFormData(prev => ({ ...prev, offeredSalary: lpaValue }));
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                    placeholder="e.g., 9 or 9.5 or 9LPA"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Joining Time
                  </label>
                  <input
                    type="text"
                    value={formData.joiningTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, joiningTime: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                    placeholder="e.g., 2 weeks, 1 month"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Notice Period (days)
                  </label>
                  <input
                    type="text"
                    value={formData.noticePeriod}
                    onChange={(e) => {
                      const numericValue = handleNumericInput(e.target.value, true);
                      setFormData(prev => ({ ...prev, noticePeriod: numericValue }));
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                    placeholder="e.g., 30"
                  />
                </div>

                <div className="flex items-center space-x-3 bg-gray-50 p-4 rounded-xl">
                  <input
                    type="checkbox"
                    id="immediateJoiner"
                    checked={formData.immediateJoiner}
                    onChange={(e) => setFormData(prev => ({ ...prev, immediateJoiner: e.target.checked }))}
                    className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="immediateJoiner" className="text-sm font-medium text-gray-700">
                    Immediate Joiner
                  </label>
                </div>

                <div className="flex items-center space-x-3 bg-gray-50 p-4 rounded-xl">
                  <input
                    type="checkbox"
                    id="salaryNegotiable"
                    checked={formData.salaryNegotiable}
                    onChange={(e) => setFormData(prev => ({ ...prev, salaryNegotiable: e.target.checked }))}
                    className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="salaryNegotiable" className="text-sm font-medium text-gray-700">
                    Salary is negotiable
                  </label>
                </div>
              </div>
            </div>

            {/* Skills Section */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Skills (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.skills}
                  onChange={(e) => setFormData(prev => ({ ...prev, skills: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                  placeholder="React, TypeScript, Node.js, Python"
                />
              </div>
            </div>

            {/* Additional Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center border-b pb-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-blue-600 font-bold">4</span>
                </div>
                Additional Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                    placeholder="Current location"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Expertise
                  </label>
                  <input
                    type="text"
                    value={formData.expertise}
                    onChange={(e) => setFormData(prev => ({ ...prev, expertise: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                    placeholder="Primary expertise/domain"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Work Preference
                  </label>
                  <select
                    value={formData.workPreference}
                    onChange={(e) => setFormData(prev => ({ ...prev, workPreference: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                  >
                    <option value="">Select work preference</option>
                    <option value="Onsite">Onsite</option>
                    <option value="WFH">Work From Home</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Willing to work on Alternate Saturday
                  </label>
                  <select
                    value={formData.willingAlternateSaturday === null ? '' : formData.willingAlternateSaturday.toString()}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      willingAlternateSaturday: e.target.value === '' ? null : e.target.value === 'true' 
                    }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                  >
                    <option value="">Select</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Current CTC (LPA)
                  </label>
                  <input
                    type="text"
                    value={formData.currentCtc}
                    onChange={(e) => {
                      const lpaValue = handleLPAInput(e.target.value);
                      setFormData(prev => ({ ...prev, currentCtc: lpaValue }));
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                    placeholder="e.g., 7 or 7.5 or 7LPA"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    CTC Frequency
                  </label>
                  <select
                    value={formData.ctcFrequency}
                    onChange={(e) => setFormData(prev => ({ ...prev, ctcFrequency: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                  >
                    <option value="Annual">Annual</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    In House Assignment Status
                  </label>
                  <select
                    value={formData.inHouseAssignmentStatus}
                    onChange={(e) => setFormData(prev => ({ ...prev, inHouseAssignmentStatus: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
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

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Interview Date
                  </label>
                  <input
                    type="date"
                    value={formData.interviewDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, interviewDate: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    In Office Assignment
                  </label>
                  <textarea
                    value={formData.inOfficeAssignment}
                    onChange={(e) => setFormData(prev => ({ ...prev, inOfficeAssignment: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                    placeholder="Details about in-office assignment..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Assignment Location/Link
                  </label>
                  <input
                    type="text"
                    value={formData.assignmentLocation}
                    onChange={(e) => setFormData(prev => ({ ...prev, assignmentLocation: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                    placeholder="File path or URL to assignment file"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Resume Location/Link
                  </label>
                  <input
                    type="text"
                    value={formData.resumeLocation}
                    onChange={(e) => setFormData(prev => ({ ...prev, resumeLocation: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                    placeholder="File path or URL to resume file"
                  />
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center border-b pb-2">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-amber-600 font-bold">5</span>
                </div>
                Notes
              </h3>
              <div className="space-y-3">
                {individualNotes.map((note, index) => (
                  <div key={index} className="flex gap-2">
                    <textarea
                      value={note.text}
                      onChange={(e) => handleNoteChange(index, e.target.value)}
                      rows={3}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-400 transition-all"
                      placeholder="Enter note..."
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveNote(index)}
                      className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-xl transition-all"
                      title="Remove note"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddNote}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all flex items-center justify-center space-x-2"
                >
                  <Plus size={18} />
                  <span className="font-medium">Add Note</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-100 hover:border-gray-400 transition-all font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center space-x-2 shadow-lg hover:shadow-xl font-medium"
            >
              <Plus size={18} />
              <span>{editingCandidate ? 'Update Candidate' : 'Add Candidate'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}