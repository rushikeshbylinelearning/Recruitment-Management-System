import axios, { AxiosResponse, AxiosError } from 'axios';

// API Base Configuration
// - In development, VITE_API_URL=/api (set in .env.development) and the Vite dev-server proxy
//   (vite.config.ts) forwards `/api` → localhost:5000.
// - In production builds, VITE_API_URL=https://hr.bylinelms.com/api (set in .env.production).
// - Safety fallback: if VITE_API_URL is somehow not set, default to localhost:3001 for local dev.
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Debug log — remove before final production release if desired
if (import.meta.env.DEV) {
  console.log('API BASE URL:', API_BASE_URL);
}

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // Increased to 60 seconds for large data loads
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any[];
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  jobs: T[];
  pagination: PaginationInfo;
  /** Aggregated applicant totals keyed by fixed dashboard job card title */
  jobCardApplicantTotals?: Record<string, number>;
}

export interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Authentication API
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    username: string;
    email: string;
    name: string;
    role: string;
    permissions: Array<{
      module: string;
      actions: string[];
    }>;
    interviewerProfile?: any;
  };
  token: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  role: 'Admin' | 'Recruiter' | 'Interviewer' | 'Team Lead' | 'HR Intern';
  avatar?: string | null;
  status: 'Active' | 'Away' | 'Busy';
  last_login?: string | null;
  created_at: string;
  updated_at: string;
  permissions: Array<{
    module: string;
    actions: string[];
  }>;
  interviewerProfile?: any;
  statistics?: {
    tasks_completed: number;
    assigned_jobs: number;
  };
  // Legacy properties for backward compatibility
  tasksCompleted?: number;
  candidatesProcessed?: number;
  assignedJobs?: any[];
}

// Auth API functions
export const authAPI = {
  login: async (credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  logout: async (): Promise<ApiResponse> => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  getProfile: async (): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  updateProfile: async (profileData: Partial<User>): Promise<ApiResponse> => {
    const response = await api.put('/auth/profile', profileData);
    return response.data;
  },

  changePassword: async (passwordData: {
    currentPassword: string;
    newPassword: string;
  }): Promise<ApiResponse> => {
    const response = await api.post('/auth/change-password', passwordData);
    return response.data;
  },

  verifyToken: async (): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.get('/auth/verify');
    return response.data;
  },
};

// Users API
export const usersAPI = {
  getUsers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ApiResponse<UsersResponse>> => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  getUserById: async (id: number): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  updateUser: async (id: number, userData: Partial<User> & { password?: string }): Promise<ApiResponse> => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },

  deleteUser: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  createUser: async (userData: {
    username: string;
    email: string;
    name: string;
    password: string;
    role: string;
    avatar?: string;
    status?: string;
  }): Promise<ApiResponse<{ userId: number }>> => {
    const response = await api.post('/users', userData);
    return response.data;
  },

  updateUserPermissions: async (userId: number, permissions: Array<{
    module: string;
    actions: string[];
  }>): Promise<ApiResponse> => {
    const response = await api.put(`/users/${userId}/permissions`, { permissions });
    return response.data;
  },

  getRolePermissions: async (): Promise<ApiResponse<{
    rolePermissions: Record<string, Array<{
      module: string;
      actions: string[];
    }>>;
  }>> => {
    const response = await api.get('/settings/role-permissions');
    return response.data;
  },

  updateRolePermissions: async (rolePermissions: Record<string, Array<{
    module: string;
    actions: string[];
  }>>): Promise<ApiResponse> => {
    const response = await api.put('/settings/role-permissions', { rolePermissions });
    return response.data;
  },
};

// Communications API
export const communicationsAPI = {
  getCommunications: async (params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    candidateId?: string;
  }): Promise<ApiResponse<{
    communications: Array<{
      id: number;
      candidateId: string;
      candidateName: string;
      candidatePosition: string;
      type: string;
      content: string;
      status: string;
      date: string;
      createdBy: number;
      createdByName: string;
      followUpDate?: string;
      followUpNotes?: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }>> => {
    const response = await api.get('/communications', { params });
    return response.data;
  },

  getCommunicationById: async (id: number): Promise<ApiResponse<{
    communication: any;
  }>> => {
    const response = await api.get(`/communications/${id}`);
    return response.data;
  },

  createCommunication: async (communicationData: {
    candidateId: string;
    type: string;
    content: string;
    status?: string;
    followUpDate?: string;
    followUpNotes?: string;
  }): Promise<ApiResponse<{ communicationId: number }>> => {
    const response = await api.post('/communications', communicationData);
    return response.data;
  },

  updateCommunication: async (id: number, communicationData: Partial<{
    type: string;
    content: string;
    status: string;
    followUpDate?: string;
    followUpNotes?: string;
  }>): Promise<ApiResponse> => {
    const response = await api.put(`/communications/${id}`, communicationData);
    return response.data;
  },

  deleteCommunication: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete(`/communications/${id}`);
    return response.data;
  },

  getCommunicationStats: async (): Promise<ApiResponse<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    recent: number;
  }>> => {
    const response = await api.get('/communications/stats');
    return response.data;
  },
};

// Email Templates API
export const emailTemplatesAPI = {
  getEmailTemplates: async (params?: {
    page?: number;
    limit?: number;
    category?: string;
  }): Promise<ApiResponse<{
    templates: Array<{
      id: number;
      name: string;
      subject: string;
      content: string;
      category: string;
      isActive: boolean;
      createdBy: number;
      createdByName: string;
      createdAt: string;
      updatedAt: string;
      variables: string[];
    }>;
    total: number;
    page: number;
    limit: number;
  }>> => {
    const response = await api.get('/email-templates', { params });
    return response.data;
  },

  getEmailTemplateById: async (id: number): Promise<ApiResponse<{
    template: any;
  }>> => {
    const response = await api.get(`/email-templates/${id}`);
    return response.data;
  },

  createEmailTemplate: async (templateData: {
    name: string;
    subject: string;
    content: string;
    category: string;
    variables?: string[];
  }): Promise<ApiResponse<{ templateId: number }>> => {
    const response = await api.post('/email-templates', templateData);
    return response.data;
  },

  updateEmailTemplate: async (id: number, templateData: Partial<{
    name: string;
    subject: string;
    content: string;
    category: string;
    isActive: boolean;
    variables: string[];
  }>): Promise<ApiResponse> => {
    const response = await api.put(`/email-templates/${id}`, templateData);
    return response.data;
  },

  deleteEmailTemplate: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete(`/email-templates/${id}`);
    return response.data;
  },

  sendEmailTemplate: async (templateId: number, candidateIds: string[], customData?: Record<string, any>): Promise<ApiResponse<{
    sent: number;
    failed: number;
    results: Array<{
      candidateId: string;
      candidateName: string;
      success: boolean;
      error?: string;
    }>;
  }>> => {
    const response = await api.post(`/email-templates/${templateId}/send`, {
      candidateIds,
      customData
    });
    return response.data;
  },

  getTemplateCategories: async (): Promise<ApiResponse<{
    categories: Array<{
      name: string;
      count: number;
    }>;
  }>> => {
    const response = await api.get('/email-templates/categories');
    return response.data;
  },

  getTemplateVariables: async (): Promise<ApiResponse<{
    variables: Array<{
      name: string;
      description: string;
      example: string;
    }>;
  }>> => {
    const response = await api.get('/email-templates/variables');
    return response.data;
  },
};

