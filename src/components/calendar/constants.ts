/**
 * Calendar 2.0 — shared constants and colour definitions
 */

export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';

export type CalendarItemType =
  | 'planner_task'
  | 'note'
  | 'meeting'
  | 'deadline'
  | 'reminder'
  | 'follow_up'
  | 'interview'
  | 'holiday'
  | 'leave'
  | 'birthday'
  | 'custom';

export interface CalendarColours {
  bg: string;
  border: string;
  dot: string;
  hover: string;
  priorityBorder?: string | null;
  completed?: boolean;
  strikethrough?: boolean;
}

export interface CalendarItem {
  id: string;
  source: 'planner_task' | 'calendar_event' | 'calendar_note';
  type: CalendarItemType;
  planner_task_id?: number;
  event_id?: number;
  note_id?: number;
  title: string;
  description?: string | null;
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  all_day: boolean;
  status?: string;
  priority?: string;
  location?: string | null;
  plan_id?: number;
  plan_name?: string;
  bucket_id?: number;
  bucket_name?: string;
  assigned_to?: number;
  assignee_name?: string;
  is_pinned?: boolean;
  colours: CalendarColours;
}

export interface CalendarCategory {
  id: number;
  slug: string;
  name: string;
  bg: string;
  border: string;
  dot: string;
  hover: string;
}

export const EVENT_TYPE_LABELS: Record<CalendarItemType, string> = {
  planner_task: 'Planner Task',
  note: 'Note',
  meeting: 'Meeting',
  deadline: 'Deadline',
  reminder: 'Reminder',
  follow_up: 'Follow-up',
  interview: 'Interview',
  holiday: 'Holiday',
  leave: 'Leave',
  birthday: 'Birthday',
  custom: 'Custom Event',
};

export const DEFAULT_COLOURS: Record<string, CalendarColours> = {
  planner_task: { bg: '#3B82F6', border: '#2563EB', dot: '#3B82F6', hover: '#60A5FA' },
  note:         { bg: '#8B5CF6', border: '#7C3AED', dot: '#8B5CF6', hover: '#A78BFA' },
  meeting:      { bg: '#10B981', border: '#059669', dot: '#10B981', hover: '#34D399' },
  deadline:     { bg: '#EF4444', border: '#DC2626', dot: '#EF4444', hover: '#F87171' },
  reminder:     { bg: '#F97316', border: '#EA580C', dot: '#F97316', hover: '#FB923C' },
  follow_up:    { bg: '#EAB308', border: '#CA8A04', dot: '#EAB308', hover: '#FACC15' },
  interview:    { bg: '#06B6D4', border: '#0891B2', dot: '#06B6D4', hover: '#22D3EE' },
  holiday:      { bg: '#6366F1', border: '#4F46E5', dot: '#6366F1', hover: '#818CF8' },
  leave:        { bg: '#EC4899', border: '#DB2777', dot: '#EC4899', hover: '#F472B6' },
  birthday:     { bg: '#F472B6', border: '#EC4899', dot: '#F472B6', hover: '#F9A8D4' },
  custom:       { bg: '#64748B', border: '#475569', dot: '#64748B', hover: '#94A3B8' },
};

export const REMINDER_OPTIONS = [
  { value: '5min', label: '5 minutes before' },
  { value: '10min', label: '10 minutes before' },
  { value: '15min', label: '15 minutes before' },
  { value: '30min', label: '30 minutes before' },
  { value: '1hour', label: '1 hour before' },
  { value: '2hours', label: '2 hours before' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'next_week', label: 'Next week' },
];

export const MAX_VISIBLE_ITEMS = 3;

export function formatTime(time: string | null | undefined): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getMonthRange(date: Date): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toDateKey(start), end: toDateKey(end) };
}

export function getWeekRange(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toDateKey(start), end: toDateKey(end) };
}

export function getDayRange(date: Date): { start: string; end: string } {
  const key = toDateKey(date);
  return { start: key, end: key };
}

export function getAgendaRange(date: Date, days = 14): { start: string; end: string } {
  const end = new Date(date);
  end.setDate(end.getDate() + days);
  return { start: toDateKey(date), end: toDateKey(end) };
}
