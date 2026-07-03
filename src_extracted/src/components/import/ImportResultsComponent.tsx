import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  AlertCircle,
  Briefcase,
  Users,
  Target,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowRight,
  X,
  Search,
} from 'lucide-react';
import { candidateImportAPI } from '../../services/api';

interface JobSegregationEntry {
  jobId: number;
  jobTitle: string;
  count: number;
  matchMethod: 'exact' | 'partial' | 'fuzzy' | 'manual' | 'skill_based' | 'override' | 'unknown';
}

interface JobSegregation {
  mappedCount: number;
  unmappedCount: number;
  byJob: JobSegregationEntry[];
}

interface ImportSummary {
  totalRows: number;
  successCount: number;
  failureCount: number;
  processingTime: number;
  qualityDistribution: { high: number; medium: number; low: number };
  jobSegregation: JobSegregation;
}

interface FailedRow {
  rowNumber: number;
  candidateName: string | null;
  error: string;
}

interface ImportResultsComponentProps {
  importResult: {
    importLogId?: number;
    summary: ImportSummary;
    failedRows?: FailedRow[];
  };
  onImportAnother: () => void;
  onViewHistory: () => void;
  onDone: () => void;
}

// ─── Unassigned Candidates Panel ─────────────────────────────────────────────

interface UnassignedCandidate {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  expertise: string | null;
  skills: string[];
}

interface AvailableJob {
  id: number;
  title: string;
  department?: string;
}

