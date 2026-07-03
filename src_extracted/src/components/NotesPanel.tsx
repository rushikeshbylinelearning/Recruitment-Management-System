import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface Note {
  id: number;
  candidate_id: string;
  author_id: number;
  author_name: string;
  author_role?: string | null;
  stage: string;
  interaction_type?: string;
  note_text: string;
  created_at: string;
}

interface NotesPanelProps {
  candidateId: string;
  candidateName?: string;
  isOpen: boolean;
  onClose: () => void;
}

const LONG_NOTE_THRESHOLD = 200;

function formatNoteDate(dateStr: string): { date: string; time: string } {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' });
  const year = d.getFullYear();
  const hh = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const hour12 = hh % 12 || 12;
  return {
    date: `${month} ${day}, ${year}`,
    time: `${hour12}:${mm} ${ampm}`,
  };
}

function getAuthorInitials(name: string): string {
  return (name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  '#dc2626', '#f59e0b', '#10b981', '#f97316',
  '#8b5cf6', '#ec4899', '#14b8a6', '#ef4444',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const NotesPanel: React.FC<NotesPanelProps> = ({ candidateId, candidateName, isOpen, onClose }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});
  const [visible, setVisible] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timelineEndRef = useRef<HTMLDivElement>(null);

  // Animate in/out
  useEffect(() => {
    if (isOpen) {
      // Small delay so CSS transition fires
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setNotes([]);
    setNoteText('');
    setError('');
    setSubmitError('');
    setExpandedNotes({});
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, candidateId]);

  const fetchNotes = async () => {
    // Validate UUID format before making the request
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!candidateId || !uuidRegex.test(candidateId)) {
      setError('Invalid candidate ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/candidates/${candidateId}/hr-notes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success && json.data?.notesByStage) {
        const notesByStage = json.data.notesByStage as Record<string, any[]>;
        const flattened: Note[] = Object.entries(notesByStage).flatMap(([stage, stageNotes]) =>
          (stageNotes || []).map((note) => ({
            id: note.id,
            candidate_id: candidateId,
            author_id: 0,
            author_name: note.author_name || 'Unknown',
            author_role: note.author_role || null,
            stage,
            interaction_type: note.interaction_type || 'General Note',
            note_text: note.note_text || '',
            created_at: note.created_at,
          }))
        );

        flattened.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setNotes(flattened);
      } else {
        setError(json.message || 'Failed to load notes.');
      }
    } catch {
      setError('Network error loading notes.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!noteText.trim()) {
      setSubmitError('Note cannot be empty.');
      textareaRef.current?.focus();
      return;
    }

    // Validate UUID format before submitting
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!candidateId || !uuidRegex.test(candidateId)) {
      setSubmitError('Invalid candidate ID');
      return;
    }

    setSubmitError('');
    setSubmitting(true);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/candidates/${candidateId}/hr-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          note_text: noteText.trim(),
          interaction_type: 'General Note',
        }),
      });
      const json = await res.json();
      if (json.success) {
        const createdNote: Note = {
          id: json.data.id,
          candidate_id: json.data.candidate_id || candidateId,
          author_id: json.data.author_id || 0,
          author_name: json.data.author_name || 'Unknown',
          author_role: json.data.author_role || null,
          stage: json.data.stage || 'Applied',
          interaction_type: json.data.interaction_type || 'General Note',
          note_text: json.data.note_text || noteText.trim(),
          created_at: json.data.created_at,
        };
        setNotes((prev) => [createdNote, ...prev]);
        setNoteText('');
        // Scroll to top (latest note)
        setTimeout(() => {
          timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      } else {
        setSubmitError(json.message || 'Failed to save note.');
      }
    } catch {
      setSubmitError('Network error saving note.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!isOpen && !visible) return null;

  const panel = (
    <>
      {/* Dim backdrop */}
      <div
        className="fixed inset-0 z-[9990]"
        style={{
          background: 'rgba(0,0,0,0.25)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 300ms ease',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel from LEFT */}
      <div
        role="dialog"
        aria-label="HR Notes"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          width: '380px',
          zIndex: 9991,
          transform: visible ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 300ms ease',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          boxShadow: '4px 0 32px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 20px 16px',
            borderBottom: '1px solid #f0f0f0',
            background: 'linear-gradient(135deg, #f8f7ff 0%, #fff 100%)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileText size={18} color="#fff" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.2 }}>
                  HR Notes
                </h2>
                {candidateName && (
                  <p style={{ margin: 0, fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {candidateName}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close notes panel"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 8,
                color: '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                transition: 'background 150ms, color 150ms',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6';
                (e.currentTarget as HTMLButtonElement).style.color = '#374151';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'none';
                (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af';
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Note count badge */}
          {!loading && (
            <div style={{ marginTop: 12 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#dc2626',
                  background: '#eef2ff',
                  padding: '3px 10px',
                  borderRadius: 20,
                }}
              >
                {notes.length} {notes.length === 1 ? 'note' : 'notes'}
              </span>
            </div>
          )}
        </div>

        {/* Timeline / Notes list */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
          }}
        >
          {/* Scroll anchor for latest note */}
          <div ref={timelineEndRef} />

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <Loader2 size={24} color="#dc2626" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}

          {error && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 10,
                padding: '12px 14px',
                fontSize: 13,
                color: '#dc2626',
              }}
            >
              {error}
            </div>
          )}

          {!loading && !error && notes.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileText size={24} color="#d1d5db" />
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
                No notes yet.
                <br />
                Add the first note below.
              </p>
            </div>
          )}

          {/* Timeline notes */}
          {notes.map((note, index) => {
            const { date, time } = formatNoteDate(note.created_at);
            const authorName = note.author_name || 'Unknown';
            const initials = getAuthorInitials(authorName);
            const avatarColor = getAvatarColor(authorName);
            const isLong = note.note_text.length > LONG_NOTE_THRESHOLD;
            const expanded = expandedNotes[note.id];
            const displayText =
              isLong && !expanded ? note.note_text.slice(0, LONG_NOTE_THRESHOLD) + '…' : note.note_text;
            const isLast = index === notes.length - 1;

            return (
              <div key={note.id} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                {/* Timeline line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  {/* Avatar */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: avatarColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: 4,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                    }}
                  >
                    {initials}
                  </div>
                  {/* Connector line */}
                  {!isLast && (
                    <div
                      style={{
                        width: 2,
                        flex: 1,
                        background: '#e5e7eb',
                        minHeight: 16,
                        marginTop: 4,
                        marginBottom: 4,
                        borderRadius: 2,
                      }}
                    />
                  )}
                </div>

                {/* Note content */}
                <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16, paddingTop: 4 }}>
                  {/* Author + timestamp */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{authorName}</span>
                    {note.author_role && (
                      <span
                        style={{
                          fontSize: 10,
                          color: '#b91c1c',
                          background: '#eef2ff',
                          borderRadius: 999,
                          padding: '1px 6px',
                          fontWeight: 600,
                        }}
                      >
                        {note.author_role}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: '#d1d5db' }}>•</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{date}</span>
                    <span style={{ fontSize: 10, color: '#d1d5db' }}>·</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{time}</span>
                  </div>

                  {/* Note card */}
                  <div
                    style={{
                      background: '#f9fafb',
                      border: '1px solid #f0f0f0',
                      borderRadius: 10,
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: 10,
                          color: '#dc2626',
                          background: '#eef2ff',
                          borderRadius: 999,
                          padding: '2px 8px',
                          fontWeight: 700,
                          letterSpacing: 0.2,
                        }}
                      >
                        {note.stage}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: '#374151',
                          background: '#f3f4f6',
                          borderRadius: 999,
                          padding: '2px 8px',
                          fontWeight: 600,
                        }}
                      >
                        {note.interaction_type || 'General Note'}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: '#374151',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {displayText}
                    </p>
                    {isLong && (
                      <button
                        onClick={() => toggleExpand(note.id)}
                        style={{
                          marginTop: 6,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          fontSize: 11,
                          color: '#dc2626',
                          fontWeight: 500,
                        }}
                      >
                        {expanded ? (
                          <><ChevronUp size={12} /> Show less</>
                        ) : (
                          <><ChevronDown size={12} /> Show more</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Note — sticky bottom */}
        <div
          style={{
            borderTop: '1px solid #f0f0f0',
            padding: '16px 20px',
            background: '#fff',
            flexShrink: 0,
          }}
        >
          <textarea
            ref={textareaRef}
            value={noteText}
            onChange={(e) => {
              setNoteText(e.target.value);
              if (submitError) setSubmitError('');
            }}
            onKeyDown={handleKeyDown}
            placeholder="Write a note… (Ctrl+Enter to submit)"
            rows={3}
            style={{
              width: '100%',
              fontSize: 13,
              border: `1.5px solid ${submitError ? '#f87171' : '#e5e7eb'}`,
              borderRadius: 10,
              padding: '10px 12px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              color: '#374151',
              background: '#fafafa',
              boxSizing: 'border-box',
              transition: 'border-color 150ms',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#dc2626';
              e.currentTarget.style.background = '#fff';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = submitError ? '#f87171' : '#e5e7eb';
              e.currentTarget.style.background = '#fafafa';
            }}
          />
          {submitError && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#ef4444' }}>{submitError}</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button
              onClick={handleSubmit}
              disabled={submitting || !noteText.trim()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 20px',
                background: submitting || !noteText.trim() ? '#c7d2fe' : '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: submitting || !noteText.trim() ? 'not-allowed' : 'pointer',
                transition: 'background 150ms, transform 100ms',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                if (!submitting && noteText.trim()) {
                  (e.currentTarget as HTMLButtonElement).style.background = '#b91c1c';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  submitting || !noteText.trim() ? '#c7d2fe' : '#dc2626';
                (e.currentTarget as HTMLButtonElement).style.transform = 'none';
              }}
            >
              {submitting ? (
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <FileText size={14} />
              )}
              {submitting ? 'Saving…' : 'Add Note'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );

  return ReactDOM.createPortal(panel, document.body);
};

export default NotesPanel;
