import { useEffect, useState, useMemo, useRef } from 'react';
import { X, GitMerge, RotateCcw, Clock, FileText, Sparkles } from 'lucide-react';
import { candidatesAPI } from '../services/api';
import '../styles/MergeReviewModal.css';

type MergeProfile = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  experience?: string;
  salaryExpected?: string;
  currentCtc?: string;
  location?: string;
  noticePeriod?: string;
  workPreference?: string;
  expertise?: string;
  linkedinUrl?: string;
  resumeLabel?: string | null;
  resumeUploadedAt?: string | null;
  updatedAt?: string;
};

type FieldResolution = {
  field: string;
  label: string;
  primaryValue: string;
  duplicateValue: string;
  suggestedValue: string;
  strategy: string;
  confidence: number;
  reason: string;
  requiresReview: boolean;
  suggestedAction?: string;
};

type MergePreview = {
  primaryId: string;
  duplicateId: string;
  primary: MergeProfile;
  duplicate: MergeProfile;
  fieldResolutions: Record<string, FieldResolution>;
  conflicts: FieldResolution[];
  autoResolved: FieldResolution[];
  positions: { merged: string[] };
  summary: { conflictCount: number; requiresReview: boolean };
  strategy: string;
};

const STRATEGIES = [
  { id: 'HR_REVIEW_REQUIRED', label: 'HR review' },
  { id: 'LATEST_WINS', label: 'Latest wins' },
  { id: 'PRIMARY_WINS', label: 'Primary wins' },
  { id: 'AUTO_SAFE', label: 'Auto-safe only' },
] as const;

const ACTIONS = {
  KEEP_PRIMARY: 'KEEP_PRIMARY',
  KEEP_DUPLICATE: 'KEEP_DUPLICATE',
  MERGE_BOTH: 'MERGE_BOTH',
  MANUAL: 'MANUAL',
} as const;

type Decision = { action: string; manualValue?: string };

interface MergeReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  primaryId: string;
  duplicateId: string;
  onMerged?: () => void;
}

function confidenceClass(c: number) {
  if (c >= 0.9) return 'merge-confidence--high';
  if (c >= 0.75) return 'merge-confidence--mid';
  return 'merge-confidence--low';
}