function UnassignedPanel({ onReassigned }: { onReassigned: (count: number) => void }) {
  const [candidates, setCandidates] = useState<UnassignedCandidate[]>([]);
  const [jobs, setJobs] = useState<AvailableJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetJobId, setTargetJobId] = useState<number | ''>('');
  const [reassigning, setReassigning] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await candidateImportAPI.getUnassignedCandidates({ search });
      if (res.success && res.data) {
        setCandidates(res.data.candidates || []);
        setJobs(res.data.jobs || []);
      }
    } catch (err) {
      console.error('Failed to load unassigned candidates', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === candidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map(c => c.id)));
    }
  };

  const handleReassign = async () => {
    if (selected.size === 0 || !targetJobId) return;
    setReassigning(true);
    setMessage(null);
    try {
      const res = await candidateImportAPI.reassignCandidates(Array.from(selected), Number(targetJobId));
      if (res.success) {
        setMessage({ type: 'success', text: res.message || `${selected.size} candidate(s) reassigned.` });
        setSelected(new Set());
        setTargetJobId('');
        onReassigned(selected.size);
        await load();
      } else {
        setMessage({ type: 'error', text: 'Reassignment failed. Please try again.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.response?.data?.message || 'Reassignment failed.' });
    } finally {
      setReassigning(false);
    }
  };

  const getMatchMethodBadge = (method: string) => {
    const styles: Record<string, string> = {
      exact: 'bg-green-100 text-green-700',
      partial: 'bg-blue-100 text-blue-700',
      fuzzy: 'bg-purple-100 text-purple-700',
      manual: 'bg-orange-100 text-orange-700',
      skill_based: 'bg-teal-100 text-teal-700',
      override: 'bg-gray-100 text-gray-700',
    };
    const labels: Record<string, string> = {
      exact: 'Exact',
      partial: 'Partial',
      fuzzy: 'Fuzzy',
      manual: 'Manual',
      skill_based: 'Skills',
      override: 'Override',
    };
    return (
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${styles[method] || 'bg-gray-100 text-gray-600'}`}>
        {labels[method] || method}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search + Reassign Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search unassigned candidates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={targetJobId}
          onChange={e => setTargetJobId(e.target.value ? Number(e.target.value) : '')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[200px]"
        >
          <option value="">Select job to assign...</option>
          {jobs.map(j => (
            <option key={j.id} value={j.id}>{j.title}</option>
          ))}
        </select>
        <button
          onClick={handleReassign}
          disabled={selected.size === 0 || !targetJobId || reassigning}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {reassigning ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRight size={14} />}
          Assign {selected.size > 0 ? `(${selected.size})` : ''}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      {/* Candidates Table */}
      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw size={20} className="animate-spin text-gray-400" />
        </div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
          <p className="font-medium text-gray-700">All candidates are assigned!</p>
          <p className="text-sm">No unassigned candidates found.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === candidates.length && candidates.length > 0}
                    onChange={toggleAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Role / Position</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Skills</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {candidates.map(c => (
                <tr key={c.id} className={`hover:bg-gray-50 ${selected.has(c.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900">{c.name}</td>
                  <td className="px-3 py-2 text-gray-600">{c.position || c.expertise || <span className="text-gray-400 italic">Not specified</span>}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(c.skills || []).slice(0, 3).map((s, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{s}</span>
                      ))}
                      {(c.skills || []).length > 3 && (
                        <span className="text-xs text-gray-400">+{c.skills.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{c.email || c.phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ImportResultsComponent({
  importResult,
  onImportAnother,
  onViewHistory,
  onDone,
}: ImportResultsComponentProps) {
  const { summary, failedRows = [] } = importResult;
  const { jobSegregation } = summary;
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [showFailedRows, setShowFailedRows] = useState(false);
  const [unassignedCount, setUnassignedCount] = useState(jobSegregation?.unmappedCount ?? 0);

  const handleReassigned = (count: number) => {
    setUnassignedCount(prev => Math.max(0, prev - count));
  };

  const getMatchMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      exact: 'Exact Match',
      partial: 'Partial Match',
      fuzzy: 'Fuzzy Match',
      manual: 'Manual Config',
      skill_based: 'Skill-Based',
      override: 'Job Override',
    };
    return labels[method] || method;
  };

  const getMatchMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      exact: 'text-green-600',
      partial: 'text-blue-600',
      fuzzy: 'text-purple-600',
      manual: 'text-orange-600',
      skill_based: 'text-teal-600',
      override: 'text-gray-600',
    };
    return colors[method] || 'text-gray-500';
  };

  const mappedPercent = summary.successCount > 0
    ? Math.round(((jobSegregation?.mappedCount ?? 0) / summary.successCount) * 100)
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Success Header ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle className="text-green-600" size={28} />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Import Completed Successfully!</h3>
            <p className="text-gray-500 text-sm mt-0.5">
              Processed in {((summary.processingTime || 0) / 1000).toFixed(1)}s
            </p>
          </div>
        </div>

        {/* ── Core Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-600 font-medium mb-1">Total Processed</p>
            <p className="text-2xl font-bold text-blue-900">{summary.totalRows}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-xs text-green-600 font-medium mb-1">Imported</p>
            <p className="text-2xl font-bold text-green-900">{summary.successCount}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
            <p className="text-xs text-purple-600 font-medium mb-1">Mapped to Jobs</p>
            <p className="text-2xl font-bold text-purple-900">{jobSegregation?.mappedCount ?? 0}</p>
          </div>
          <div className={`border rounded-lg p-3 text-center ${unassignedCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
            <p className={`text-xs font-medium mb-1 ${unassignedCount > 0 ? 'text-amber-600' : 'text-gray-500'}`}>Unassigned</p>
            <p className={`text-2xl font-bold ${unassignedCount > 0 ? 'text-amber-900' : 'text-gray-700'}`}>{unassignedCount}</p>
          </div>
        </div>

        {/* ── Job Mapping Progress Bar ── */}
        {summary.successCount > 0 && (
          <div className="mb-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Job Mapping Coverage</span>
              <span>{mappedPercent}% mapped</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${mappedPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Job Segregation Breakdown ── */}
      {jobSegregation && jobSegregation.byJob && jobSegregation.byJob.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} className="text-purple-600" />
            <h4 className="font-semibold text-gray-900">Auto Job Segregation Results</h4>
            <span className="ml-auto text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {jobSegregation.byJob.length} job{jobSegregation.byJob.length !== 1 ? 's' : ''} matched
            </span>
          </div>

          <div className="space-y-3">
            {jobSegregation.byJob.map((entry) => {
              const pct = summary.successCount > 0
                ? Math.round((entry.count / summary.successCount) * 100)
                : 0;
              return (
                <div key={entry.jobId} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Briefcase size={14} className="text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 truncate">{entry.jobTitle}</span>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <span className={`text-xs ${getMatchMethodColor(entry.matchMethod)}`}>
                          {getMatchMethodLabel(entry.matchMethod)}
                        </span>
                        <span className="text-sm font-semibold text-gray-700">
                          {entry.count} <span className="text-gray-400 font-normal">candidates</span>
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-purple-400 h-1.5 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Unassigned row */}
          {unassignedCount > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={14} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-amber-700">Unassigned Pool</span>
                  <span className="text-sm font-semibold text-amber-700">
                    {unassignedCount} <span className="text-amber-500 font-normal">candidates</span>
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-amber-400 h-1.5 rounded-full"
                    style={{ width: `${summary.successCount > 0 ? Math.round((unassignedCount / summary.successCount) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Unassigned Candidates Panel ── */}
      {unassignedCount > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowUnassigned(v => !v)}
            className="w-full flex items-center justify-between p-4 hover:bg-amber-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                <Users size={16} className="text-amber-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">
                  {unassignedCount} Unassigned Candidate{unassignedCount !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-500">
                  Role couldn't be matched to any active job — manually assign them below
                </p>
              </div>
            </div>
            {showUnassigned ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </button>

          {showUnassigned && (
            <div className="border-t border-amber-200 p-4">
              <UnassignedPanel onReassigned={handleReassigned} />
            </div>
          )}
        </div>
      )}

      {/* ── Failed Rows ── */}
      {failedRows.length > 0 && (
        <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowFailedRows(v => !v)}
            className="w-full flex items-center justify-between p-4 hover:bg-red-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertCircle size={16} className="text-red-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">{summary.failureCount} Row{summary.failureCount !== 1 ? 's' : ''} Failed</p>
                <p className="text-xs text-gray-500">Download from Import History to fix and re-import</p>
              </div>
            </div>
            {showFailedRows ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </button>

          {showFailedRows && (
            <div className="border-t border-red-200 p-4">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {failedRows.map((row, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-red-400 font-mono text-xs mt-0.5">Row {row.rowNumber + 1}</span>
                    <span className="text-gray-700 font-medium">{row.candidateName || 'Unknown'}</span>
                    <span className="text-red-600 text-xs">{row.error}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={onViewHistory}
                className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
              >
                View Import History to download all failed rows →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Quality Distribution ── */}
      {summary.qualityDistribution && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Data Quality Distribution</h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-xs text-green-600 font-medium mb-1">High Quality</p>
              <p className="text-xl font-bold text-green-900">{summary.qualityDistribution.high}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
              <p className="text-xs text-yellow-600 font-medium mb-1">Medium Quality</p>
              <p className="text-xl font-bold text-yellow-900">{summary.qualityDistribution.medium}</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
              <p className="text-xs text-orange-600 font-medium mb-1">Low Quality</p>
              <p className="text-xl font-bold text-orange-900">{summary.qualityDistribution.low}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex justify-center gap-3 pb-2">
        <button
          onClick={onViewHistory}
          className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
        >
          View History
        </button>
        <button
          onClick={onImportAnother}
          className="px-5 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors text-sm"
        >
          Import Another File
        </button>
        <button
          onClick={onDone}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          Done
        </button>
      </div>
    </div>
  );
}
