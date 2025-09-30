import { JobPosting, Candidate, TeamMember, Task, Analytics } from '../types';

export const mockJobs: JobPosting[] = [
  {
    id: 1,
    title: 'Senior Frontend Developer',
    department: 'Engineering',
    location: 'San Francisco, CA',
    jobType: 'Full-time',
    status: 'Active',
    postedDate: '2024-01-15',
    deadline: '2024-02-28',
    description: 'We are looking for an experienced Frontend Developer to join our team.',
    requirements: ['React', 'TypeScript', 'CSS', '3+ years experience'],
    portals: [
      { name: 'LinkedIn', url: 'linkedin.com', status: 'Posted', applicants: 45 },
      { name: 'Indeed', url: 'indeed.com', status: 'Posted', applicants: 32 },
      { name: 'Naukri', url: 'naukri.com', status: 'Posted', applicants: 28 }
    ],
    applicantCount: 105,
    assignedTo: ['Sarah Johnson', 'Mike Chen']
  },
  {
    id: 2,
    title: 'Product Manager',
    department: 'Product',
    location: 'New York, NY',
    jobType: 'Full-time',
    status: 'Active',
    postedDate: '2024-01-10',
    deadline: '2024-03-15',
    description: 'Seeking a strategic Product Manager to drive product vision.',
    requirements: ['Product Strategy', 'Agile', 'Analytics', '5+ years experience'],
    portals: [
      { name: 'LinkedIn', url: 'linkedin.com', status: 'Posted', applicants: 67 },
      { name: 'Indeed', url: 'indeed.com', status: 'Posted', applicants: 43 }
    ],
    applicantCount: 110,
    assignedTo: ['Emma Wilson']
  },
  {
    id: 3,
    title: 'UX Designer',
    department: 'Design',
    location: 'Remote',
    jobType: 'Full-time',
    status: 'Paused',
    postedDate: '2024-01-05',
    deadline: '2024-02-20',
    description: 'Creative UX Designer to enhance user experience.',
    requirements: ['Figma', 'User Research', 'Prototyping', '2+ years experience'],
    portals: [
      { name: 'LinkedIn', url: 'linkedin.com', status: 'Posted', applicants: 34 },
      { name: 'Dribbble', url: 'dribbble.com', status: 'Posted', applicants: 21 }
    ],
    applicantCount: 55,
    assignedTo: ['David Kim']
  }
];

