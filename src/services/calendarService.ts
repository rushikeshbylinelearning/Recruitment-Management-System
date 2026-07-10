import axios from 'axios';
import type { CalendarItem, CalendarCategory } from '../components/calendar/constants';

const API_BASE = import.meta.env.VITE_API_URL || '';

function getHeaders() {
  const token = localStorage.getItem('authToken');
  return { Authorization: `Bearer ${token}` };
}

export interface CalendarFilters {
  q?: string;
  types?: string;
  category?: string;
  status?: string;
  priority?: string;
  planId?: number;
  bucketId?: number;
  assignedTo?: number;
  showCompleted?: boolean;
  highPriority?: boolean;
  notesOnly?: boolean;
  viewUserId?: number;
}

export interface CreateEventPayload {
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  all_day?: boolean;
  category?: string;
  location?: string;
  colour?: string;
  priority?: string;
  reminder_type?: string;
  recurrence?: {
    frequency: string;
    interval?: number;
    days_of_week?: string;
    end_date?: string;
  };
}

export interface CreateNotePayload {
  title: string;
  note_content?: string;
  note_date: string;
  start_time?: string;
  colour?: string;
  is_pinned?: boolean;
  reminder_type?: string;
}

export const calendarService = {
  getItems: (start: string, end: string, filters: CalendarFilters = {}) =>
    axios
      .get(`${API_BASE}/calendar/items`, {
        headers: getHeaders(),
        params: { start, end, ...filters },
      })
      .then((r) => r.data.data.items as CalendarItem[]),

  getCategories: () =>
    axios
      .get(`${API_BASE}/calendar/categories`, { headers: getHeaders() })
      .then((r) => r.data.data.categories as CalendarCategory[]),

  getPinnedNotes: () =>
    axios
      .get(`${API_BASE}/calendar/pinned-notes`, { headers: getHeaders() })
      .then((r) => r.data.data.notes),

  createEvent: (data: CreateEventPayload) =>
    axios
      .post(`${API_BASE}/calendar/events`, data, { headers: getHeaders() })
      .then((r) => r.data.data.eventId as number),

  updateEvent: (id: number, data: Partial<CreateEventPayload & { status?: string }>) =>
    axios.put(`${API_BASE}/calendar/events/${id}`, data, { headers: getHeaders() }),

  deleteEvent: (id: number) =>
    axios.delete(`${API_BASE}/calendar/events/${id}`, { headers: getHeaders() }),

  getEvent: (id: number) =>
    axios
      .get(`${API_BASE}/calendar/events/${id}`, { headers: getHeaders() })
      .then((r) => r.data.data.event),

  createNote: (data: CreateNotePayload) =>
    axios
      .post(`${API_BASE}/calendar/notes`, data, { headers: getHeaders() })
      .then((r) => r.data.data.noteId as number),

  updateNote: (id: number, data: Partial<CreateNotePayload>) =>
    axios.put(`${API_BASE}/calendar/notes/${id}`, data, { headers: getHeaders() }),

  deleteNote: (id: number) =>
    axios.delete(`${API_BASE}/calendar/notes/${id}`, { headers: getHeaders() }),

  getNote: (id: number) =>
    axios
      .get(`${API_BASE}/calendar/notes/${id}`, { headers: getHeaders() })
      .then((r) => r.data.data.note),
};
