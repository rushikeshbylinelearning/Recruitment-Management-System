import type { RefObject } from 'react';
import { AlertTriangle, Eye } from 'lucide-react';

export interface DuplicateMatch {
  id: string;
  name: string;
  email?: string;
  position?: string;
  stage: string;
}

interface DuplicateCandidatesAlertProps {
  checking: boolean;
  matches: DuplicateMatch[];
  formName: string;
  formEmail: string;
  viewLoadingId: string | null;
  canViewCandidate: (id: string) => boolean;
  onViewCandidate: (id: string) => void;
  onContinueAnyway: () => void;
  onReviewCandidates: () => void;
  alertRef?: RefObject<HTMLDivElement | null>;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function firstEmail(value: string): string {
  return value.split(',')[0].trim().toLowerCase();
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
}

function getMatchDetails(
  formName: string,
  formEmail: string,
  match: DuplicateMatch
): { matchedBy: string; nameMatch: boolean; emailMatch: boolean } {
  const nameMatch =
    Boolean(formName.trim()) &&
    normalizeName(formName) === normalizeName(match.name || '');
  const emailMatch =
    Boolean(formEmail.trim()) &&
    Boolean(match.email?.trim()) &&
    firstEmail(formEmail) === firstEmail(match.email || '');

  let matchedBy = 'Profile';
  if (nameMatch && emailMatch) matchedBy = 'Name & Email';
  else if (emailMatch) matchedBy = 'Email';
  else if (nameMatch) matchedBy = 'Name';

  return { matchedBy, nameMatch, emailMatch };
}

function stageBadgeClass(stage: string): string {
  const s = stage.toLowerCase();
  if (s === 'hired' || s === 'selected (interview)') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200/80';
  }
  if (s === 'rejected' || s.includes('rejected')) {
    return 'bg-rose-50 text-rose-700 ring-rose-200/80';
  }
  if (s === 'offer' || s === 'interview' || s.includes('interview')) {
    return 'bg-violet-50 text-violet-700 ring-violet-200/80';
  }
  if (s === 'applied' || s === 'screening' || s === 'follow up') {
    return 'bg-amber-50 text-amber-800 ring-amber-200/80';
  }
  return 'bg-slate-100 text-slate-700 ring-slate-200/80';
}

export default function DuplicateCandidatesAlert({
  checking,
  matches,
  formName,
  formEmail,
  viewLoadingId,
  canViewCandidate,
  onViewCandidate,
  onContinueAnyway,
  onReviewCandidates,
  alertRef,
}: DuplicateCandidatesAlertProps) {
  if (!checking && matches.length === 0) return null;

  return (
    <div
      ref={alertRef}
      role="alert"
      aria-live="polite"
      className={
        matches.length > 0
          ? 'rounded-xl border border-[#F6D58D] bg-[#FFF8E8] p-5 shadow-sm'
          : 'rounded-xl border border-gray-200 bg-gray-50 px-4 py-3'
      }
    >
      {checking ? (
        <p className="text-sm text-gray-600">Checking for duplicate name or email…</p>
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FCEFC7] text-amber-700"
              aria-hidden
            >
              <AlertTriangle size={18} />
            </div>
            <div className="min-w-0 pt-0.5">
              <h4 className="text-base font-semibold text-gray-900 leading-snug">
                Possible Duplicate Candidates Found
              </h4>
              <p className="mt-0.5 text-[13px] text-gray-500">
                We found candidates with matching name or email.
              </p>
            </div>
          </div>

          {/* List */}
          <ul className="divide-y divide-[#F6D58D]/50 rounded-lg border border-[#F6D58D]/40 bg-white/60 overflow-hidden">
            {matches.map((match) => {
              const { matchedBy, nameMatch, emailMatch } = getMatchDetails(
                formName,
                formEmail,
                match
              );
              const viewable = canViewCandidate(match.id);
              const isLoading = viewLoadingId === match.id;

              return (
                <li key={match.id}>
                  <div
                    className={`group flex flex-col gap-3 p-3.5 sm:p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                      viewable ? 'cursor-pointer hover:bg-amber-50/80' : ''
                    }`}
                    onClick={viewable ? () => onViewCandidate(match.id) : undefined}
                    onKeyDown={
                      viewable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onViewCandidate(match.id);
                            }
                          }
                        : undefined
                    }
                    role={viewable ? 'button' : undefined}
                    tabIndex={viewable ? 0 : undefined}
                    aria-label={viewable ? `View profile for ${match.name}` : undefined}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700"
                        aria-hidden
                      >
                        {getInitials(match.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-semibold text-gray-900 truncate ${
                            nameMatch ? 'underline decoration-amber-400 decoration-2 underline-offset-2' : ''
                          }`}
                        >
                          {match.name}
                        </p>
                        {match.email ? (
                          <p
                            className={`mt-0.5 text-xs text-gray-500 truncate ${
                              emailMatch ? 'font-medium text-amber-800' : ''
                            }`}
                          >
                            {match.email}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs text-gray-400 italic">No email on file</p>
                        )}
                        <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-amber-700/90">
                          Matched by: {matchedBy}
                        </p>
                      </div>
                    </div>

                    <div
                      className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {match.position ? (
                        <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800 ring-1 ring-sky-200/80">
                          {match.position}
                        </span>
                      ) : null}
                      {match.stage ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${stageBadgeClass(match.stage)}`}
                        >
                          {match.stage}
                        </span>
                      ) : null}
                      {viewable ? (
                        <button
                          type="button"
                          onClick={() => onViewCandidate(match.id)}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/80 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 shadow-sm transition-colors hover:bg-amber-50 disabled:cursor-wait disabled:opacity-60 sm:ml-1"
                        >
                          <Eye size={14} aria-hidden />
                          {isLoading ? 'Loading…' : 'View'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Actions */}
          <div className="space-y-4 border-t border-[#F6D58D]/50 pt-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              This candidate can still be added.
              <span className="block text-xs text-gray-500 mt-0.5">
                Review the matches above, or continue to add this profile anyway.
              </span>
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={onReviewCandidates}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-amber-200/90 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-amber-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2"
              >
                Review Candidates
              </button>
              <button
                type="button"
                onClick={onContinueAnyway}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
