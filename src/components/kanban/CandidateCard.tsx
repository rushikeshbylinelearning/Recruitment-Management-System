import { memo, useCallback, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Mail, Phone, MoreVertical, MapPin, Briefcase, Pencil, Check, Trash2 } from 'lucide-react';
import { Candidate as ApiCandidate } from '../../services/api';
import {
  getInterviewSubStageMenuLabel,
  getKanbanColumnForCandidate,
  INTERVIEW_KANBAN_SUB_STAGES,
  isInterviewKanbanSubStage,
} from '../../utils/candidateStage';

const formatViewedTime = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

interface CandidateCardProps {
  candidate: ApiCandidate;
  accentColor: string;
  onClick: (candidate: ApiCandidate) => void;
  onEdit: (candidate: ApiCandidate) => void;
  onDelete: (candidateId: string) => void;
  onDownloadResume: (candidateId: string) => void;
  onOpenNotes?: (candidate: ApiCandidate) => void;
  onStageChange?: (candidateId: string, newStage: string) => void;
  availableStages?: string[];
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
    onStageChange,
    availableStages = [],
    hasEditPermission,
    hasDeletePermission,
    isDragging = false,
    isSyncing = false,
    assignmentStatus,
    assignmentDeadline,
    emailFailed = false,
  }: CandidateCardProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [hovered, setHovered] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

    const isAppliedStage = candidate.stage === 'Applied';
    const tracksCardView = Boolean(candidate.tracksCardView);
    const isUnviewed = isAppliedStage && tracksCardView && candidate.isViewed === false;
    const isFlaggedDuplicate = Boolean(candidate.isFlaggedDuplicate);
    const hasMergedApplications = Boolean(candidate.hasMergedApplications);

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

    const handleStageSelect = useCallback(
      (e: React.MouseEvent, newStage: string) => {
        e.stopPropagation();
        setMenuOpen(false);
        
        // Don't move if already in this kanban column (includes interview sub-stages)
        if (newStage === getKanbanColumnForCandidate(candidate)) return;
        
        // Call the stage change handler
        if (onStageChange) {
          onStageChange(candidate.id, newStage);
        }
      },
      [candidate.id, candidate.stage, onStageChange]
    );

    // Calculate menu position when opening
    useEffect(() => {
      if (menuOpen && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setMenuPosition({
          top: rect.bottom + 4, // 4px gap below button
          left: rect.right - 180, // Align right edge (180px is menu width)
        });
      } else {
        setMenuPosition(null);
      }
    }, [menuOpen]);

    // Close menu when clicking outside
    useEffect(() => {
      if (!menuOpen) return;

      const handleClickOutside = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          setMenuOpen(false);
        }
      };

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setMenuOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }, [menuOpen]);

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

    const lastOpenedHint =
      tracksCardView && candidate.lastViewedBy && candidate.lastViewedAt
        ? `${candidate.lastViewedBy} · ${formatViewedTime(candidate.lastViewedAt)}`
        : tracksCardView
          ? candidate.lastViewedBy || null
          : null;

    const handleDeleteClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        if (window.confirm(`Delete ${formattedName}? This cannot be undone.`)) {
          onDelete(candidate.id);
        }
      },
      [candidate.id, formattedName, onDelete]
    );

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...(canDrag ? listeners : {})}
        {...(canDrag ? attributes : {})}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`group relative rounded-[10px] border touch-none select-none candidate-card ${
          isFlaggedDuplicate
            ? 'candidate-card--duplicate border-red-900 bg-red-50/90 ring-1 ring-red-400/60 shadow-sm'
            : isUnviewed
              ? 'candidate-card--unviewed border-indigo-300 bg-indigo-50/40'
              : 'bg-white border-gray-200'
        } ${
          isBeingDragged
            ? 'scale-95 shadow-none opacity-35'
            : ''
        } ${isDragging && !isBeingDragged ? 'scale-[1.02] border-blue-600' : ''} ${
          !canDrag ? 'opacity-50' : ''
        }`}
        onClick={handleClick}
        role="button"
        aria-label={`${formattedName}, ${formattedRole}, ${candidate.stage}${isUnviewed ? ', new application' : ''}`}
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
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-[14px] font-semibold text-gray-900 truncate leading-tight">
                  {formattedName}
                </p>
                {hasMergedApplications && (
                  <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-700 text-white">
                    Merged
                  </span>
                )}
                {isFlaggedDuplicate && (
                  <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-red-900 text-white">
                    Duplicate
                  </span>
                )}
                {isUnviewed && !isFlaggedDuplicate && !hasMergedApplications && (
                  <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-indigo-600 text-white">
                    New
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate leading-tight">
                {formattedRole}
              </p>
            </div>
            {/* 3-dot menu — move, delete (admin) */}
            {(hasEditPermission && availableStages.length > 0) || hasDeletePermission ? (
              <div className="relative flex-shrink-0">
                <button
                  ref={buttonRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((v) => !v);
                  }}
                  className="p-1 rounded-md text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
                  aria-label="Card actions"
                  aria-expanded={menuOpen}
                >
                  <MoreVertical size={14} />
                </button>
                {menuOpen && menuPosition && createPortal(
                  <>
                    {/* Backdrop for click outside */}
                    <div 
                      className="fixed inset-0 z-[9998]" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                      }}
                    />
                    {/* Dropdown Menu */}
                    <div
                      ref={menuRef}
                      className="fixed z-[9999] bg-white rounded-lg shadow-2xl border border-gray-200 py-1.5 min-w-[180px] max-h-[320px] overflow-y-auto animate-fade-in"
                      style={{
                        top: `${menuPosition.top}px`,
                        left: `${menuPosition.left}px`,
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-3 py-1.5 border-b border-gray-200">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          {hasEditPermission && availableStages.length > 0 ? 'Move To' : 'Actions'}
                        </p>
                      </div>

                      {/* Stage Options */}
                      {hasEditPermission && availableStages.length > 0 && (
                      <div className="py-1">
                        {availableStages.map((stage) => {
                          const interviewSubLabel = getInterviewSubStageMenuLabel(candidate);
                          const isCurrentStage =
                            stage === getKanbanColumnForCandidate(candidate) ||
                            (isInterviewKanbanSubStage(stage) &&
                              INTERVIEW_KANBAN_SUB_STAGES[stage]?.subStage === candidate.subStage) ||
                            (interviewSubLabel !== null && stage === interviewSubLabel);
                          
                          // Determine if this is a sub-stage (indented)
                          const isSubStage = [
                            'Follow Up (Interview)',
                            'Came Down',
                            'Didn\'t Come',
                            'Selected (Interview)',
                            'Rejected (Interview)',
                            'On Hold',
                            'Profile Not Matched',
                            'Last Minute Back Out'
                          ].includes(stage);
                          
                          // Add separator before umbrella groups
                          const showSeparatorBefore = 
                            stage === 'Follow Up (Interview)' || 
                            stage === 'On Hold';
                          
                          return (
                            <div key={stage}>
                              {showSeparatorBefore && (
                                <div className="my-1 border-t border-gray-200" />
                              )}
                              <button
                                onClick={(e) => handleStageSelect(e, stage)}
                                disabled={isCurrentStage}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors text-left ${
                                  isSubStage ? 'pl-6' : ''
                                } ${
                                  isCurrentStage
                                    ? 'bg-indigo-50 text-indigo-700 font-semibold cursor-default'
                                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 cursor-pointer'
                                }`}
                                aria-current={isCurrentStage ? 'true' : undefined}
                              >
                                <span className="truncate flex items-center gap-1.5">
                                  {isSubStage && (
                                    <span className="text-gray-400 text-xs">└</span>
                                  )}
                                  {stage}
                                </span>
                                {isCurrentStage && (
                                  <Check size={16} className="flex-shrink-0 text-indigo-600" strokeWidth={2.5} />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      )}

                      {hasDeletePermission && (
                        <>
                          {hasEditPermission && availableStages.length > 0 && (
                            <div className="my-1 border-t border-gray-200" />
                          )}
                          <button
                            type="button"
                            onClick={handleDeleteClick}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                          >
                            <Trash2 size={14} className="flex-shrink-0" />
                            Delete candidate
                          </button>
                        </>
                      )}
                    </div>
                  </>,
                  document.body
                )}
              </div>
            ) : null}
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
        <div className="px-3.5 py-2 border-t border-gray-100 flex items-center justify-between gap-2">
          {isAppliedStage && tracksCardView && hovered && lastOpenedHint ? (
            <span className="text-[11px] text-gray-500 truncate min-w-0" title={lastOpenedHint}>
              {lastOpenedHint}
            </span>
          ) : (
            <span className="text-xs text-gray-400 flex-shrink-0">
              {new Date(candidate.appliedDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
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
                background: '#dc2626',
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
    prev.candidate.createdAt === next.candidate.createdAt &&
    prev.candidate.tracksCardView === next.candidate.tracksCardView &&
    prev.candidate.isViewed === next.candidate.isViewed &&
    prev.candidate.lastViewedBy === next.candidate.lastViewedBy &&
    prev.candidate.lastViewedAt === next.candidate.lastViewedAt &&
    prev.candidate.isFlaggedDuplicate === next.candidate.isFlaggedDuplicate &&
    prev.candidate.hasMergedApplications === next.candidate.hasMergedApplications &&
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
