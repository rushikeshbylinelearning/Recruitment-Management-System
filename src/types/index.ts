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
  resumeFileId?: string;
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
  preInterviewFeedback?: PreInterviewFeedback;
  postInterviewFeedback?: PostInterviewFeedback[];
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
  candidate_name?: string;
  candidate_position?: string;
  scheduledDate: string;
  duration: number; // in minutes
  type: 'Technical' | 'HR' | 'Managerial' | 'Final';
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'Rescheduled';
  meetingLink?: string;
  location?: string;
  feedback?: InterviewFeedback;
  round: number;
}

export interface InterviewFeedback {
  id: string;
  interviewId: string;
  interviewerId: string;
  ratings: SkillRating[];
  overallRating: number;
  comments: string;
  recommendation: 'Selected' | 'On Hold' | 'Rejected';
  strengths: string[];
  weaknesses: string[];
  additionalNotes: string;
  submittedAt: string;
}

export interface SkillRating {
  skill: string;
  rating: number; // 1-5
  comments?: string;
}

export interface PreInterviewFeedback {
  id: string;
  candidateId: string;
  submittedBy: string;
  resumeReview: {
    rating: number;
    comments: string;
  };
  skillsAssessment: {
    rating: number;
    comments: string;
  };
  culturalFit: {
    rating: number;
    comments: string;
  };
  overallRecommendation: 'Proceed' | 'Hold' | 'Reject';
  notes: string;
  submittedAt: string;
}

export interface PostInterviewFeedback {
  id: string;
  candidateId: string;
  interviewId: string;
  submittedBy: string;
  technicalSkills: SkillRating[];
  softSkills: SkillRating[];
  overallPerformance: number;
  recommendation: 'Hire' | 'Maybe' | 'No Hire';
  salaryRecommendation?: string;
  startDateFlexibility: number;
  additionalComments: string;
  submittedAt: string;
}

export interface TeamMember {
  id: number;
  name: string;
  role: 'Recruiter' | 'HR Manager' | 'Admin' | 'Interviewer';
  email: string;
  username: string;
  password: string;
  permissions: Permission[];
  avatar: string;
  assignedJobs: string[];
  tasksCompleted: number;
  candidatesProcessed: number;
  status: 'Active' | 'Away' | 'Busy';
  lastLogin: string;
  statistics?: {
    tasks_completed: number;
    assigned_jobs: number;
  };
  createdDate: string;
  interviewerProfile?: InterviewerProfile;
}

export interface InterviewerProfile {
  department: string;
  expertise: string[];
  interviewTypes: ('Technical' | 'HR' | 'Managerial' | 'Final')[];
  totalInterviews: number;
  averageRating: number;
}

export interface Permission {
  module: string;
  actions: ('view' | 'create' | 'edit' | 'delete')[];
}

export interface User {
  id: number;
  name: string;
  email: string;
  username: string;
  role: 'Recruiter' | 'HR Manager' | 'Admin' | 'Interviewer';
  permissions: Permission[];
  avatar: string;
  interviewerProfile?: InterviewerProfile;
  statistics?: {
    tasks_completed: number;
    assigned_jobs: number;
  };
}

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