function ProfileColumn({
  title,
  profile,
  variant,
}: {
  title: string;
  profile: MergeProfile;
  variant: 'primary' | 'duplicate';
}) {
  const rows = [
    ['Email', profile.email],
    ['Phone', profile.phone],
    ['Position', profile.position],
    ['Expected CTC', profile.salaryExpected],
    ['Current CTC', profile.currentCtc],
    ['Experience', profile.experience],
    ['Location', profile.location],
    ['Notice', profile.noticePeriod],
    ['Work pref.', profile.workPreference],
    ['LinkedIn', profile.linkedinUrl],
    ['Resume', profile.resumeLabel || '—'],
  ];

  return (
    <div className={`merge-panel merge-panel--${variant} p-4 h-full`}>
      <h3 className="text-sm font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-lg font-semibold text-gray-900 truncate">{profile.name}</p>
      {profile.updatedAt && (
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
          <Clock size={12} />
          Updated {new Date(profile.updatedAt).toLocaleDateString('en-IN')}
        </p>
      )}
      <dl className="mt-4 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2 text-sm border-b border-gray-50 pb-1.5">
            <dt className="text-gray-500 shrink-0">{label}</dt>
            <dd className="text-gray-900 font-medium text-right truncate max-w-[58%]">
              {value || '—'}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ConflictCard({
  resolution,
  decision,
  onDecision,
}: {
  resolution: FieldResolution;
  decision: Decision;
  onDecision: (d: Decision) => void;
}) {
  const isSuggested = resolution.requiresReview;
  return (
    <div className={`merge-conflict-card p-4 ${isSuggested ? '' : 'merge-conflict-card--suggested'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-sm font-semibold text-gray-900">{resolution.label}</span>
        <span className={`merge-confidence ${confidenceClass(resolution.confidence)}`}>
          {Math.round(resolution.confidence * 100)}% · {resolution.strategy.replace(/_/g, ' ')}
        </span>
      </div>
      <p className="text-xs text-violet-700 mb-3 flex items-center gap-1">
        <Sparkles size={12} />
        Suggested: <strong>{String(resolution.suggestedValue || '—')}</strong>
      </p>
      <p className="text-xs text-gray-500 mb-3">{resolution.reason}</p>
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="bg-red-50 rounded-lg p-2 border border-red-100">
          <span className="text-red-800 font-medium block mb-0.5">Primary</span>
          {String(resolution.primaryValue || '—')}
        </div>
        <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
          <span className="text-gray-700 font-medium block mb-0.5">Duplicate</span>
          {String(resolution.duplicateValue || '—')}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          [ACTIONS.KEEP_PRIMARY, 'Keep primary'],
          [ACTIONS.KEEP_DUPLICATE, 'Keep duplicate'],
          [ACTIONS.MERGE_BOTH, 'Merge both'],
        ].map(([action, label]) => (
          <label key={action} className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`field-${resolution.field}`}
              checked={decision.action === action}
              onChange={() => onDecision({ action })}
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function MergeReviewModal({
  isOpen,
  onClose,
  primaryId,
  duplicateId,
  onMerged,
}: MergeReviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [strategy, setStrategy] = useState<string>('HR_REVIEW_REQUIRED');
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [error, setError] = useState<string | null>(null);
  const submitLockRef = useRef(false);

  const loadPreview = async (strat?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await candidatesAPI.previewCandidateMerge({
        primaryCandidateId: primaryId,
        duplicateCandidateId: duplicateId,
        strategy: strat || strategy,
      });
      if (res.success && res.data) {
        const data = res.data as MergePreview;
        setPreview(data);
        const initial: Record<string, Decision> = {};
        for (const [key, reso] of Object.entries(data.fieldResolutions || {})) {
          initial[key] = {
            action: reso.suggestedAction || ACTIONS.KEEP_PRIMARY,
          };
        }
        if (data.positions?.merged?.length) {
          initial.position = { action: ACTIONS.MERGE_BOTH };
        }
        setDecisions(initial);
      }
    } catch {
      setError('Failed to load merge preview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && primaryId && duplicateId) {
      loadPreview();
    }
  }, [isOpen, primaryId, duplicateId]);

  const conflictFields = useMemo(() => {
    if (!preview) return [];
    return Object.values(preview.fieldResolutions).filter(
      (r) => r.requiresReview || preview.conflicts.some((c) => c.field === r.field)
    );
  }, [preview]);

  const handleExecute = async () => {
    if (!preview || submitLockRef.current) return;
    submitLockRef.current = true;
    setExecuting(true);
    setError(null);
    try {
      const payload = {
        ...decisions,
        position: { positions: preview.positions.merged, action: ACTIONS.MERGE_BOTH },
      };
      const res = await candidatesAPI.executeCandidateMerge({
        primaryCandidateId: primaryId,
        duplicateCandidateId: duplicateId,
        strategy,
        decisions: payload,
      });
      if (res?.success !== false) {
        onMerged?.();
        onClose();
        return;
      }
      setError(res.message || 'Merge failed');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string }; status?: number } };
      const message = axiosErr.response?.data?.message || 'Merge failed';
      const alreadyGone =
        axiosErr.response?.status === 404 ||
        /not found|already merged/i.test(message);
      if (alreadyGone) {
        onMerged?.();
        onClose();
        return;
      }
      setError(message);
    } finally {
      setExecuting(false);
      submitLockRef.current = false;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 merge-review-overlay">
      <div className="merge-review-shell rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="merge-review-header px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <GitMerge className="text-red-700" size={22} />
              Intelligent merge review
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Compare profiles, resolve conflicts, and merge without losing data.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-red-50 text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-2 items-center shrink-0 bg-white">
          <span className="text-xs font-medium text-gray-500 mr-1">Strategy:</span>
          {STRATEGIES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`merge-strategy-pill ${strategy === s.id ? 'merge-strategy-pill--active' : ''}`}
              onClick={() => {
                setStrategy(s.id);
                loadPreview(s.id);
              }}
            >
              {s.label}
            </button>
          ))}
          {preview?.summary && (
            <span className="ml-auto text-xs text-gray-600">
              {preview.summary.conflictCount} conflict(s) ·{' '}
              {preview.autoResolved?.length || 0} auto-resolved
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <p className="text-center text-gray-500 py-12">Analyzing profiles and detecting conflicts…</p>
          )}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
          {!loading && preview && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                <ProfileColumn title="Primary profile" profile={preview.primary} variant="primary" />
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">
                    Conflict resolution
                  </p>
                  {conflictFields.length === 0 ? (
                    <div className="merge-panel p-4 text-sm text-gray-600 text-center">
                      No conflicts — safe to merge with suggested values.
                    </div>
                  ) : (
                    conflictFields.map((r) => (
                      <ConflictCard
                        key={r.field}
                        resolution={r}
                        decision={decisions[r.field] || { action: r.suggestedAction || ACTIONS.KEEP_DUPLICATE }}
                        onDecision={(d) => setDecisions((prev) => ({ ...prev, [r.field]: d }))}
                      />
                    ))
                  )}
                  {preview.positions.merged.length > 1 && (
                    <div className="merge-conflict-card p-4">
                      <p className="text-sm font-semibold text-gray-900 mb-2">Positions (kept both)</p>
                      <ul className="text-sm text-gray-700 list-disc pl-4">
                        {preview.positions.merged.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <ProfileColumn title="Duplicate profile" profile={preview.duplicate} variant="duplicate" />
              </div>

              {preview.autoResolved.length > 0 && (
                <details className="merge-panel p-4 mb-4">
                  <summary className="text-sm font-semibold text-gray-800 cursor-pointer flex items-center gap-2">
                    <FileText size={16} />
                    Auto-resolved fields ({preview.autoResolved.length})
                  </summary>
                  <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                    {preview.autoResolved.map((r) => (
                      <li key={r.field} className="border-b border-gray-100 pb-1">
                        <strong>{r.label}:</strong> → {String(r.suggestedValue || '—')}
                        <span className="text-gray-400 ml-1">({r.reason})</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={executing || loading || !preview}
            onClick={handleExecute}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-800 text-white text-sm font-semibold hover:bg-red-900 disabled:opacity-50"
          >
            <GitMerge size={16} />
            {executing ? 'Merging…' : 'Confirm intelligent merge'}
          </button>
        </div>
      </div>
    </div>
  );
}