// Jobs API
export interface JobPosting {
  id: number;
  title: string;
  department: string;
  location: string;
  jobType: 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
  status: 'Active' | 'Paused' | 'Closed';
  postedDate: string;
  deadline: string;
  description: string;
  requirements: string[];
  portals: JobPortal[];
  applicantCount: number;
  assignedTo: string[];
}

export interface JobPortal {
  name: string;
  url: string;
  status: 'Posted' | 'Draft' | 'Expired';
  applicants: number;
}

export const jobsAPI = {
  getJobs: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<ApiResponse<PaginatedResponse<JobPosting>>> => {
    const response = await api.get('/jobs', { params });
    return response.data;
  },

  getJobById: async (id: number): Promise<ApiResponse<{ job: JobPosting }>> => {
    const response = await api.get(`/jobs/${id}`);
    return response.data;
  },

  createJob: async (jobData: Omit<JobPosting, 'id'>): Promise<ApiResponse<{ jobId: number }>> => {
    const response = await api.post('/jobs', jobData);
    return response.data;
  },

  updateJob: async (id: number, jobData: Partial<JobPosting>): Promise<ApiResponse> => {
    const response = await api.put(`/jobs/${id}`, jobData);
    return response.data;
  },

  deleteJob: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete(`/jobs/${id}`);
    return response.data;
  },
};

// Candidates API
export interface Candidate {
  id: string; // UUID
  name: string;
  email: string;
  phone: string;
  position: string;
  stage: 'Applied' | 'Follow Up' | 'Screening' | 'Interview' | 'Offer' | 'Hired' | 'On Hold' | 'Rejected' | 'No Show - Interview' | 'No Show - Onboarding' | 'Last Minute Back Out' | 'Profile Not Matched';
  source: string;
  appliedDate: string;
  resume: string;
  notes: string;
  score: number;
  assignedTo: string;
  assignedToId?: number | null; // Added for form submission
  communications: Communication[];
  skills: string[];
  experience: string;
  location?: string;
  expertise?: string;
  salary: {
    expected: string;
    offered?: string;
    negotiable: boolean;
  };
  availability: {
    joiningTime: string;
    noticePeriod: string;
    immediateJoiner: boolean;
  };
  workPreferences: {
    workPreference?: 'Onsite' | 'WFH' | 'Hybrid';
    willingAlternateSaturday?: boolean;
    currentCtc?: string;
    ctcFrequency?: 'Monthly' | 'Annual';
  };
  assignmentDetails: {
    inHouseAssignmentStatus?: 'Pending' | 'Shortlisted' | 'Rejected';
    interviewDate?: string;
    interviewerId?: number;
    inOfficeAssignment?: string;
  };
  assignmentLocation?: string;
  resumeLocation?: string;
  interviews: Interview[];
  latestInterviewDate?: string; // Added for Interview stage sorting
  job_id?: number; // Added for job filtering
}

export interface Communication {
  id: number;
  type: 'Email' | 'Phone' | 'WhatsApp' | 'LinkedIn';
  date: string;
  content: string;
  status: 'Sent' | 'Received' | 'Pending';
  followUp?: string;
}

export interface Interview {
  id: number;
  candidateId: string;
  interviewerId: string;
  interviewerName: string;
  scheduledDate: string;
  duration: number;
  type: 'Technical' | 'HR' | 'Managerial' | 'Final';
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'Rescheduled';
  meetingLink?: string;
  location?: string;
  round: number;
}

export interface CandidateExportParams {
  search?: string;
  stage?: string[];
  role?: string;
  location?: string;
  source?: string;
  minExperience?: string;
  maxExperience?: string;
  minCTC?: string;
  maxCTC?: string;
  startDate?: string;
  endDate?: string;
  appliedDateFrom?: string;
  appliedDateTo?: string;
  format: 'excel' | 'pdf';
}