export const mockCandidates: Candidate[] = [
  {
    id: 1,
    name: 'Alice Cooper',
    email: 'alice.cooper@email.com',
    phone: '+1-555-0101',
    position: 'Senior Frontend Developer',
    stage: 'Interview',
    source: 'LinkedIn',
    appliedDate: '2024-01-20',
    resume: 'alice-cooper-resume.pdf',
    notes: 'Strong React skills, good communication',
    score: 4.5,
    assignedTo: 'Sarah Johnson',
    communications: [
      {
        id: 1,
        type: 'Email',
        date: '2024-01-22',
        content: 'Initial screening completed',
        status: 'Sent'
      }
    ],
    skills: ['React', 'TypeScript', 'Node.js', 'GraphQL'],
    experience: '5 years',
    salary: {
      expected: '12-15 LPA',
      negotiable: true
    },
    availability: {
      joiningTime: '2 weeks',
      noticePeriod: '30 days',
      immediateJoiner: false
    },
    workPreferences: {
      workPreference: 'Hybrid',
      willingAlternateSaturday: true,
      currentCtc: '8 LPA',
      ctcFrequency: 'Annual'
    },
    assignmentDetails: {
      inHouseAssignmentStatus: 'Shortlisted',
      interviewDate: '2024-01-25T10:00:00Z',
      interviewerId: 6,
      inOfficeAssignment: 'Technical Assessment'
    },
    interviews: [
      {
        id: 1,
        candidateId: '1',
        interviewerId: '6',
        interviewerName: 'John Smith',
        scheduledDate: '2024-01-25T10:00:00Z',
        duration: 60,
        type: 'Technical',
        status: 'Completed',
        meetingLink: 'https://meet.google.com/abc-def-ghi',
        round: 1,
      }
    ],
  },
  {
    id: 2,
    name: 'Bob Smith',
    email: 'bob.smith@email.com',
    phone: '+1-555-0102',
    position: 'Product Manager',
    stage: 'Screening',
    source: 'Indeed',
    appliedDate: '2024-01-18',
    resume: 'bob-smith-resume.pdf',
    notes: 'Good product sense, needs technical evaluation',
    score: 4.0,
    assignedTo: 'Emma Wilson',
    communications: [
      {
        id: 2,
        type: 'Phone',
        date: '2024-01-21',
        content: 'Phone screening scheduled',
        status: 'Pending'
      }
    ],
    skills: ['Product Strategy', 'Analytics', 'Agile', 'Stakeholder Management'],
    experience: '6 years',
    salary: {
      expected: '18-22 LPA',
      negotiable: true
    },
    availability: {
      joiningTime: '1 month',
      noticePeriod: '60 days',
      immediateJoiner: false
    },
    workPreferences: {
      workPreference: 'Onsite',
      willingAlternateSaturday: false,
      currentCtc: '6 LPA',
      ctcFrequency: 'Annual'
    },
    assignmentDetails: {
      inHouseAssignmentStatus: 'Pending',
      inOfficeAssignment: 'Product Management Case Study'
    },
    interviews: []
  },
  {
    id: 3,
    name: 'Carol Davis',
    email: 'carol.davis@email.com',
    phone: '+1-555-0103',
    position: 'UX Designer',
    stage: 'Applied',
    source: 'Dribbble',
    appliedDate: '2024-01-19',
    resume: 'carol-davis-portfolio.pdf',
    notes: 'Impressive portfolio, creative approach',
    score: 4.2,
    assignedTo: 'David Kim',
    communications: [],
    skills: ['Figma', 'User Research', 'Prototyping', 'Design Systems'],
    experience: '4 years',
    salary: {
      expected: '10-12 LPA',
      negotiable: false
    },
    availability: {
      joiningTime: '2 weeks',
      noticePeriod: '30 days',
      immediateJoiner: false
    },
    workPreferences: {
      workPreference: 'Onsite',
      willingAlternateSaturday: false,
      currentCtc: '6 LPA',
      ctcFrequency: 'Annual'
    },
    assignmentDetails: {
      inHouseAssignmentStatus: 'Pending',
      inOfficeAssignment: 'Product Management Case Study'
    },
    interviews: []
  },
  {
    id: 4,
    name: 'Daniel Johnson',
    email: 'daniel.johnson@email.com',
    phone: '+1-555-0104',
    position: 'Senior Frontend Developer',
    stage: 'Offer',
    source: 'LinkedIn',
    appliedDate: '2024-01-15',
    resume: 'daniel-johnson-resume.pdf',
    notes: 'Excellent technical skills, culture fit',
    score: 4.8,
    assignedTo: 'Sarah Johnson',
    communications: [
      {
        id: 3,
        type: 'Email',
        date: '2024-01-25',
        content: 'Offer letter sent',
        status: 'Sent'
      }
    ],
    skills: ['React', 'Vue.js', 'Python', 'AWS'],
    experience: '7 years',
    salary: {
      expected: '15-18 LPA',
      offered: '16 LPA',
      negotiable: true
    },
    availability: {
      joiningTime: '3 weeks',
      noticePeriod: '45 days',
      immediateJoiner: false
    },
    workPreferences: {
      workPreference: 'Onsite',
      willingAlternateSaturday: false,
      currentCtc: '6 LPA',
      ctcFrequency: 'Annual'
    },
    assignmentDetails: {
      inHouseAssignmentStatus: 'Pending',
      inOfficeAssignment: 'Product Management Case Study'
    },
    interviews: []
  },
  {
    id: 5,
    name: 'Eva Martinez',
    email: 'eva.martinez@email.com',
    phone: '+1-555-0105',
    position: 'Product Manager',
    stage: 'Hired',
    source: 'Referral',
    appliedDate: '2024-01-12',
    resume: 'eva-martinez-resume.pdf',
    notes: 'Outstanding candidate, start date confirmed',
    score: 5.0,
    assignedTo: 'Emma Wilson',
    communications: [
      {
        id: 4,
        type: 'Email',
        date: '2024-01-28',
        content: 'Welcome package sent',
        status: 'Sent'
      }
    ],
    skills: ['Product Management', 'Data Analysis', 'Leadership', 'Strategy'],
    experience: '8 years',
    salary: {
      expected: '25-30 LPA',
      offered: '28 LPA',
      negotiable: false
    },
    availability: {
      joiningTime: 'Immediate',
      noticePeriod: 'Completed',
      immediateJoiner: true
    },
    workPreferences: {
      workPreference: 'Onsite',
      willingAlternateSaturday: false,
      currentCtc: '6 LPA',
      ctcFrequency: 'Annual'
    },
    assignmentDetails: {
      inHouseAssignmentStatus: 'Pending',
      inOfficeAssignment: 'Product Management Case Study'
    },
    interviews: []
  }
];

