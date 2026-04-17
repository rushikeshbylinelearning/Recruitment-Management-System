import { memo, useCallback, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Mail, Phone, MoreVertical, Eye, Edit, Trash2, Download, MapPin, Briefcase, Pencil } from 'lucide-react';
import { Candidate as ApiCandidate } from '../../services/api';

interface CandidateCardProps {
  candidate: ApiCandidate;
  accentColor: string;
  onClick: (candidate: ApiCandidate) => void;
  onEdit: (candidate: ApiCandidate) => void;
  onDelete: (candidateId: string) => void;
  onDownloadResume: (candidateId: string) => void;
  onOpenNotes?: (candidate: ApiCandidate) => void;
  hasEditPermission: boolean;
  hasDeletePermission: boolean;
  isDragging?: boolean;
  isSyncing?: boolean;
  assignmentStatus?: string;
  assignmentDeadline?: string;
  emailFailed?: boolean;
}

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

const toTitleCase = (value: string): string =>
  normalizeWhitespace(value)
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');

const toCapitalizedWords = (value: string): string =>
  normalizeWhitespace(value)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const formatExperience = (experience?: string): string | null => {
  if (!experience) return null;
  const normalized = normalizeWhitespace(experience);
  if (!normalized) return null;

  if (/[a-zA-Z]/.test(normalized)) {
    return toTitleCase(normalized);
  }

  const numeric = Number(normalized);
  if (Number.isNaN(numeric)) return normalized;
  return `${numeric} yrs`;
};