export const candidatesAPI = {
  getCandidates: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    stage?: string;
    source?: string;
  }): Promise<ApiResponse<{ candidates: Candidate[]; pagination: PaginationInfo }>> => {
    const response = await api.get('/candidates', { params });
    return response.data;
  },

  getCandidateById: async (id: string): Promise<ApiResponse<{ candidate: Candidate }>> => {
    const response = await api.get(`/candidates/${id}`);
    return response.data;
  },

  createCandidate: async (candidateData: Omit<Candidate, 'id' | 'communications' | 'interviews'>): Promise<ApiResponse<{ candidateId: string }>> => {
    const response = await api.post('/candidates', candidateData);
    return response.data;
  },

  updateCandidate: async (id: string, candidateData: Partial<Candidate>): Promise<ApiResponse> => {
    const response = await api.put(`/candidates/${id}`, candidateData);
    return response.data;
  },

  updateCandidatePartial: async (id: string, candidateData: Partial<Candidate>): Promise<ApiResponse> => {
    const response = await api.patch(`/candidates/${id}`, candidateData);
    return response.data;
  },

  deleteCandidate: async (id: string): Promise<ApiResponse> => {
    const response = await api.delete(`/candidates/${id}`);
    return response.data;
  },

  bulkDeleteCandidates: async (ids: string[]): Promise<ApiResponse<{ deletedCount: number }>> => {
    const response = await api.post('/candidates/bulk-delete', { ids });
    return response.data;
  },

  bulkImportCandidates: async (candidates: Omit<Candidate, 'id' | 'communications' | 'interviews'>[]): Promise<ApiResponse<{ results: any[], errors: any[] }>> => {
    const response = await api.post('/candidates/bulk-import', { candidates });
    return response.data;
  },

  updateCandidateStage: async (id: string, stage: string, notes?: string): Promise<ApiResponse> => {
    const response = await api.patch(`/candidates/${id}/stage`, { stage, notes });
    return response.data;
  },

  downloadResume: async (candidateId: string): Promise<Blob> => {
    const response = await api.get(`/candidates/${candidateId}/resume`, {
      responseType: 'blob'
    });
    return response.data;
  },

  getResumeMetadata: async (candidateId: string): Promise<ApiResponse<any>> => {
    const response = await api.get(`/candidates/${candidateId}/resume/metadata`);
    return response.data;
  },

  addCandidateNote: async (candidateId: string, noteData: {
    notes?: string;
    rating?: number;
    ratingComments?: string;
    recommendation?: string;
  }): Promise<ApiResponse> => {
    const response = await api.post(`/candidates/${candidateId}/notes`, noteData);
    return response.data;
  },

  addInterviewNote: async (candidateId: string, noteData: {
    notes?: string;
    recommendation?: string;
  }): Promise<ApiResponse> => {
    const response = await api.post(`/candidates/${candidateId}/interview-notes`, noteData);
    return response.data;
  },

  getCandidateNotes: async (candidateId: string): Promise<ApiResponse<{
    notes: Array<{
      id: number;
      candidate_id: string;
      user_id: number;
      notes: string | null;
      rating: number | null;
      rating_comments: string | null;
      created_at: string;
      updated_at: string;
      user_name: string;
      user_role: string;
    }>;
  }>> => {
    const response = await api.get(`/candidates/${candidateId}/notes`);
    return response.data;
  },

  // Delete a specific note for a candidate
  deleteCandidateNote: async (candidateId: string, noteId: number): Promise<ApiResponse> => {
    const response = await api.delete(`/candidates/${candidateId}/notes/${noteId}`);
    return response.data;
  },

  exportCandidates: async (params: CandidateExportParams): Promise<AxiosResponse<Blob>> => {
    const response = await api.get('/candidates/export', {
      params,
      paramsSerializer: {
        indexes: null
      },
      responseType: 'blob'
    });
    return response;
  },

  addFromInteraction: async (interactionId: number): Promise<ApiResponse<{ candidateId: string; isNew: boolean }>> => {
    const response = await api.post('/candidates/add-from-interaction', { interactionId });
    return response.data;
  },

  // Alias for addFromInteraction - adds an interaction candidate to the main pipeline
  addInteractionToPipeline: async (interactionId: number): Promise<ApiResponse<{ candidateId: string; isNew: boolean }>> => {
    const response = await api.post('/candidates/add-from-interaction', { interactionId });
    return response.data;
  },

  checkByPhone: async (phone: string): Promise<ApiResponse<Candidate> & { exists: boolean; latestNote?: any }> => {
    const response = await api.get(`/candidates/check-by-phone/${encodeURIComponent(phone)}`);
    return response.data;
  },

  // Get candidates for a specific job by job_id
  getCandidatesByJob: async (jobId: number): Promise<ApiResponse<{ candidates: Candidate[]; job: any }>> => {
    const response = await api.get(`/jobs/${jobId}/candidates`);
    return response.data;
  },

  /** Candidates whose `position` maps to a dashboard job card category (see shared/jobCardCategoryMapping.json) */
  getCandidatesByJobCardTitle: async (title: string): Promise<ApiResponse<{ candidates: Candidate[] }>> => {
    const response = await api.get('/candidates/by-job-card', { params: { title } });
    return response.data;
  },
};

// Interviews API
export const interviewsAPI = {
  getInterviews: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    candidateId?: string;
    interviewerId?: number;
  }): Promise<ApiResponse<{
    interviews: Array<{
      id: number;
      candidate_id: string;
      interviewer_id: number;
      scheduled_date: string;
      type: string;
      status: string;
      location?: string;
      meeting_link?: string;
      notes?: string;
      created_at: string;
      updated_at: string;
      candidate_name?: string;
      interviewer_name?: string;
      candidate_position?: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }>> => {
    const response = await api.get('/interviews', { params });
    return response.data;
  },

  getInterviewById: async (id: number): Promise<ApiResponse<{
    interview: any;
  }>> => {
    const response = await api.get(`/interviews/${id}`);
    return response.data;
  },

  createInterview: async (interviewData: {
    candidate_id: string;
    interviewer_id: number;
    scheduled_date: string;
    type: string;
    location?: string;
    meeting_link?: string;
    notes?: string;
    status?: string;
  }): Promise<ApiResponse<{ interviewId: number }>> => {
    const response = await api.post('/interviews', interviewData);
    return response.data;
  },

  updateInterview: async (id: number, interviewData: Partial<{
    candidate_id: string;
    interviewer_id: number;
    scheduled_date: string;
    type: string;
    location?: string;
    meeting_link?: string;
    notes?: string;
    status?: string;
  }>): Promise<ApiResponse<{ message: string }>> => {
    const response = await api.put(`/interviews/${id}`, interviewData);
    return response.data;
  },

  deleteInterview: async (id: number): Promise<ApiResponse<{ message: string }>> => {
    const response = await api.delete(`/interviews/${id}`);
    return response.data;
  },

  updateInterviewStatus: async (id: number, status: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await api.patch(`/interviews/${id}/status`, { status });
    return response.data;
  }
};

// Analytics API
export interface Analytics {
  totalJobs: number;
  activeJobs: number;
  totalCandidates: number;
  hired: number;
  interviews: number;
  timeToHire: number;
  sourceEffectiveness: { [key: string]: number };
  monthlyHires: { month: string; hires: number; applications: number }[];
}



