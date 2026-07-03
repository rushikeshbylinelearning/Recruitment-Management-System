import React from 'react';

export interface DuplicateCheckResult {
  exists: boolean;
  applicationRef?: string;
  status?: string;
  lastUpdated?: string;
  resumeAvailable?: boolean;
}

interface ExistingApplicationCardProps {
  info: DuplicateCheckResult;
  onContinue: () => void;
  onUpdate: () => void;
  onFresh: () => void;
  loading?: boolean;
}

function formatStatus(status?: string) {
  if (!status) return 'Under Review';
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value?: string) {
  if (!value) return 'Recently';
  try {
    const d = new Date(value);
    const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  } catch {
    return 'Recently';
  }
}

const ExistingApplicationCard: React.FC<ExistingApplicationCardProps> = ({
  info,
  onContinue,
  onUpdate,
  onFresh,
  loading = false,
}) => (
  <div
    className="pf-existing-app"
    role="region"
    aria-label="Existing application found"
  >
    <div className="pf-existing-app-icon" aria-hidden>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </div>
    <div className="pf-existing-app-body">
      <h3 className="pf-existing-app-title">
        We found an existing application associated with this email.
      </h3>
      <dl className="pf-existing-app-meta">
        <div>
          <dt>Status</dt>
          <dd>{formatStatus(info.status)}</dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{formatDate(info.lastUpdated)}</dd>
        </div>
      </dl>
      <div className="pf-existing-app-actions">
        <button
          type="button"
          className="pf-btn pf-btn-primary"
          onClick={onContinue}
          disabled={loading}
        >
          Continue Existing Application
        </button>
        <button
          type="button"
          className="pf-btn pf-btn-secondary"
          onClick={onUpdate}
          disabled={loading}
        >
          Update Submission
        </button>
        <button
          type="button"
          className="pf-btn pf-btn-ghost"
          onClick={onFresh}
          disabled={loading}
        >
          Create New Version
        </button>
      </div>
      <p className="pf-existing-app-help">
        Need help? Contact your HR team for assistance with your application.
      </p>
    </div>
  </div>
);

export default ExistingApplicationCard;