export const mockTeam: TeamMember[] = [
  {
    id: 1,
    username: 'admin',
    password: 'admin123',
    name: 'Sarah Johnson',
    role: 'HR Manager',
    email: 'sarah.johnson@company.com',
    permissions: [
      { module: 'dashboard', actions: ['view'] },
      { module: 'jobs', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'candidates', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'communications', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'tasks', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'team', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'analytics', actions: ['view'] },
      { module: 'settings', actions: ['view', 'edit'] },
    ],
    avatar: '',
    assignedJobs: ['1'],
    tasksCompleted: 45,
    candidatesProcessed: 23,
    status: 'Active',
    lastLogin: '2024-01-29T10:30:00Z',
    createdDate: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    username: 'sarah.johnson',
    password: 'sarah123',
    name: 'Sarah Johnson',
    role: 'HR Manager',
    email: 'sarah.johnson@company.com',
    permissions: [
      { module: 'dashboard', actions: ['view'] },
      { module: 'jobs', actions: ['view', 'create', 'edit'] },
      { module: 'candidates', actions: ['view', 'create', 'edit'] },
      { module: 'communications', actions: ['view', 'create', 'edit'] },
      { module: 'tasks', actions: ['view', 'create', 'edit'] },
      { module: 'team', actions: ['view'] },
      { module: 'analytics', actions: ['view'] },
    ],
    avatar: '',
    assignedJobs: ['1'],
    tasksCompleted: 45,
    candidatesProcessed: 23,
    status: 'Active',
    lastLogin: '2024-01-29T10:30:00Z',
    createdDate: '2024-01-01T00:00:00Z'
  },
  {
    id: 3,
    username: 'mike.chen',
    password: 'mike123',
    name: 'Mike Chen',
    role: 'Recruiter',
    email: 'mike.chen@company.com',
    permissions: [
      { module: 'dashboard', actions: ['view'] },
      { module: 'jobs', actions: ['view'] },
      { module: 'candidates', actions: ['view', 'edit'] },
      { module: 'communications', actions: ['view', 'create'] },
      { module: 'tasks', actions: ['view', 'create', 'edit'] },
      { module: 'team', actions: ['view', 'create'] },
      { module: 'analytics', actions: ['view'] },
    ],
    avatar: '',
    assignedJobs: ['1', '2'],
    tasksCompleted: 32,
    candidatesProcessed: 18,
    status: 'Active',
    lastLogin: '2024-01-29T09:15:00Z',
    createdDate: '2024-01-05T00:00:00Z'
  },
  {
    id: 4,
    username: 'emma.wilson',
    password: 'emma123',
    name: 'Emma Wilson',
    role: 'HR Manager',
    email: 'emma.wilson@company.com',
    permissions: [
      { module: 'dashboard', actions: ['view'] },
      { module: 'jobs', actions: ['view', 'edit'] },
      { module: 'candidates', actions: ['view', 'edit'] },
      { module: 'communications', actions: ['view', 'create', 'edit'] },
      { module: 'tasks', actions: ['view', 'create', 'edit'] },
      { module: 'team', actions: ['view'] },
      { module: 'analytics', actions: ['view'] },
    ],
    avatar: '',
    assignedJobs: ['2'],
    tasksCompleted: 52,
    candidatesProcessed: 31,
    status: 'Busy',
    lastLogin: '2024-01-29T08:45:00Z',
    createdDate: '2024-01-03T00:00:00Z'
  },
  {
    id: 5,
    username: 'david.kim',
    password: 'david123',
    name: 'David Kim',
    role: 'Recruiter',
    email: 'david.kim@company.com',
    permissions: [
      { module: 'dashboard', actions: ['view'] },
      { module: 'jobs', actions: ['view'] },
      { module: 'candidates', actions: ['view', 'edit'] },
      { module: 'communications', actions: ['view', 'create'] },
      { module: 'tasks', actions: ['view', 'create', 'edit'] },
      { module: 'team', actions: ['view', 'create'] },
      { module: 'analytics', actions: ['view'] },
    ],
    avatar: '',
    assignedJobs: ['3'],
    tasksCompleted: 28,
    candidatesProcessed: 15,
    status: 'Away',
    lastLogin: '2024-01-28T16:20:00Z',
    createdDate: '2024-01-10T00:00:00Z'
  },
  {
    id: 6,
    username: 'john.smith',
    password: 'john123',
    name: 'John Smith',
    role: 'Interviewer',
    email: 'john.smith@company.com',
    permissions: [
      { module: 'dashboard', actions: ['view'] },
      { module: 'candidates', actions: ['view'] },
      { module: 'interviews', actions: ['view', 'edit'] },
    ],
    avatar: '',
    assignedJobs: [],
    tasksCompleted: 0,
    candidatesProcessed: 0,
    status: 'Active',
    lastLogin: '2024-01-29T14:20:00Z',
    createdDate: '2024-01-15T00:00:00Z',
    interviewerProfile: {
      department: 'Engineering',
      expertise: ['React', 'Node.js', 'System Design', 'JavaScript'],
      interviewTypes: ['Technical'],
      totalInterviews: 45,
      averageRating: 4.2
    }
  }
];

