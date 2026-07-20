import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

function getHeaders() {
  const token = localStorage.getItem('authToken');
  return { Authorization: `Bearer ${token}` };
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface Plan {
  id: number;
  name: string;
  description?: string;
  colour: string;
  icon?: string;
  owner_id: number;
  visibility: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  owner_name?: string;
}

export interface Bucket {
  id: number;
  plan_id: number;
  name: string;
  colour?: string;
  position: number;
  collapsed: boolean;
  task_count: number;
  completed_count: number;
  progress_pct: number;
}

export interface TaskCard {
  id: number;
  title: string;
  priority: 'low' | 'medium' | 'high' | null;
  status: 'pending' | 'in_progress' | 'completed';
  assigned_to: number | null;
  due_date: string | null;
  due_time?: string | null;
  recurrence_type?: 'none' | 'daily';
  last_completed_at?: string | null;
  timer_elapsed_seconds?: number;
  timer_started_at?: string | null;
  completion_percentage: number;
  position: number;
  assignee_name: string | null;
  assignee_avatar: string | null;
  labels: Array<{ id: number; name: string; colour: string }>;
  checklist_total: number;
  checklist_checked: number;
  created_by: number;
  created_by_name: string | null;
}

export interface TimerState {
  timer_elapsed_seconds: number;
  timer_started_at: string | null;
  timer_running: boolean;
}

export interface TaskDetail extends TaskCard {
  description?: string;
  reminder_date?: string;
  estimated_time?: string;
  created_by: number;
  assigner_name?: string;
  notes: Array<{ note_content: string }>;
  checklist: Array<{ id: number; item_text: string; is_checked: boolean; position: number }>;
  checklist_progress: number;
  attachment_count: number;
  comment_count: number;
}

export interface SearchParams {
  q?: string;
  assignedTo?: number;
  priority?: string;
  status?: string;
  labelId?: number;
  planId?: number;
  bucketId?: number;
  dueDateFrom?: string;
  dueDateTo?: string;
  datePreset?: string;
  completionMin?: number;
  hasAttachments?: boolean;
  createdBy?: number;
  page?: number;
  pageSize?: number;
}

// ── API Methods ──────────────────────────────────────────────────────────────

export const plannerService = {
  // Plans
  getPlans: (includeArchived = false) =>
    axios
      .get(`${API_BASE}/planner/plans`, {
        headers: getHeaders(),
        params: { includeArchived },
      })
      .then((r) => r.data.data.plans as Plan[]),

  createPlan: (data: { name: string; colour?: string; description?: string; visibility?: string }) =>
    axios
      .post(`${API_BASE}/planner/plans`, data, { headers: getHeaders() })
      .then((r) => r.data.data.planId as number),

  updatePlan: (id: number, data: Partial<Plan>) =>
    axios.put(`${API_BASE}/planner/plans/${id}`, data, { headers: getHeaders() }),

  deletePlan: (id: number) =>
    axios.delete(`${API_BASE}/planner/plans/${id}`, { headers: getHeaders() }),

  archivePlan: (id: number) =>
    axios.post(`${API_BASE}/planner/plans/${id}/archive`, {}, { headers: getHeaders() }),

  restorePlan: (id: number) =>
    axios.post(`${API_BASE}/planner/plans/${id}/restore`, {}, { headers: getHeaders() }),

  // Buckets
  getBuckets: (planId: number) =>
    axios
      .get(`${API_BASE}/planner/plans/${planId}/buckets`, { headers: getHeaders() })
      .then((r) => r.data.data.buckets as Bucket[]),

  createBucket: (planId: number, data: { name: string; colour?: string }) =>
    axios
      .post(`${API_BASE}/planner/plans/${planId}/buckets`, data, { headers: getHeaders() })
      .then((r) => r.data.data.bucketId as number),

  updateBucket: (bucketId: number, data: Partial<Bucket>) =>
    axios.put(`${API_BASE}/planner/buckets/${bucketId}`, data, { headers: getHeaders() }),

  deleteBucket: (bucketId: number, moveTo?: number) =>
    axios.delete(`${API_BASE}/planner/buckets/${bucketId}`, {
      headers: getHeaders(),
      params: moveTo ? { moveTo } : {},
    }),

  reorderBuckets: (items: Array<{ id: number; position: number }>) =>
    axios.put(`${API_BASE}/planner/buckets/reorder`, items, { headers: getHeaders() }),

  toggleBucketCollapse: (bucketId: number) =>
    axios.patch(`${API_BASE}/planner/buckets/${bucketId}/collapse`, {}, { headers: getHeaders() }),

  // Tasks
  getTasks: (bucketId: number) =>
    axios
      .get(`${API_BASE}/planner/buckets/${bucketId}/tasks`, { headers: getHeaders() })
      .then((r) => r.data.data.tasks as TaskCard[]),

  getTaskDetail: (taskId: number) =>
    axios
      .get(`${API_BASE}/planner/tasks/${taskId}`, { headers: getHeaders() })
      .then((r) => r.data.data.task as TaskDetail),

  createTask: (data: Record<string, unknown>) =>
    axios
      .post(`${API_BASE}/planner/tasks`, data, { headers: getHeaders() })
      .then((r) => r.data.data.taskId as number),

  updateTask: (taskId: number, data: Record<string, unknown>) =>
    axios.put(`${API_BASE}/planner/tasks/${taskId}`, data, { headers: getHeaders() }),

  deleteTask: (taskId: number) =>
    axios.delete(`${API_BASE}/planner/tasks/${taskId}`, { headers: getHeaders() }),

  moveTask: (taskId: number, targetBucketId: number) =>
    axios.post(
      `${API_BASE}/planner/tasks/${taskId}/move`,
      { targetBucketId },
      { headers: getHeaders() }
    ),

  reorderTasks: (items: Array<{ id: number; position: number; bucket_id: number }>) =>
    axios.put(`${API_BASE}/planner/tasks/reorder`, items, { headers: getHeaders() }),

  startTimer: (taskId: number) =>
    axios
      .post(`${API_BASE}/planner/tasks/${taskId}/timer/start`, {}, { headers: getHeaders() })
      .then((r) => r.data.data as TimerState),

  pauseTimer: (taskId: number) =>
    axios
      .post(`${API_BASE}/planner/tasks/${taskId}/timer/pause`, {}, { headers: getHeaders() })
      .then((r) => r.data.data as TimerState),

  resetTimer: (taskId: number) =>
    axios
      .post(`${API_BASE}/planner/tasks/${taskId}/timer/reset`, {}, { headers: getHeaders() })
      .then((r) => r.data.data as TimerState),

  // Search
  searchTasks: (params: SearchParams) =>
    axios
      .get(`${API_BASE}/planner/search`, { headers: getHeaders(), params })
      .then((r) => r.data.data),

  // Labels
  getLabels: () =>
    axios
      .get(`${API_BASE}/planner/labels`, { headers: getHeaders() })
      .then((r) => r.data.data.labels as Array<{ id: number; name: string; colour: string; category: string }>),

  applyLabel: (taskId: number, labelId: number) =>
    axios.post(`${API_BASE}/planner/tasks/${taskId}/labels`, { labelId }, { headers: getHeaders() }),

  removeLabel: (taskId: number, labelId: number) =>
    axios.delete(`${API_BASE}/planner/tasks/${taskId}/labels/${labelId}`, { headers: getHeaders() }),

  // Notes
  getNotes: (taskId: number) =>
    axios
      .get(`${API_BASE}/planner/tasks/${taskId}/notes`, { headers: getHeaders() })
      .then((r) => r.data.data),

  saveNotes: (taskId: number, note_content: string) =>
    axios.put(`${API_BASE}/planner/tasks/${taskId}/notes`, { note_content }, { headers: getHeaders() }),

  // Checklists
  getChecklists: (taskId: number) =>
    axios
      .get(`${API_BASE}/planner/tasks/${taskId}/checklists`, { headers: getHeaders() })
      .then((r) => r.data.data.items),

  addChecklistItem: (taskId: number, item_text: string) =>
    axios.post(`${API_BASE}/planner/tasks/${taskId}/checklists`, { item_text }, { headers: getHeaders() }),

  updateChecklistItem: (itemId: number, data: { item_text?: string; is_checked?: boolean }) =>
    axios.put(`${API_BASE}/planner/checklists/${itemId}`, data, { headers: getHeaders() }),

  deleteChecklistItem: (itemId: number) =>
    axios.delete(`${API_BASE}/planner/checklists/${itemId}`, { headers: getHeaders() }),

  // Comments
  getComments: (taskId: number) =>
    axios
      .get(`${API_BASE}/planner/tasks/${taskId}/comments`, { headers: getHeaders() })
      .then((r) => r.data.data.comments),

  addComment: (taskId: number, comment_text: string, parent_comment_id?: number) =>
    axios.post(
      `${API_BASE}/planner/tasks/${taskId}/comments`,
      { comment_text, parent_comment_id },
      { headers: getHeaders() }
    ),

  // Activity
  getActivity: (taskId: number) =>
    axios
      .get(`${API_BASE}/planner/tasks/${taskId}/activity`, { headers: getHeaders() })
      .then((r) => r.data.data.entries),

  // Attachments
  getAttachments: (taskId: number) =>
    axios
      .get(`${API_BASE}/planner/tasks/${taskId}/attachments`, { headers: getHeaders() })
      .then((r) => r.data.data.attachments),

  uploadAttachment: (taskId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post(`${API_BASE}/planner/tasks/${taskId}/attachments`, formData, {
      headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' },
    });
  },

  downloadAttachment: (attachmentId: number) =>
    `${API_BASE}/planner/attachments/${attachmentId}/download`,

  /** Fetch raw file bytes with Authorization header — used by the custom DocViewer */
  fetchAttachment: async (attachmentId: number): Promise<ArrayBuffer> => {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE}/planner/attachments/${attachmentId}/fetch`, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    });
    if (!res.ok) throw new Error(`Failed to load file (${res.status})`);
    return res.arrayBuffer();
  },

  renameAttachment: (attachmentId: number, newFilename: string) =>
    axios.put(
      `${API_BASE}/planner/attachments/${attachmentId}/rename`,
      { newFilename },
      { headers: getHeaders() }
    ),

  deleteAttachment: (attachmentId: number) =>
    axios.delete(`${API_BASE}/planner/attachments/${attachmentId}`, { headers: getHeaders() }),

  // Admin Monitor
  getAdminUsers: () =>
    axios
      .get(`${API_BASE}/planner/admin/users`, { headers: getHeaders() })
      .then((r) => r.data.data.users),

  getAdminWorkspace: (userId: number) =>
    axios
      .get(`${API_BASE}/planner/admin/workspace/${userId}`, { headers: getHeaders() })
      .then((r) => r.data.data),

  getAdminStats: (userId: number) =>
    axios
      .get(`${API_BASE}/planner/admin/workspace/${userId}/stats`, { headers: getHeaders() })
      .then((r) => r.data.data.stats),
};
