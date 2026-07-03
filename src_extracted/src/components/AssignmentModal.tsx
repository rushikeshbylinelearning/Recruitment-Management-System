import '../styles/JobApplicantsModal.css';
import React, { useState, useEffect, useCallback } from 'react';
import { X, FileText, Calendar, Clock, Link, Mail, Bell, ChevronDown, Loader2 } from 'lucide-react';

interface AssignmentModalProps {
  candidate: { id: number | string; name: string; email?: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: any | null) => void;
}

interface AssignmentOption {
  id: number;
  title: string;
  description?: string;
}

const DEFAULT_EMAIL_TEMPLATE = `Dear {{candidate_name}},

We are reviewing your application. As part of the next step, please complete the assignment below.

Submission Link: {{submission_link}}
Deadline: {{deadline}}

Note: This link will expire in {{expiry_warning}}.

Best regards,
HR Team`;

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getDefaultTime(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

function getToken(): string {
  return localStorage.getItem('authToken') || localStorage.getItem('token') || '';
}

export default function AssignmentModal({
  candidate,
  isOpen,
  onClose,
  onSubmit,
}: AssignmentModalProps) {
  // Assignments list
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Form state
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<number[]>([]);
  const [deadlineDate, setDeadlineDate] = useState(getTodayString());
  const [deadlineTime, setDeadlineTime] = useState(getDefaultTime());
  const [expiryOption, setExpiryOption] = useState<'24' | '48' | '72' | 'custom'>('24');
  const [customExpiryHours, setCustomExpiryHours] = useState('');
  const [emailBody, setEmailBody] = useState(DEFAULT_EMAIL_TEMPLATE);
  const [customSlug, setCustomSlug] = useState('');
  const [notifyDeadline, setNotifyDeadline] = useState(true);
  const [notifyExpiry, setNotifyExpiry] = useState(true);
  const [notifySubmission, setNotifySubmission] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  // Animate in/out
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setSelectedAssignmentIds([]);
      setDeadlineDate(getTodayString());
      setDeadlineTime(getDefaultTime());
      setExpiryOption('24');
      setCustomExpiryHours('');
      setEmailBody(DEFAULT_EMAIL_TEMPLATE);
      setCustomSlug('');
      setNotifyDeadline(true);
      setNotifyExpiry(true);
      setNotifySubmission(true);
      setAutoAdvance(false);
      setErrors({});
      setDropdownOpen(false);
    }
  }, [isOpen]);

  // Fetch active assignments on open
  useEffect(() => {
    if (!isOpen) return;
    setLoadingAssignments(true);
    const token = getToken();
    fetch('/api/assignments?is_active=1', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        const raw = Array.isArray(data)
          ? data
          : (data.data?.assignments ?? data.data ?? data.assignments ?? []);
        setAssignments(raw);
      })
      .catch(() => setAssignments([]))
      .finally(() => setLoadingAssignments(false));
  }, [isOpen]);

  const toggleAssignment = (id: number) => {
    setSelectedAssignmentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setErrors((e) => ({ ...e, assignments: '' }));
  };

  const getExpiryHours = (): number => {
    if (expiryOption === 'custom') return parseInt(customExpiryHours, 10) || 0;
    return parseInt(expiryOption, 10);
  };

  const submissionLinkPreview = candidate
    ? `/submit-assignment/${candidate.id}/${customSlug || '{token}'}`
    : '';

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (selectedAssignmentIds.length === 0) {
      newErrors.assignments = 'Please select at least one assignment.';
    }
    if (!deadlineDate || !deadlineTime) {
      newErrors.deadline = 'Please set a deadline date and time.';
    }
    const expiryHours = getExpiryHours();
    if (expiryOption === 'custom' && (!customExpiryHours || expiryHours <= 0)) {
      newErrors.expiry = 'Please enter a valid custom expiry duration (hours > 0).';
    } else if (expiryHours <= 0) {
      newErrors.expiry = 'Please select an expiry duration.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const deadline = `${deadlineDate}T${deadlineTime}:00`;
    const expiryDuration = getExpiryHours();

    const payload = {
      candidateId: candidate!.id,
      assignmentIds: selectedAssignmentIds,
      deadline,
      expiryDuration,
      emailBody,
      ...(customSlug ? { customSlug } : {}),
      singleUse: true,
      notifications: {
        deadlineReminder: notifyDeadline,
        expiryWarning: notifyExpiry,
        submissionAlert: notifySubmission,
      },
      autoAdvance,
    };

    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch('/api/candidate-assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body?.message || body?.error || 'Failed to dispatch assignment. Please try again.';
        setErrors((e) => ({ ...e, submit: msg }));
        return;
      }

      onSubmit(payload);
    } catch {
      setErrors((e) => ({ ...e, submit: 'Network error. Please try again.' }));
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  if (!isOpen) return null;

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
              <FileText size={18} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Send Assignment</h2>
              {candidate && (
                <p className="text-xs text-gray-500 mt-0.5">{candidate.name}</p>
              )}
            </div>
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

          {/* Assignment multi-select */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              Assignments <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen((o) => !o)}
                className={`w-full flex items-center justify-between px-3 py-2.5 bg-white border rounded-xl text-sm text-left transition-shadow focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.assignments ? 'border-red-400' : 'border-gray-200'
                }`}
              >
                <span className={selectedAssignmentIds.length === 0 ? 'text-gray-400' : 'text-gray-800'}>
                  {loadingAssignments
                    ? 'Loading assignments…'
                    : selectedAssignmentIds.length === 0
                    ? 'Select assignments…'
                    : `${selectedAssignmentIds.length} selected`}
                </span>
                {loadingAssignments ? (
                  <Loader2 size={14} className="animate-spin text-gray-400" />
                ) : (
                  <ChevronDown size={14} className="text-gray-400" />
                )}
              </button>

              {dropdownOpen && !loadingAssignments && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {assignments.length === 0 ? (
                    <div className="px-3 py-2.5 text-sm text-gray-400">No active assignments found.</div>
                  ) : (
                    assignments.map((a) => (
                      <label
                        key={a.id}
                        className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-indigo-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAssignmentIds.includes(a.id)}
                          onChange={() => toggleAssignment(a.id)}
                          className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-800">{a.title}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
            {errors.assignments && (
              <p className="mt-1 text-xs text-red-500">{errors.assignments}</p>
            )}
          </div>

          {/* Deadline date + time */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              <span className="flex items-center gap-1">
                <Calendar size={12} /> Deadline <span className="text-red-400">*</span>
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                min={getTodayString()}
                value={deadlineDate}
                onChange={(e) => {
                  setDeadlineDate(e.target.value);
                  setErrors((er) => ({ ...er, deadline: '' }));
                }}
                className={`w-full px-3 py-2.5 bg-white border rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow ${
                  errors.deadline ? 'border-red-400' : 'border-gray-200'
                }`}
              />
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-gray-400 shrink-0" />
                <input
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => {
                    setDeadlineTime(e.target.value);
                    setErrors((er) => ({ ...er, deadline: '' }));
                  }}
                  className={`w-full px-3 py-2.5 bg-white border rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow ${
                    errors.deadline ? 'border-red-400' : 'border-gray-200'
                  }`}
                />
              </div>
            </div>
            {errors.deadline && (
              <p className="mt-1 text-xs text-red-500">{errors.deadline}</p>
            )}
          </div>

          {/* Expiry duration */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              Expiry Duration <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {(['24', '48', '72'] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setExpiryOption(h);
                    setErrors((er) => ({ ...er, expiry: '' }));
                  }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    expiryOption === h
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {h}h
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setExpiryOption('custom');
                  setErrors((er) => ({ ...er, expiry: '' }));
                }}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  expiryOption === 'custom'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                }`}
              >
                Custom
              </button>
              {expiryOption === 'custom' && (
                <input
                  type="number"
                  min="1"
                  placeholder="Hours"
                  value={customExpiryHours}
                  onChange={(e) => {
                    setCustomExpiryHours(e.target.value);
                    setErrors((er) => ({ ...er, expiry: '' }));
                  }}
                  className={`w-28 px-3 py-2 bg-white border rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow ${
                    errors.expiry ? 'border-red-400' : 'border-gray-200'
                  }`}
                />
              )}
            </div>
            {errors.expiry && (
              <p className="mt-1 text-xs text-red-500">{errors.expiry}</p>
            )}
          </div>

          {/* Submission link preview */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              <span className="flex items-center gap-1">
                <Link size={12} /> Submission Link Preview
              </span>
            </label>
            <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 font-mono break-all select-all">
              {submissionLinkPreview}
            </div>
          </div>

          {/* Custom slug */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              Custom Slug (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. frontend-task-2024"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value.replace(/\s+/g, '-').toLowerCase())}
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
            />
          </div>

          {/* Email body */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              <span className="flex items-center gap-1">
                <Mail size={12} /> Email Body
              </span>
            </label>
            <textarea
              rows={8}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow resize-none"
            />
            <p className="mt-1 text-xs text-gray-400">
              Variables: {'{{candidate_name}}'}, {'{{submission_link}}'}, {'{{deadline}}'}, {'{{expiry_warning}}'}
            </p>
          </div>

          {/* Notification toggles */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
              <span className="flex items-center gap-1">
                <Bell size={12} /> Notifications
              </span>
            </label>
            <div className="space-y-2">
              {[
                { key: 'deadline', label: 'Deadline reminder (24h before)', value: notifyDeadline, set: setNotifyDeadline },
                { key: 'expiry', label: 'Expiry warning (2h before link expires)', value: notifyExpiry, set: setNotifyExpiry },
                { key: 'submission', label: 'Submission alert (notify HR on submit)', value: notifySubmission, set: setNotifySubmission },
              ].map(({ key, label, value, set }) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => set(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Auto-advance toggle */}
          <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl">
            <div>
              <p className="text-sm font-medium text-gray-800">Auto-advance on submission</p>
              <p className="text-xs text-gray-500 mt-0.5">Automatically move candidate to next stage when they submit</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => setAutoAdvance(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
            </label>
          </div>

          {/* Submit error */}
          {errors.submit && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>{errors.submit}</span>
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
              onClick={() => onSubmit(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Skip Assignment
            </button>
            <button
              type="submit"
              disabled={loading}
              onClick={handleSubmit}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Send Assignment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}