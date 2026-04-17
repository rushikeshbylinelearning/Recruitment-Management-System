export interface Interview {
  id: number;
  candidate_id: number;
  job_role: string;
  interviewer_id: number;
  date: string;           // 'YYYY-MM-DD'
  time: string;           // 'HH:MM:SS'
  duration: number;       // minutes
  type: 'HR Round' | 'Technical' | 'Final';
  mode: 'Virtual' | 'In-Person';
  meeting_link?: string;
  location?: string;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  candidate_name?: string;
  candidate_email?: string;
  interviewer_name?: string;
  interviewer_email?: string;
}

export interface InterviewFormPayload {
  candidate_id: number;
  job_role: string;
  interviewer_id: number;
  date: string;
  time: string;
  duration: number;
  type: 'HR Round' | 'Technical' | 'Final';
  mode: 'Virtual' | 'In-Person';
  meeting_link?: string;
  location?: string;
  notes?: string;
}

export interface ConflictError {
  hasConflict: true;
  conflictingDate: string;
  conflictingTime: string;
}
