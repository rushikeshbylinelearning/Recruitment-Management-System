import '../styles/JobApplicantsModal.css';
import React, { useState, useEffect, useCallback } from 'react';
import { X, Calendar, Clock, User, Video, MapPin, FileText, Loader2 } from 'lucide-react';
import { Interview, InterviewFormPayload } from '../types/interview';
import { getNextSlot, formatTimeForInput } from '../utils/interviewUtils';

interface InterviewModalProps {
  candidate: { id: number | string; name: string; position?: string; job_role?: string } | null;
  isOpen: boolean;
  mode: 'schedule' | 'reschedule';
  existingInterview?: Interview;
  onSubmit: (data: InterviewFormPayload | null) => Promise<void>;
  onClose: () => void;
}

interface Interviewer {
  id: number;
  name: string;
  email: string;
}

// Generate time slots at 15-min and 30-min intervals from 09:00 to 18:00
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 9; hour <= 18; hour++) {
    for (const min of [0, 15, 30, 45]) {
      if (hour === 18 && min > 0) break;
      const hh = String(hour).padStart(2, '0');
      const mm = String(min).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

function getTodayString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function getDefaultTime(): string {
  const next = getNextSlot(new Date());
  return formatTimeForInput(next);
}

export default function InterviewModal({
  candidate,
  isOpen,
  mode,
  existingInterview,
  onSubmit,
  onClose,
}: InterviewModalProps) {
  const [interviewType, setInterviewType] = useState<'HR Round' | 'Technical' | 'Final'>('HR Round');
  const [interviewMode, setInterviewMode] = useState<'Virtual' | 'In-Person'>('Virtual');
  const [date, setDate] = useState(getTodayString());
  const [time, setTime] = useState(getDefaultTime());
  const [duration, setDuration] = useState(60);
  const [interviewerId, setInterviewerId] = useState<number | ''>('');
  const [meetingLink, setMeetingLink] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [loadingInterviewers, setLoadingInterviewers] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Visible state for animation
  const [visible, setVisible] = useState(false);

  // Fetch interviewers on mount
  useEffect(() => {
    if (!isOpen) return;
    setLoadingInterviewers(true);
    const token = localStorage.getItem('authToken') || localStorage.getItem('token') || '';
    fetch('/api/users?role=Interviewer', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        const raw = Array.isArray(data) ? data : (data.data?.users ?? data.data ?? data.users ?? []);
        const list: Interviewer[] = raw.filter((u: any) => u.role === 'Interviewer' || !u.role);
        setInterviewers(list);
        if (list.length > 0 && interviewerId === '') {
          setInterviewerId(list[0].id);
        }
      })
      .catch(() => {
        // non-blocking; leave list empty
      })
      .finally(() => setLoadingInterviewers(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Pre-fill from existingInterview when in reschedule mode
  useEffect(() => {
    if (mode === 'reschedule' && existingInterview) {
      setInterviewType(existingInterview.type);
      setInterviewMode(existingInterview.mode);
      setDate(existingInterview.date);
      // time may be 'HH:MM:SS' — trim to 'HH:MM'
      setTime(existingInterview.time.slice(0, 5));
      setDuration(existingInterview.duration);
      setInterviewerId(existingInterview.interviewer_id);
      setMeetingLink(existingInterview.meeting_link ?? '');
      setLocation(existingInterview.location ?? '');
      setNotes(existingInterview.notes ?? '');
    } else if (mode === 'schedule') {
      // Reset to defaults when opening in schedule mode
      setInterviewType('HR Round');
      setInterviewMode('Virtual');
      setDate(getTodayString());
      setTime(getDefaultTime());
      setDuration(60);
      setMeetingLink('');
      setLocation('');
      setNotes('');
      setError(null);
    }
  }, [mode, existingInterview, isOpen]);

  // Animate in/out
  useEffect(() => {
    if (isOpen) {
      // Small delay so the initial opacity-0/scale-95 is painted first
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side: date+time must not be in the past
    const selectedDateTime = new Date(`${date}T${time}`);
    if (selectedDateTime <= new Date()) {
      setError('Interview must be scheduled in the future');
      return;
    }

    if (!interviewerId) {
      setError('Please select an interviewer');
      return;
    }

    const role = candidate?.job_role ?? candidate?.position ?? '';

    const payload: InterviewFormPayload = {
      candidate_id: candidate!.id,
      job_role: role,
      interviewer_id: Number(interviewerId),
      date,
      time,
      duration,
      type: interviewType,
      mode: interviewMode,
      ...(interviewMode === 'Virtual' && meetingLink ? { meeting_link: meetingLink } : {}),
      ...(interviewMode === 'In-Person' && location ? { location } : {}),
      ...(notes ? { notes } : {}),
    };

    setLoading(true);
    try {
      await onSubmit(payload);
    } catch (err: any) {
      const body = err?.response ?? err;
      if (body?.error === 'CONFLICT') {
        const d = body.conflictingDate ?? '';
        const t = body.conflictingTime ?? '';
        setError(`Conflict: interviewer already booked on ${d} at ${t}`);
      } else {
        setError('Failed to schedule interview. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const title = mode === 'reschedule' ? 'Reschedule Interview' : 'Schedule Interview';
  const submitLabel = mode === 'reschedule' ? 'Reschedule' : 'Schedule';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className={`shared-modal-shell transition-all duration-200 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      >
        {/* Header */}
        <div className="shared-modal-header">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Calendar size={18} className="text-indigo-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="shared-modal-form-body space-y-5">

          {/* Candidate info — read-only */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                Candidate Name
              </label>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700">
                <User size={14} className="text-gray-400 shrink-0" />
                <span className="truncate">{candidate?.name ?? '—'}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                Role
              </label>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700">
                <FileText size={14} className="text-gray-400 shrink-0" />
                <span className="truncate">{candidate?.job_role ?? candidate?.position ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Interview Type + Mode */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                Interview Type <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={interviewType}
                onChange={(e) => setInterviewType(e.target.value as typeof interviewType)}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
              >
                <option value="HR Round">HR Round</option>
                <option value="Technical">Technical</option>
                <option value="Final">Final</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                Interview Mode <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={interviewMode}
                onChange={(e) => setInterviewMode(e.target.value as typeof interviewMode)}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
              >
                <option value="Virtual">Virtual</option>
                <option value="In-Person">In-Person</option>
              </select>
            </div>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                <span className="flex items-center gap-1">
                  <Calendar size={12} /> Date <span className="text-red-400">*</span>
                </span>
              </label>
              <input
                type="date"
                required
                min={getTodayString()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                <span className="flex items-center gap-1">
                  <Clock size={12} /> Time <span className="text-red-400">*</span>
                </span>
              </label>
              <select
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Duration + Interviewer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                Duration <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
              >
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={90}>90 minutes</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                Interviewer <span className="text-red-400">*</span>
              </label>
              {loadingInterviewers ? (
                <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-400">
                  <Loader2 size={14} className="animate-spin" /> Loading…
                </div>
              ) : (
                <select
                  required
                  value={interviewerId}
                  onChange={(e) => setInterviewerId(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                >
                  <option value="">Select interviewer</option>
                  {interviewers.map((iv) => (
                    <option key={iv.id} value={iv.id}>
                      {iv.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Dynamic field: Meeting Link or Location */}
          {interviewMode === 'Virtual' ? (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                <span className="flex items-center gap-1">
                  <Video size={12} /> Meeting Link
                </span>
              </label>
              <input
                type="url"
                placeholder="https://meet.google.com/..."
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
                <span className="flex items-center gap-1">
                  <MapPin size={12} /> Location
                </span>
              </label>
              <input
                type="text"
                placeholder="Office address or room number"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              Notes (optional)
            </label>
            <textarea
              rows={3}
              placeholder="Any additional context for the interviewer…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow resize-none"
            />
          </div>

          {/* Inline error */}
          {error && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>{error}</span>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="shared-modal-footer">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => onSubmit(null as any)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Skip Interview
            </button>
            <button
              type="submit"
              form="interview-modal-form"
              disabled={loading}
              onClick={handleSubmit}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}