// Files API
export const filesAPI = {
  uploadFile: async (file: File, candidateId?: string): Promise<ApiResponse<{
    fileId: string;
    originalName: string;
    size: number;
    uploadedAt: string;
  }>> => {
    const formData = new FormData();
    formData.append('resume', file);
    if (candidateId) {
      formData.append('candidateId', candidateId.toString());
    }
    
    const response = await api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  downloadFile: async (filename: string): Promise<Blob> => {
    const response = await api.get(`/files/download/${filename}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  getFileMetadata: async (filename: string): Promise<ApiResponse<{
    filename: string;
    originalName: string;
    size: number;
    mimeType: string;
    uploadedAt: string;
    uploadedByName: string;
    candidateId: string;
    stats: any;
  }>> => {
    const response = await api.get(`/files/metadata/${filename}`);
    return response.data;
  },

  deleteFile: async (filename: string): Promise<ApiResponse> => {
    const response = await api.delete(`/files/${filename}`);
    return response.data;
  },

  getCandidateFiles: async (candidateId: string): Promise<ApiResponse<{
    files: Array<{
      filename: string;
      originalName: string;
      size: number;
      mimeType: string;
      uploadedAt: string;
      uploadedByName: string;
    }>;
  }>> => {
    const response = await api.get(`/files/candidate/${candidateId}`);
    return response.data;
  },
};

// Tasks API
export interface Task {
  id: number;
  title: string;
  description: string;
  assignedTo: number;
  assignedToName?: string;
  jobId?: number;
  jobTitle?: string;
  candidateId?: string;
  candidateName?: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed';
  dueDate: string;
  createdBy: number;
  createdByName?: string;
  createdDate: string;
  updatedDate?: string;
  category?: 'hr-operations' | 'admin-operations' | 'misc';
}

export const tasksAPI = {
  getTasks: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    assignedTo?: string;
  }): Promise<ApiResponse<{ tasks: Task[]; pagination: PaginationInfo }>> => {
    const response = await api.get('/tasks', { params });
    return response.data;
  },

  getTaskById: async (id: number): Promise<ApiResponse<{ task: Task }>> => {
    const response = await api.get(`/tasks/${id}`);
    return response.data;
  },

  createTask: async (taskData: {
    title: string;
    description: string;
    assignedTo: number;
    jobId?: number;
    candidateId?: string;
    priority: 'High' | 'Medium' | 'Low';
    status: 'Pending' | 'In Progress' | 'Completed';
    dueDate: string;
    createdBy: number;
    category?: 'hr-operations' | 'admin-operations' | 'misc';
  }): Promise<ApiResponse<{ taskId: number }>> => {
    const response = await api.post('/tasks', taskData);
    return response.data;
  },

  updateTask: async (id: number, taskData: Partial<Task>): Promise<ApiResponse> => {
    const response = await api.put(`/tasks/${id}`, taskData);
    return response.data;
  },

  deleteTask: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete(`/tasks/${id}`);
    return response.data;
  },

  updateTaskStatus: async (id: number, status: string): Promise<ApiResponse> => {
    const response = await api.patch(`/tasks/${id}/status`, { status });
    return response.data;
  },

  getUserTasks: async (userId: number): Promise<ApiResponse<{ tasks: Task[] }>> => {
    const response = await api.get(`/tasks/user/${userId}`);
    return response.data;
  },

  getOverdueTasks: async (): Promise<ApiResponse<{ tasks: Task[] }>> => {
    const response = await api.get('/tasks/overdue/list');
    return response.data;
  },

  getTasksDueToday: async (): Promise<ApiResponse<{ tasks: Task[] }>> => {
    const response = await api.get('/tasks/due-today/list');
    return response.data;
  },

  getTaskStats: async (): Promise<ApiResponse<{ statistics: any }>> => {
    const response = await api.get('/tasks/stats/overview');
    return response.data;
  },
};

// Dashboard API
export const dashboardAPI = {
  getOverview: async (): Promise<ApiResponse<{
    metrics: {
      totalJobs: { value: number; change: number; trend: string };
      activeCandidates: { value: number; change: number; trend: string };
      interviewsScheduled: { value: number; change: number; trend: string };
      timeToHire: { value: number; change: number; trend: string };
    };
    pipeline: Record<string, number>;
    activities: Array<{
      id: number;
      type: string;
      description: string;
      timestamp: string;
      user: string | null;
      candidate_name: string | null;
      position: string | null;
    }>;
    dailyMetrics: {
      total: number;
      byStage: Array<{ stage: string; count: number }>;
      byRole: Array<{ role: string; count: number }>;
    };
  }>> => {
    const response = await api.get('/dashboard/overview');
    return response.data;
  },

  getMetrics: async (): Promise<ApiResponse<{
    totalJobs: { value: number; change: number; trend: string };
    activeCandidates: { value: number; change: number; trend: string };
    interviewsScheduled: { value: number; change: number; trend: string };
    timeToHire: { value: number; change: number; trend: string };
  }>> => {
    const response = await api.get('/dashboard/metrics');
    return response.data;
  },

  getPipeline: async (): Promise<ApiResponse<Record<string, number>>> => {
    const response = await api.get('/dashboard/pipeline');
    return response.data;
  },

  getActivities: async (): Promise<ApiResponse<Array<{
    id: number;
    type: string;
    description: string;
    timestamp: string;
    user: string | null;
    candidate_name: string | null;
    position: string | null;
  }>>> => {
    const response = await api.get('/dashboard/activities');
    return response.data;
  },

  getDailyMetrics: async (): Promise<ApiResponse<{
    total: number;
    byStage: Array<{ stage: string; count: number }>;
    byRole: Array<{ role: string; count: number }>;
    profileNotFound?: number;
    followUps?: number;
  }>> => {
    const response = await api.get('/dashboard/daily-metrics');
    return response.data;
  },

  getMetricsTimeline: async (limit: number = 7): Promise<ApiResponse<Array<{
    date: string;
    uploadedCandidates: number;
    profileNotFound?: number;
    followUps?: number;
  }>>> => {
    const response = await api.get(`/dashboard/metrics/daily?limit=${limit}`);
    return response.data;
  },
};

// Analytics API
export const analyticsAPI = {
  getDashboard: async (): Promise<ApiResponse<{
    overview: {
      total_jobs: number;
      active_jobs: number;
      total_candidates: number;
      hired: number;
      interviews_completed: number;
      avg_time_to_hire: number;
    };
    sourceEffectiveness: Array<{ source: string; count: number }>;
    monthlyHires: Array<{ month: string; hires: number; applications: number }>;
    stageDistribution: Array<{ stage: string; count: number }>;
    departmentStats: Array<{ department: string; job_count: number; candidate_count: number }>;
  }>> => {
    const response = await api.get('/analytics/dashboard');
    return response.data;
  },

  getHiringFunnel: async (): Promise<ApiResponse<{
    funnelData: Array<{ stage: string; count: number; percentage: number }>;
    conversionRates: Array<{ stage: string; rate: number }>;
  }>> => {
    const response = await api.get('/analytics/hiring-funnel');
    return response.data;
  },

  getTimeToHire: async (): Promise<ApiResponse<{
    overallStats: {
      avg_time_to_hire: number;
      min_time_to_hire: number;
      max_time_to_hire: number;
      std_dev_time_to_hire: number;
    };
    byDepartment: Array<{ department: string; avg_time_to_hire: number; hires_count: number }>;
    bySource: Array<{ source: string; avg_time_to_hire: number; hires_count: number }>;
  }>> => {
    const response = await api.get('/analytics/time-to-hire');
    return response.data;
  },

  getInterviewerPerformance: async (): Promise<ApiResponse<{
    interviewerStats: Array<{
      id: number;
      name: string;
      role: string;
      total_interviews: number;
      completed_interviews: number;
      avg_rating: number;
      selections: number;
      rejections: number;
      selection_rate: number;
    }>;
  }>> => {
    const response = await api.get('/analytics/interviewer-performance');
    return response.data;
  },

  getRecruiterPerformance: async (): Promise<ApiResponse<{
    recruiterStats: Array<{
      id: number;
      name: string;
      role: string;
      candidates_assigned: number;
      hires: number;
      rejections: number;
      avg_candidate_score: number;
      hire_rate: number;
    }>;
  }>> => {
    const response = await api.get('/analytics/recruiter-performance');
    return response.data;
  },

  getJobPerformance: async (): Promise<ApiResponse<{
    jobStats: Array<{
      id: number;
      title: string;
      department: string;
      status: string;
      posted_date: string;
      deadline: string;
      total_applications: number;
      hires: number;
      avg_candidate_score: number;
      hire_rate: number;
      days_to_fill: number;
    }>;
  }>> => {
    const response = await api.get('/analytics/job-performance');
    return response.data;
  },

  getMonthlyTrends: async (months: number = 12): Promise<ApiResponse<{
    trends: Array<{
      month: string;
      applications: number;
      hires: number;
      rejections: number;
      avg_score: number;
    }>;
  }>> => {
    const response = await api.get(`/analytics/monthly-trends?months=${months}`);
    return response.data;
  },

  getCandidateQuality: async (): Promise<ApiResponse<{
    qualityStats: Array<{
      quality_range: string;
      count: number;
      percentage: number;
    }>;
  }>> => {
    const response = await api.get('/analytics/candidate-quality');
    return response.data;
  },
};

// Assignments API
export interface Assignment {
  id: number;
  candidate_id: string;
  job_id?: number;
  assigned_by: number;
  title: string;
  description_html?: string;
  status: 'Draft' | 'Assigned' | 'In Progress' | 'Submitted' | 'Approved' | 'Rejected' | 'Cancelled';
  due_date?: string;
  created_at: string;
  updated_at: string;
  candidate_name?: string;
  candidate_email?: string;
  job_title?: string;
  assigned_by_name?: string;
  attachment_count?: number;
  last_sent?: string;
  attachments?: Array<{
    id: number;
    filename: string;
    original_name: string;
    file_size: number;
    mime_type: string;
    uploaded_at: string;
  }>;
  communications?: Array<{
    id: number;
    type: string;
    date: string;
    content: string;
    status: string;
    created_at: string;
  }>;
}

export interface AssignmentFilters {
  search?: string;
  status?: string;
  candidateId?: string;
  jobId?: number;
  dueBefore?: string;
  dueAfter?: string;
  page?: number;
  limit?: number;
}

export const assignmentsAPI = {
  getAssignments: async (filters: AssignmentFilters = {}): Promise<any> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    });
    
    const response = await api.get(`/assignments?${params.toString()}`);
    return response.data;
  },

  getAssignment: async (id: number): Promise<ApiResponse<Assignment>> => {
    const response = await api.get(`/assignments/${id}`);
    return response.data;
  },

  createAssignment: async (assignmentData: {
    candidateId?: string;
    jobId?: number;
    title: string;
    descriptionHtml?: string;
    dueDate?: string;
  }): Promise<ApiResponse<Assignment>> => {
    const response = await api.post('/assignments', assignmentData);
    return response.data;
  },

  updateAssignment: async (id: number, assignmentData: {
    candidateId?: string;
    jobId?: number;
    title?: string;
    descriptionHtml?: string;
    dueDate?: string;
    status?: string;
  }): Promise<ApiResponse<Assignment>> => {
    const response = await api.put(`/assignments/${id}`, assignmentData);
    return response.data;
  },

  deleteAssignment: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete(`/assignments/${id}`);
    return response.data;
  },

  uploadFiles: async (id: number, files: FileList): Promise<ApiResponse> => {
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });
    
    const response = await api.post(`/assignments/${id}/files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  removeFile: async (id: number, fileId: number): Promise<ApiResponse> => {
    const response = await api.delete(`/assignments/${id}/files/${fileId}`);
    return response.data;
  },

  sendAssignment: async (id: number): Promise<ApiResponse> => {
    const response = await api.post(`/assignments/${id}/send`);
    return response.data;
  },

  updateStatus: async (id: number, status: string): Promise<ApiResponse> => {
    const response = await api.patch(`/assignments/${id}/status`, { status });
    return response.data;
  },

  getCandidateAssignments: async (candidateId: string): Promise<ApiResponse<Assignment[]>> => {
    const response = await api.get(`/assignments/candidates/${candidateId}`);
    return response.data;
  },
};

// Health check
export const healthAPI = {
  check: async (): Promise<ApiResponse> => {
    const response = await api.get('/health');
    return response.data;
  },
};

// ─── Candidate Import API ────────────────────────────────────────────────────

export interface FieldMapping {
  sourceColumn: string;
  targetField: string;
  confidence: number;
  method: 'exact' | 'fuzzy' | 'synonym' | 'manual';
}

export interface PreviewRow {
  rowNumber: number;
  mappedData: Record<string, any>;
  missingRequired: string[];
  missingOptional: string[];
  validationIssues: Array<{
    field: string;
    value: any;
    issue: string;
    severity: 'error' | 'warning';
  }>;
}

export interface DuplicateGroup {
  rows: number[];
  matchCriteria: 'email' | 'phone' | 'name+email' | 'name+phone';
}

export interface ImportLog {
  id: number;
  userId: number;
  username: string;
  filename: string;
  totalRows: number;
  successCount: number;
  failureCount: number;
  uploadedAt: string;
  processingTime: number;
}

export interface SavedMapping {
  id: number;
  userId: number;
  name: string;
  mappings: FieldMapping[];
  createdAt: string;
  lastUsed: string;
}

export const candidateImportAPI = {
  // Upload and preview file
  uploadFile: async (file: File, sheetIndex?: number): Promise<ApiResponse<{
    uploadId: string;
    fileInfo: {
      filename: string;
      fileType: 'csv' | 'xlsx' | 'xls';
      totalRows: number;
      sheetNames?: string[];
    };
    mappings: FieldMapping[];
    preview: {
      previewRows: PreviewRow[];
      statistics: {
        totalRows: number;
        rowsWithMissingRequired: number;
        rowsWithMissingOptional: number;
        estimatedQuality: {
          high: number;
          medium: number;
          low: number;
        };
      };
      warnings: any[];
    };
    duplicates: {
      uniqueCandidates: any[];
      duplicatesInFile: DuplicateGroup[];
      duplicatesInDatabase: any[];
    };
  }>> => {
    const formData = new FormData();
    formData.append('file', file);
    if (sheetIndex !== undefined) {
      formData.append('sheetIndex', sheetIndex.toString());
    }
    
    const response = await api.post('/candidates/import/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Confirm and execute import
  confirmImport: async (data: {
    uploadId: string;
    mappings: FieldMapping[];
    options: {
      saveMappings: boolean;
      mappingName?: string;
      duplicateHandling: 'skip' | 'allow_all' | 'merge';
      removeRows?: number[];
      jobId?: number;
    };
  }): Promise<ApiResponse<{
    importLogId: number;
    summary: {
      totalRows: number;
      successCount: number;
      failureCount: number;
      processingTime: number;
      qualityDistribution: {
        high: number;
        medium: number;
        low: number;
      };
      jobSegregation: {
        mappedCount: number;
        unmappedCount: number;
        byJob: Array<{
          jobId: number;
          jobTitle: string;
          count: number;
          matchMethod: string;
        }>;
      };
    };
    failedRows?: Array<{
      rowNumber: number;
      candidateName: string | null;
      error: string;
      data: Record<string, any>;
    }>;
  }>> => {
    const response = await api.post('/candidates/import/confirm', data);
    return response.data;
  },

  // Get import history
  getImportLogs: async (params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<{
    logs: ImportLog[];
    pagination: PaginationInfo;
  }>> => {
    const response = await api.get('/candidates/import/logs', { params });
    return response.data;
  },

  // Download failed rows
  downloadFailedRows: async (importLogId: number): Promise<Blob> => {
    const response = await api.get(`/candidates/import/logs/${importLogId}/failed-rows`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Get saved mappings
  getMappings: async (): Promise<ApiResponse<{
    mappings: SavedMapping[];
  }>> => {
    const response = await api.get('/candidates/import/mappings');
    return response.data;
  },

  // Save mapping
  saveMapping: async (data: {
    name: string;
    mappings: FieldMapping[];
  }): Promise<ApiResponse> => {
    const response = await api.post('/candidates/import/mappings', data);
    return response.data;
  },

  // Delete mapping
  deleteMapping: async (mappingId: number): Promise<ApiResponse> => {
    const response = await api.delete(`/candidates/import/mappings/${mappingId}`);
    return response.data;
  },

  // Get unassigned candidates (no job_id)
  getUnassignedCandidates: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ApiResponse<{
    candidates: Array<{
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      position: string | null;
      expertise: string | null;
      skills: string[];
      stage: string;
      applied_date: string;
    }>;
    jobs: Array<{ id: number; title: string; department?: string }>;
    pagination: PaginationInfo;
  }>> => {
    const response = await api.get('/candidates/import/unassigned', { params });
    return response.data;
  },

  // Manually reassign candidates to a job
  reassignCandidates: async (
    candidateIds: string[],
    jobId: number
  ): Promise<ApiResponse<{ updatedCount: number; jobId: number; jobTitle: string }>> => {
    const response = await api.post('/candidates/import/reassign', { candidateIds, jobId });
    return response.data;
  },

  // Preview job segregation before confirming import
  // Sends current mappings so the preview reflects manual mapping changes instantly
  getJobSegregationPreview: async (uploadId: string, mappings?: FieldMapping[]): Promise<ApiResponse<{
    totalCandidates: number;
    mappedCount: number;
    unmappedCount: number;
    byJob: Array<{ jobId: number; jobTitle: string; count: number; matchMethod: string }>;
    availableJobs: Array<{ id: number; title: string }>;
  }>> => {
    const response = await api.post(`/candidates/import/job-segregation-preview/${uploadId}`, {
      mappings: mappings ?? [],
    });
    return response.data;
  },
};

// HR Notes API
export interface HRNote {
  id: number;
  candidate_id: string;
  stage: 'Applied' | 'Follow Up' | 'Screening' | 'Interview' | 'Offer' | 'Hired' | 'On Hold' | 'Rejected' | 'No Show - Interview' | 'No Show - Onboarding' | 'Last Minute Back Out' | 'Profile Not Matched';
  note_text: string;
  interaction_type: 'Phone Call' | 'Email' | 'Interview' | 'Stage Change' | 'General Note' | 'System Event';
  author_id: number;
  author_name?: string;
  author_role?: string;
  created_at: string;
  updated_at: string;
}

export interface HRNotesByStage {
  [stage: string]: HRNote[];
}

export const hrNotesAPI = {
  // Get HR notes for a candidate (grouped by stage)
  getCandidateHRNotes: async (candidateId: string): Promise<ApiResponse<{
    notesByStage: HRNotesByStage;
  }>> => {
    const response = await api.get(`/candidates/${candidateId}/hr-notes`);
    return response.data;
  },

  // Create new HR note for a candidate
  createHRNote: async (candidateId: string, noteData: {
    note_text: string;
    interaction_type?: 'Phone Call' | 'Email' | 'Interview' | 'Stage Change' | 'General Note' | 'System Event';
  }): Promise<ApiResponse<{ noteId: number }>> => {
    const response = await api.post(`/candidates/${candidateId}/hr-notes`, noteData);
    return response.data;
  },
};


export default api;

// Pipeline Automations API
export interface PipelineAutomation {
  id: number;
  name: string;
  description?: string;
  trigger_stage: string;
  trigger_event: 'on_enter' | 'on_exit';
  is_active: boolean;
  priority: number;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  action_count?: number;
  actions?: AutomationAction[];
}

export interface AutomationAction {
  id?: number;
  automation_id?: number;
  action_type: 'email' | 'task' | 'interview' | 'notification';
  action_order: number;
  config: Record<string, any>;
  is_active: boolean;
}

export const automationsAPI = {
  getAutomations: async (): Promise<ApiResponse<{ automations: PipelineAutomation[] }>> => {
    const response = await api.get('/automations');
    return response.data;
  },

  getAutomationById: async (id: number): Promise<ApiResponse<{ automation: PipelineAutomation }>> => {
    const response = await api.get(`/automations/${id}`);
    return response.data;
  },

  createAutomation: async (automationData: {
    name: string;
    description?: string;
    trigger_stage: string;
    trigger_event: 'on_enter' | 'on_exit';
    is_active?: boolean;
    priority?: number;
    actions?: AutomationAction[];
  }): Promise<ApiResponse<{ automationId: number }>> => {
    const response = await api.post('/automations', automationData);
    return response.data;
  },

  updateAutomation: async (id: number, automationData: Partial<PipelineAutomation>): Promise<ApiResponse> => {
    const response = await api.put(`/automations/${id}`, automationData);
    return response.data;
  },

  toggleAutomation: async (id: number): Promise<ApiResponse<{ is_active: boolean }>> => {
    const response = await api.patch(`/automations/${id}/toggle`);
    return response.data;
  },

  deleteAutomation: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete(`/automations/${id}`);
    return response.data;
  },

  getAutomationLogs: async (id: number, params?: { limit?: number; offset?: number }): Promise<ApiResponse<{ logs: any[] }>> => {
    const response = await api.get(`/automations/${id}/logs`, { params });
    return response.data;
  },

  getAutomationStats: async (id: number): Promise<ApiResponse<{ stats: any }>> => {
    const response = await api.get(`/automations/${id}/stats`);
    return response.data;
  },
};

// Activity Logs API
export interface ActivityLog {
  id: number;
  entity_type: string;
  entity_id: number;
  action_type: string;
  description: string;
  metadata: Record<string, any>;
  created_by?: number;
  user_name?: string;
  user_role?: string;
  created_at: string;
}

export const activityLogsAPI = {
  getActivitiesForEntity: async (
    entityType: string,
    entityId: number,
    params?: { limit?: number; offset?: number }
  ): Promise<ApiResponse<{ activities: ActivityLog[] }>> => {
    const response = await api.get(`/activity-logs/${entityType}/${entityId}`, { params });
    return response.data;
  },

  getRecentActivities: async (params?: {
    limit?: number;
    actionTypes?: string;
  }): Promise<ApiResponse<{ activities: ActivityLog[] }>> => {
    const response = await api.get('/activity-logs/recent', { params });
    return response.data;
  },

  getActivityStatistics: async (params?: {
    entityType?: string;
    entityId?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<{ statistics: any[] }>> => {
    const response = await api.get('/activity-logs/stats', { params });
    return response.data;
  },
};


// Form Builder API
export interface FormBuilderForm {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  access_token: string;
  token_validity_hours: number;
  token_expires_at: string;
  job_id: number | null;
  job_title: string | null;
  created_by: number;
  created_by_name: string;
  submission_count: number;
  field_count: number;
  created_at: string;
  updated_at: string;
}

export interface FormField {
  id: number;
  form_id: number;
  label: string;
  field_key: string;
  field_type: 'text' | 'email' | 'tel' | 'number' | 'date' | 'textarea' | 'select' | 'file';
  is_required: boolean;
  options: string[] | null;
  placeholder: string | null;
  validation_rules: any | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const formBuilderAPI = {
  // Get all forms
  getForms: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ApiResponse<{
    forms: FormBuilderForm[];
    pagination: PaginationInfo;
  }>> => {
    const response = await api.get('/form-builder/forms', { params });
    return response.data;
  },

  // Get form by ID with fields
  getFormById: async (id: number): Promise<ApiResponse<{
    form: FormBuilderForm;
    fields: FormField[];
    mappings: any[];
  }>> => {
    const response = await api.get(`/form-builder/forms/${id}`);
    return response.data;
  },

  // Create new form
  createForm: async (formData: {
    name: string;
    slug: string;
    description?: string;
    job_id?: number;
    token_validity_hours?: number;
  }): Promise<ApiResponse<{ formId: number; accessToken: string }>> => {
    const response = await api.post('/form-builder/forms', formData);
    return response.data;
  },

  // Update form
  updateForm: async (id: number, formData: Partial<{
    name: string;
    description: string;
    is_active: boolean;
    job_id: number | null;
    token_validity_hours: number;
  }>): Promise<ApiResponse> => {
    const response = await api.put(`/form-builder/forms/${id}`, formData);
    return response.data;
  },

  // Delete form
  deleteForm: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete(`/form-builder/forms/${id}`);
    return response.data;
  },

  // Regenerate access token
  regenerateToken: async (id: number): Promise<ApiResponse<{ accessToken: string }>> => {
    const response = await api.post(`/form-builder/forms/${id}/regenerate-token`);
    return response.data;
  },

  // Add field to form
  addField: async (formId: number, fieldData: {
    label: string;
    field_key: string;
    field_type: string;
    is_required?: boolean;
    options?: string[];
    placeholder?: string;
    order_index?: number;
    validation_rules?: any;
  }): Promise<ApiResponse<{ fieldId: number }>> => {
    const response = await api.post(`/form-builder/forms/${formId}/fields`, fieldData);
    return response.data;
  },

  // Update field
  updateField: async (fieldId: number, fieldData: Partial<{
    label: string;
    is_required: boolean;
    options: string[];
    placeholder: string;
    order_index: number;
    is_active: boolean;
    validation_rules: any;
  }>): Promise<ApiResponse> => {
    const response = await api.put(`/form-builder/fields/${fieldId}`, fieldData);
    return response.data;
  },

  // Delete field
  deleteField: async (fieldId: number): Promise<ApiResponse> => {
    const response = await api.delete(`/form-builder/fields/${fieldId}`);
    return response.data;
  },

  // Get form analytics
  getFormAnalytics: async (formId: number): Promise<ApiResponse<{
    stats: {
      views: number;
      submissions: number;
      errors: number;
    };
    recentActivity: Array<{
      event_type: string;
      created_at: string;
      ip_address: string;
    }>;
  }>> => {
    const response = await api.get(`/form-builder/forms/${formId}/analytics`);
    return response.data;
  },

  // Get form submissions
  getFormSubmissions: async (formId: number, params?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{
    submissions: Array<{
      id: number;
      form_id: number;
      candidate_id: number | null;
      submission_data: any;
      ip_address: string;
      status: string;
      submitted_at: string;
      candidate_name: string | null;
      candidate_email: string | null;
    }>;
    pagination: PaginationInfo;
  }>> => {
    const response = await api.get(`/form-builder/forms/${formId}/submissions`, { params });
    return response.data;
  }
};

// ─── Workflow Engine API (Phase 3) ────────────────────────────────────────────

export interface WorkflowTrigger {
  entity_type: 'candidate' | 'job' | 'interview';
  event_type: 'stage_change' | 'created' | 'updated' | 'interview_scheduled' | 'task_completed';
  config?: Record<string, any>;
}

export interface WorkflowCondition {
  id?: number;
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'not_contains';
  value: string;
  logic_group: 'AND' | 'OR';
}

export interface WorkflowAction {
  id?: number;
  action_type: 'email' | 'task' | 'interview' | 'webhook' | 'stage_change';
  config: Record<string, any>;
  execution_order: number;
  is_active?: boolean;
}

export interface Workflow {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  action_count?: number;
  condition_count?: number;
  execution_count?: number;
  last_executed?: string;
  triggers?: WorkflowTrigger[];
  conditions?: WorkflowCondition[];
  actions?: WorkflowAction[];
}

export interface WorkflowLog {
  id: number;
  workflow_id: number;
  entity_type: string;
  entity_id: number;
  status: 'success' | 'failure' | 'skipped';
  message: string;
  actions_executed: number;
  execution_time_ms: number;
  created_at: string;
  candidate_name?: string;
}

export const workflowsAPI = {
  getWorkflows: async (): Promise<ApiResponse<{ workflows: Workflow[] }>> => {
    const response = await api.get('/workflows');
    return response.data;
  },

  getWorkflowById: async (id: number): Promise<ApiResponse<{ workflow: Workflow }>> => {
    const response = await api.get(`/workflows/${id}`);
    return response.data;
  },

  createWorkflow: async (data: {
    name: string;
    description?: string;
    is_active?: boolean;
    trigger: WorkflowTrigger;
    conditions?: WorkflowCondition[];
    actions?: WorkflowAction[];
  }): Promise<ApiResponse<{ workflowId: number }>> => {
    const response = await api.post('/workflows', data);
    return response.data;
  },

  updateWorkflow: async (id: number, data: Partial<{
    name: string;
    description: string;
    is_active: boolean;
    trigger: WorkflowTrigger;
    conditions: WorkflowCondition[];
    actions: WorkflowAction[];
  }>): Promise<ApiResponse> => {
    const response = await api.put(`/workflows/${id}`, data);
    return response.data;
  },

  toggleWorkflow: async (id: number): Promise<ApiResponse<{ is_active: boolean }>> => {
    const response = await api.patch(`/workflows/${id}/toggle`);
    return response.data;
  },

  deleteWorkflow: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete(`/workflows/${id}`);
    return response.data;
  },

  getWorkflowLogs: async (id: number, params?: { limit?: number; offset?: number }): Promise<ApiResponse<{ logs: WorkflowLog[] }>> => {
    const response = await api.get(`/workflows/${id}/logs`, { params });
    return response.data;
  },

  testWorkflow: async (id: number, candidateId: number): Promise<ApiResponse> => {
    const response = await api.post(`/workflows/${id}/test`, { candidate_id: candidateId });
    return response.data;
  },
};

// ─── Interaction Memory System API ──────────────────────────────────────────

export interface InteractionCandidate {
  id: number;
  name: string;
  phone: string;
  email?: string;
  source: 'Indeed' | 'Naukri' | 'Monster' | 'Manual' | 'Referral';
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  note_count?: number;
  latest_status?: string;
  latest_follow_up?: string;
  stage?: string;
  candidate_id?: string | null;
}

export interface InteractionNote {
  id: number;
  candidate_id: number;
  note: string;
  status: 'Not Interested' | 'Interested' | 'Follow-up' | 'No Response' | 'Wrong Number';
  priority: number;
  follow_up_date?: string;
  created_by: number;
  author_name?: string;
  created_at: string;
}

export interface DailySnapshot {
  id: number;
  user_id: number;
  snap_date: string;
  total_calls: number;
  interested: number;
  no_response: number;
  follow_ups: number;
}

export const interactionAPI = {
  addOrUpdate: async (data: {
    name: string;
    phone: string;
    email?: string;
    source?: string;
    note: string;
    priority?: number;
    status?: string;
    follow_up_date?: string;
  }): Promise<ApiResponse<InteractionCandidate> & { 
    isNew: boolean;
    mainCandidate?: {
      id: string;
      name: string;
      email: string | null;
      phone: string;
      stage: string;
    };
  }> => {
    const response = await api.post('/interaction/candidates/add-or-update', data);
    return response.data;
  },

  // Alias for addOrUpdate - logs an interaction and handles candidate linking
  logInteraction: async (data: {
    name: string;
    phone: string;
    email?: string;
    source?: string;
    note: string;
    priority?: number;
    status?: string;
    follow_up_date?: string;
  }): Promise<ApiResponse<InteractionCandidate> & { 
    isNew: boolean;
    mainCandidate?: {
      id: string;
      name: string;
      email: string | null;
      phone: string;
      stage: string;
    };
  }> => {
    const response = await api.post('/interaction/candidates/add-or-update', data);
    return response.data;
  },

  search: async (params: {
    phone?: string;
    name?: string;
    email?: string;
    date?: string;
    recruiterId?: number;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<InteractionCandidate[]>> => {
    const response = await api.get('/interaction/candidates/search', { params });
    return response.data;
  },

  getById: async (id: number): Promise<ApiResponse<InteractionCandidate>> => {
    const response = await api.get(`/interaction/candidates/${id}`);
    return response.data;
  },

  checkPhone: async (phone: string): Promise<ApiResponse<InteractionCandidate> & { exists: boolean; latestNote?: InteractionNote }> => {
    const response = await api.get(`/interaction/candidates/by-phone/${encodeURIComponent(phone)}`);
    return response.data;
  },

  addNote: async (data: {
    candidate_id: number;
    note: string;
    status?: string;
    priority?: number;
    follow_up_date?: string;
  }): Promise<ApiResponse<InteractionNote>> => {
    const response = await api.post('/interaction/notes', data);
    return response.data;
  },

  getNotesByCandidate: async (candidateId: number): Promise<ApiResponse<InteractionNote[]>> => {
    const response = await api.get(`/interaction/notes/by-candidate/${candidateId}`);
    return response.data;
  },

  moveToPipeline: async (candidate_id: number, stage: string): Promise<ApiResponse> => {
    const response = await api.post('/interaction/pipeline/move', { candidate_id, stage });
    return response.data;
  },

  getPipeline: async (): Promise<ApiResponse<any[]>> => {
    const response = await api.get('/interaction/pipeline/all');
    return response.data;
  },

  getSnapshots: async (userId?: number): Promise<ApiResponse<DailySnapshot[]>> => {
    const url = userId ? `/interaction/snapshots/${userId}` : '/interaction/snapshots';
    const response = await api.get(url);
    return response.data;
  },

  getAdminRecruiters: async (): Promise<ApiResponse<any[]>> => {
    const response = await api.get('/interaction/admin/recruiters');
    return response.data;
  },

  getRecruiterActivity: async (userId: number): Promise<ApiResponse<any>> => {
    const response = await api.get(`/interaction/admin/recruiter/${userId}`);
    return response.data;
  },

  getFollowUpsToday: async (): Promise<ApiResponse<any[]>> => {
    const response = await api.get('/interaction/follow-ups/today');
    return response.data;
  },
};