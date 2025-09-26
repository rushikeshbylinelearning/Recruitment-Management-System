import axios, { AxiosResponse, AxiosError } from 'axios';

// API Base Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
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
  role: 'Admin' | 'HR Manager' | 'Recruiter' | 'Interviewer';
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

  updateUser: async (id: number, userData: Partial<User>): Promise<ApiResponse> => {
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
  id: number;
  name: string;
  email: string;
  phone: string;
  position: string;
  stage: 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Hired' | 'Rejected';
  source: string;
  appliedDate: string;
  resume: string;
  notes: string;
  score: number;
  assignedTo: string;
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
  preInterviewFeedback?: any;
  postInterviewFeedback?: any[];
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
  feedback?: any;
  round: number;
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

  getCandidateById: async (id: number): Promise<ApiResponse<{ candidate: Candidate }>> => {
    const response = await api.get(`/candidates/${id}`);
    return response.data;
  },

  createCandidate: async (candidateData: Omit<Candidate, 'id' | 'communications' | 'interviews'>): Promise<ApiResponse<{ candidateId: number }>> => {
    const response = await api.post('/candidates', candidateData);
    return response.data;
  },

  updateCandidate: async (id: number, candidateData: Partial<Candidate>): Promise<ApiResponse> => {
    const response = await api.put(`/candidates/${id}`, candidateData);
    return response.data;
  },

  deleteCandidate: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete(`/candidates/${id}`);
    return response.data;
  },

  bulkImportCandidates: async (candidates: Omit<Candidate, 'id' | 'communications' | 'interviews'>[]): Promise<ApiResponse<{ results: any[], errors: any[] }>> => {
    const response = await api.post('/candidates/bulk-import', { candidates });
    return response.data;
  },

  updateCandidateStage: async (id: number, stage: string, notes?: string): Promise<ApiResponse> => {
    const response = await api.patch(`/candidates/${id}/stage`, { stage, notes });
    return response.data;
  },

  downloadResume: async (candidateId: number): Promise<Blob> => {
    const response = await api.get(`/candidates/${candidateId}/resume`, {
      responseType: 'blob'
    });
    return response.data;
  },

  getResumeMetadata: async (candidateId: number): Promise<ApiResponse<any>> => {
    const response = await api.get(`/candidates/${candidateId}/resume/metadata`);
    return response.data;
  },
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
  uploadFile: async (file: File, candidateId?: number): Promise<ApiResponse<{
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
    candidateId: number;
    stats: any;
  }>> => {
    const response = await api.get(`/files/metadata/${filename}`);
    return response.data;
  },

  deleteFile: async (filename: string): Promise<ApiResponse> => {
    const response = await api.delete(`/files/${filename}`);
    return response.data;
  },

  getCandidateFiles: async (candidateId: number): Promise<ApiResponse<{
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
  candidateId?: number;
  candidateName?: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed';
  dueDate: string;
  createdBy: number;
  createdByName?: string;
  createdDate: string;
  updatedDate?: string;
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
    candidateId?: number;
    priority: 'High' | 'Medium' | 'Low';
    status: 'Pending' | 'In Progress' | 'Completed';
    dueDate: string;
    createdBy: number;
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

// Health check
export const healthAPI = {
  check: async (): Promise<ApiResponse> => {
    const response = await api.get('/health');
    return response.data;
  },
};

export default api;