const CandidateCard = memo(
  function CandidateCard({
    candidate,
    accentColor,
    onClick,
    onEdit,
    onDelete,
    onDownloadResume,
    onOpenNotes,
    hasEditPermission,
    hasDeletePermission,
    isDragging = false,
    isSyncing = false,
    assignmentStatus,
    assignmentDeadline,
    emailFailed = false,
  }: CandidateCardProps) {
    const [menuOpen, setMenuOpen] = useState(false);

    // Drag is a stage-change interaction. If the user lacks edit permission, keep drag disabled.
    const canDrag = hasEditPermission;

    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      isDragging: isBeingDragged,
    } = useDraggable({
      id: `candidate-${candidate.id}`,
      data: {
        candidateId: candidate.id,
        stage: candidate.stage,
      },
      disabled: !canDrag,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      // Only animate during actual drag — never on click/re-render
      transition: isBeingDragged ? 'none' : undefined,
      // will-change only while actively dragging to avoid compositing jitter on click
      willChange: isBeingDragged ? 'transform' : undefined,
      opacity: isBeingDragged ? 0.35 : isSyncing ? 0.7 : 1,
      cursor: canDrag ? (isBeingDragged ? 'grabbing' : 'grab') : 'pointer',
    };

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        if (!isBeingDragged) onClick(candidate);
      },
      [candidate, onClick, isBeingDragged]
    );

    const handleView = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        onClick(candidate);
      },
      [candidate, onClick]
    );

    const handleEdit = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        onEdit(candidate);
      },
      [candidate, onEdit]
    );

    const handleDelete = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        onDelete(candidate.id);
      },
      [candidate.id, onDelete]
    );

    const handleDownload = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        onDownloadResume(candidate.id);
      },
      [candidate.id, onDownloadResume]
    );

    // Touch event handlers for mobile
    const handleTouchStart = useCallback(() => {}, []);

    const handleTouchMove = useCallback(
      (e: React.TouchEvent) => {
        if (isBeingDragged) {
          // Prevent page scroll during drag
          e.preventDefault();
        }
      },
      [isBeingDragged]
    );

    const formattedName = toTitleCase(candidate.name || 'Unnamed Candidate');
    const formattedRole = toTitleCase(candidate.position || 'Role Not Specified');
    const formattedEmail = normalizeWhitespace(candidate.email || '').toLowerCase();
    const formattedPhone = normalizeWhitespace(candidate.phone || '');
    const formattedLocation = candidate.location ? toTitleCase(candidate.location) : '';
    const formattedSource = toCapitalizedWords(candidate.source || 'Manual Entry');
    const formattedExperience = formatExperience(candidate.experience);
    const isImmediate = Boolean(candidate.availability?.immediateJoiner);
    const primaryContact = formattedEmail || formattedPhone;
    const contactIcon = formattedEmail ? Mail : Phone;
    const ContactIcon = contactIcon;
    const score = Number(candidate.score);

    const assignmentBadgeStyle: Record<string, string> = {
      Assigned: 'bg-amber-100 text-amber-700',
      Submitted: 'bg-green-100 text-green-700',
      Overdue: 'bg-red-100 text-red-700',
      'Ready for Review': 'bg-blue-100 text-blue-700',
    };

    const initials = formattedName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...(canDrag ? listeners : {})}
        {...(canDrag ? attributes : {})}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className={`group relative bg-white rounded-[10px] border border-gray-200 touch-none select-none candidate-card ${
          isBeingDragged
            ? 'scale-95 shadow-none opacity-35'
            : ''
        } ${isDragging && !isBeingDragged ? 'scale-[1.02] border-blue-600' : ''} ${
          !canDrag ? 'opacity-50' : ''
        }`}
        onClick={handleClick}
        role="button"
        aria-label={`${formattedName}, ${formattedRole}, ${candidate.stage}`}
        aria-grabbed={isBeingDragged}
        tabIndex={0}
      >
        <div className="p-3.5">
          {/* Top row: avatar + name + menu */}
          <div className="flex items-start gap-2 mb-2">
            {/* Plain avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-gray-900 truncate leading-tight">
                {formattedName}
              </p>
              <p className="text-xs text-gray-500 truncate leading-tight">
                {formattedRole}
              </p>
            </div>
            {/* 3-dot menu */}
            <div className="relative flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
                className="p-1 rounded-md text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Open menu"
              >
                <MoreVertical size={14} />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-6 z-50 bg-white rounded-lg shadow-xl border border-gray-100 py-1 min-w-[140px]"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <button
                    onClick={handleView}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                  >
                    <Eye size={13} /> View Profile
                  </button>
                  {hasEditPermission && (
                    <button
                      onClick={handleEdit}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                    >
                      <Edit size={13} /> Edit
                    </button>
                  )}
                  {'resumeFileId' in (candidate as unknown as Record<string, unknown>) && Boolean((candidate as unknown as Record<string, unknown>).resumeFileId) && (
                    <button
                      onClick={handleDownload}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                    >
                      <Download size={13} /> Resume
                    </button>
                  )}
                  {hasDeletePermission && (
                    <>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={handleDelete}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Key info row: email/phone, location, experience */}
          <div className="space-y-1.5 mb-2">
            {primaryContact && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <ContactIcon size={11} className="flex-shrink-0 text-gray-400" />
                <span className="truncate">{primaryContact}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {formattedLocation && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin size={11} className="flex-shrink-0 text-gray-400" />
                  <span className="truncate max-w-[100px]">{formattedLocation}</span>
                </span>
              )}
              {formattedExperience && (
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase size={11} className="flex-shrink-0 text-gray-400" />
                  <span className="truncate">{formattedExperience}</span>
                </span>
              )}
            </div>
          </div>

          {/* Status tags: max 2 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium truncate max-w-[120px]">
              {formattedSource}
            </span>
            {isImmediate && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                Immediate
              </span>
            )}
          </div>

          {/* Assignment status badge */}
          {assignmentStatus && assignmentBadgeStyle[assignmentStatus] && (
            <div className="mt-1.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${assignmentBadgeStyle[assignmentStatus]}`}>
                {assignmentStatus}
              </span>
              {emailFailed && (
                <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
                  Email Failed
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3.5 py-2 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {new Date(candidate.appliedDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <div className="flex items-center gap-2">
            {assignmentDeadline && (
              <span className="text-xs text-amber-600 font-medium">
                Due {new Date(assignmentDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
            {Number.isFinite(score) && score > 0 && (
              <span className="text-xs text-gray-600 font-medium">
                Score {score}
              </span>
            )}
            {/* Floating pencil — HR Notes */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenNotes?.(candidate);
              }}
              aria-label="Add/View Notes"
              title="Add / View Notes"
              className="opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center justify-center rounded-full"
              style={{
                width: 26,
                height: 26,
                background: '#6366f1',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
                flexShrink: 0,
                transform: 'scale(1)',
                transition: 'opacity 150ms ease, transform 150ms ease, box-shadow 150ms ease',
              }}
              onMouseEnter={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.transform = 'scale(1.08)';
                b.style.boxShadow = '0 4px 12px rgba(99,102,241,0.55)';
              }}
              onMouseLeave={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.transform = 'scale(1)';
                b.style.boxShadow = '0 2px 8px rgba(99,102,241,0.4)';
              }}
              onMouseDown={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.92)';
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)';
              }}
            >
              <Pencil size={12} color="#fff" />
            </button>
          </div>
        </div>

        {/* Loading overlay for syncing */}
        {isSyncing && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] rounded-lg flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Screen reader instructions */}
        <div id={`card-instructions-${candidate.id}`} className="sr-only">
          Press space to pick up this card, use arrow keys to move, space to drop, escape to
          cancel
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.candidate.id === next.candidate.id &&
    prev.candidate.stage === next.candidate.stage &&
    prev.candidate.name === next.candidate.name &&
    prev.candidate.email === next.candidate.email &&
    prev.candidate.phone === next.candidate.phone &&
    prev.candidate.position === next.candidate.position &&
    prev.candidate.source === next.candidate.source &&
    prev.candidate.appliedDate === next.candidate.appliedDate &&
    prev.candidate.latestInterviewDate === next.candidate.latestInterviewDate &&
    prev.candidate.interviews?.length === next.candidate.interviews?.length &&
    prev.accentColor === next.accentColor &&
    prev.hasEditPermission === next.hasEditPermission &&
    prev.hasDeletePermission === next.hasDeletePermission &&
    prev.isDragging === next.isDragging &&
    prev.isSyncing === next.isSyncing &&
    prev.assignmentStatus === next.assignmentStatus &&
    prev.assignmentDeadline === next.assignmentDeadline &&
    prev.emailFailed === next.emailFailed &&
    prev.onOpenNotes === next.onOpenNotes
);

export default CandidateCard;