export const mockTasks: Task[] = [
  {
    id: 1,
    title: 'Review Frontend Developer Applications',
    description: 'Screen and evaluate new applications for Senior Frontend Developer position',
    assignedTo: 2,
    assignedToName: 'Sarah Johnson',
    jobId: 1,
    priority: 'High',
    status: 'In Progress',
    dueDate: '2024-02-01',
    createdBy: 1,
    createdByName: 'Admin',
    createdDate: '2024-01-28'
  },
  {
    id: 2,
    title: 'Schedule Interviews for Product Manager Role',
    description: 'Coordinate interview schedules for shortlisted Product Manager candidates',
    assignedTo: 4,
    assignedToName: 'Emma Wilson',
    jobId: 2,
    candidateId: 2,
    priority: 'High',
    status: 'Pending',
    dueDate: '2024-01-31',
    createdBy: 1,
    createdByName: 'Admin',
    createdDate: '2024-01-26'
  },
  {
    id: 3,
    title: 'Prepare Offer Letter',
    description: 'Draft and prepare offer letter for Daniel Johnson',
    assignedTo: 2,
    assignedToName: 'Sarah Johnson',
    jobId: 1,
    candidateId: 4,
    priority: 'Medium',
    status: 'Completed',
    dueDate: '2024-01-25',
    createdBy: 1,
    createdByName: 'Admin',
    createdDate: '2024-01-23'
  },
  {
    id: 4,
    title: 'Update Job Posting on Indeed',
    description: 'Refresh job posting description and requirements',
    assignedTo: 3,
    assignedToName: 'Mike Chen',
    jobId: 1,
    priority: 'Low',
    status: 'Pending',
    dueDate: '2024-02-05',
    createdBy: 1,
    createdByName: 'Admin',
    createdDate: '2024-01-27'
  },
  {
    id: 5,
    title: 'Conduct Reference Checks',
    description: 'Complete reference verification for Eva Martinez',
    assignedTo: 4,
    assignedToName: 'Emma Wilson',
    jobId: 2,
    candidateId: 5,
    priority: 'Medium',
    status: 'Completed',
    dueDate: '2024-01-27',
    createdBy: 1,
    createdByName: 'Admin',
    createdDate: '2024-01-25'
  }
];

export const mockAnalytics: Analytics = {
  totalJobs: 15,
  activeJobs: 8,
  totalCandidates: 342,
  hired: 23,
  interviews: 45,
  timeToHire: 28,
  sourceEffectiveness: {
    LinkedIn: 35,
    Indeed: 28,
    Referral: 15,
    'Company Website': 12,
    Naukri: 10
  },
  monthlyHires: [
    { month: 'Jan', hires: 8, applications: 145 },
    { month: 'Feb', hires: 12, applications: 167 },
    { month: 'Mar', hires: 15, applications: 189 },
    { month: 'Apr', hires: 10, applications: 156 },
    { month: 'May', hires: 18, applications: 203 },
    { month: 'Jun', hires: 14, applications: 178 }
  ]
};