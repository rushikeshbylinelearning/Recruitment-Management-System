/**
 * HiringTrendsWidget
 *
 * Dashboard widget that renders a multi-line smooth trend chart for
 * recruitment metrics (Applied, Interviews, Offers, Hired, Rejected).
 *
 * Design language: matches existing Dashboard cards (rounded-2xl, shadow-sm,
 * dark:bg-[#262626], dark:border-[#333333]).
 *
 * Chart library: recharts v3 (LineChart + ResponsiveContainer).
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingUp, RefreshCw, AlertCircle, Users } from 'lucide-react';
import { hiringTrendsAPI, HiringTrendsParams, HiringTrendsDataset } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChartPoint {
  label: string;
  [key: string]: string | number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DATASET_KEYS = ['applied', 'interview', 'offer', 'hired', 'rejected'] as const;
type DatasetKey = typeof DATASET_KEYS[number];

const PRESET_RANGES = [
  { label: 'Today',        days: 0,  groupBy: 'daily'   as const },
  { label: 'Last 7 Days',  days: 7,  groupBy: 'daily'   as const },
  { label: 'Last 30 Days', days: 30, groupBy: 'daily'   as const },
  { label: 'Last 90 Days', days: 90, groupBy: 'weekly'  as const },
  { label: 'This Month',   days: -1, groupBy: 'daily'   as const }, // special
  { label: 'Last Month',   days: -2, groupBy: 'daily'   as const }, // special
  { label: 'Quarter',      days: -3, groupBy: 'weekly'  as const }, // special
  { label: 'Year',         days: -4, groupBy: 'monthly' as const }, // special
  { label: 'Custom Range', days: -5, groupBy: 'daily'   as const }, // special
] as const;

const GROUP_BY_OPTIONS = [
  { label: 'Daily',     value: 'daily'     as const },
  { label: 'Weekly',    value: 'weekly'    as const },
  { label: 'Monthly',   value: 'monthly'   as const },
  { label: 'Quarterly', value: 'quarterly' as const },
];

// ISO YYYY-MM-DD helpers
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const today = () => fmt(new Date());
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmt(d);
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Skeleton pulse bars used while data is loading */
function ChartSkeleton() {
  return (
    <div className="animate-pulse space-y-3 pt-4" aria-hidden="true" aria-busy="true">
      <div className="flex items-end gap-2 h-48">
        {[40, 65, 50, 80, 55, 70, 45, 90, 60, 75, 55, 85].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gray-200 dark:bg-[#333333]"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="h-3 bg-gray-100 dark:bg-[#262626] rounded w-full" />
    </div>
  );
}

/** Empty state illustration */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-[#333333] flex items-center justify-center">
        <Users size={28} className="text-gray-400 dark:text-slate-500" />
      </div>
      <p className="text-sm font-medium text-gray-500 dark:text-slate-400">
        No hiring data available for selected filters
      </p>
      <p className="text-xs text-gray-400 dark:text-slate-500">
        Try adjusting the date range or filters
      </p>
    </div>
  );
}

/** Error state with retry */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3">
      <AlertCircle size={32} className="text-red-400" />
      <p className="text-sm font-medium text-gray-600 dark:text-slate-300">
        Failed to load hiring trends
      </p>
      <button
        onClick={onRetry}
        className="text-xs px-4 py-1.5 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

/** Custom tooltip shown on hover */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg p-3 text-xs min-w-[140px]">
      <p className="font-semibold text-gray-800 dark:text-white mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-600 dark:text-slate-300">{entry.name}</span>
          </div>
          <span className="font-bold text-gray-900 dark:text-white">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function HiringTrendsWidget() {
  const { user } = useAuth();
  const isAdmin   = user?.role === 'Admin' || user?.role === 'HR Manager';

  // ── Filter state ──────────────────────────────────────────────────────
  const [preset,      setPreset]      = useState<number>(3); // Last 90 Days
  const [startDate,   setStartDate]   = useState<string>(daysAgo(90));
  const [endDate,     setEndDate]     = useState<string>(today());
  const [groupBy,     setGroupBy]     = useState<HiringTrendsParams['groupBy']>('weekly');
  const [recruiterId, setRecruiterId] = useState<number | null>(null);
  const [jobId,       setJobId]       = useState<number | null>(null);
  const [department,  setDepartment]  = useState<string | null>(null);
  const [hiddenKeys,  setHiddenKeys]  = useState<Set<DatasetKey>>(new Set());
  const [showCustom,  setShowCustom]  = useState(false);

  // ── Dropdown data ─────────────────────────────────────────────────────
  const [recruiters,  setRecruiters]  = useState<Array<{ id: number; name: string }>>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [jobs,        setJobs]        = useState<Array<{ id: number; title: string; department: string }>>([]);

  // ── Chart data ────────────────────────────────────────────────────────
  const [datasets,   setDatasets]   = useState<HiringTrendsDataset[]>([]);
  const [labels,     setLabels]     = useState<string[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Load dropdown data once ───────────────────────────────────────────
  useEffect(() => {
    hiringTrendsAPI.getDepartments()
      .then((r) => { if (r.success && r.data) setDepartments(r.data); })
      .catch(() => {});

    hiringTrendsAPI.getJobs()
      .then((r) => { if (r.success && r.data) setJobs(r.data); })
      .catch(() => {});

    if (isAdmin) {
      hiringTrendsAPI.getRecruiters()
        .then((r) => { if (r.success && r.data) setRecruiters(r.data); })
        .catch(() => {});
    }

    // Debug: log raw DB counts to console
    hiringTrendsAPI.debug()
      .then((r) => { console.log('[HiringTrends Debug]', r.data); })
      .catch(() => {});
  }, [isAdmin]);

  // ── Fetch trend data ──────────────────────────────────────────────────
  const fetchTrends = useCallback(async () => {
    // Abort any in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const params: HiringTrendsParams = {
        startDate,
        endDate,
        groupBy,
        recruiterId,
        jobId,
        department,
      };

      const response = await hiringTrendsAPI.getTrends(params);

      if (response.success && response.data) {
        console.log('[HiringTrends] Response:', JSON.stringify(response.data.datasets?.map(d => ({ key: d.key, sum: d.data.reduce((a,b) => a+b, 0), data: d.data }))));
        setLabels(response.data.labels);
        setDatasets(response.data.datasets);
      } else {
        setError('Unexpected response from server');
      }
    } catch (err: any) {
      if (err?.name !== 'CanceledError' && err?.name !== 'AbortError') {
        setError('Failed to load hiring trends');
      }
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, groupBy, recruiterId, jobId, department]);

  // Debounced fetch on param change
  useEffect(() => {
    const t = setTimeout(fetchTrends, 300);
    return () => clearTimeout(t);
  }, [fetchTrends]);

  // Auto-refresh every 60 seconds (same pattern as MetricsTimeline)
  useEffect(() => {
    const id = setInterval(fetchTrends, 60_000);
    return () => clearInterval(id);
  }, [fetchTrends]);

  // ── Preset change handler ─────────────────────────────────────────────
  const applyPreset = useCallback((idx: number) => {
    setPreset(idx);
    const p = PRESET_RANGES[idx];

    if (p.days === -5) {
      // Custom range
      setShowCustom(true);
      return;
    }
    setShowCustom(false);

    const now = new Date();
    let sd: string, ed: string, gb: HiringTrendsParams['groupBy'];

    if (p.days === 0) {
      // Today
      sd = today(); ed = today(); gb = 'daily';
    } else if (p.days > 0) {
      sd = daysAgo(p.days); ed = today(); gb = p.groupBy;
    } else if (p.days === -1) {
      // This month
      sd = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
      ed = today();
      gb = 'daily';
    } else if (p.days === -2) {
      // Last month
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last  = new Date(now.getFullYear(), now.getMonth(), 0);
      sd = fmt(first); ed = fmt(last); gb = 'daily';
    } else if (p.days === -3) {
      // This quarter
      const q = Math.floor(now.getMonth() / 3);
      sd = fmt(new Date(now.getFullYear(), q * 3, 1));
      ed = today();
      gb = 'weekly';
    } else {
      // Year
      sd = fmt(new Date(now.getFullYear(), 0, 1));
      ed = today();
      gb = 'monthly';
    }

    setStartDate(sd);
    setEndDate(ed);
    setGroupBy(gb);
  }, []);

  // ── Legend toggle ─────────────────────────────────────────────────────
  const toggleLine = useCallback((key: DatasetKey) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ── Build chart data ──────────────────────────────────────────────────
  const chartData = useMemo<ChartPoint[]>(() => {
    if (labels.length === 0) return [];
    return labels.map((label, i) => {
      const point: ChartPoint = { label };
      datasets.forEach((ds) => {
        point[ds.key] = ds.data[i] ?? 0;
      });
      return point;
    });
  }, [labels, datasets]);

  const hasData = chartData.length > 0 && datasets.some((ds) => ds.data.some((v) => v > 0));

  // Always render the chart skeleton when labels exist even if all values are 0,
  // so the axes/grid are visible. Only show empty state when backend returned no periods at all.
  const showChart = !loading && !error && chartData.length > 0;
  const showEmpty = !loading && !error && chartData.length === 0;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="bg-white dark:bg-[#262626] rounded-2xl shadow-sm border border-gray-200 dark:border-[#333333] p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
              Hiring Trends
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Track recruitment performance over time
            </p>
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={fetchTrends}
          disabled={loading}
          title="Refresh"
          className="self-start flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Loading…' : 'Refresh'}</span>
        </button>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Time Period Preset */}
        <div className="flex-shrink-0">
          <select
            value={preset}
            onChange={(e) => applyPreset(Number(e.target.value))}
            className="text-xs rounded-lg border border-gray-200 dark:border-[#444] bg-white dark:bg-[#1e293b] text-gray-700 dark:text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {PRESET_RANGES.map((p, i) => (
              <option key={p.label} value={i}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Group By */}
        <div className="flex-shrink-0">
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as HiringTrendsParams['groupBy'])}
            className="text-xs rounded-lg border border-gray-200 dark:border-[#444] bg-white dark:bg-[#1e293b] text-gray-700 dark:text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {GROUP_BY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Recruiter (Admin only) */}
        {isAdmin && recruiters.length > 0 && (
          <div className="flex-shrink-0">
            <select
              value={recruiterId ?? ''}
              onChange={(e) => setRecruiterId(e.target.value ? Number(e.target.value) : null)}
              className="text-xs rounded-lg border border-gray-200 dark:border-[#444] bg-white dark:bg-[#1e293b] text-gray-700 dark:text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">All Recruiters / Interns</option>
              {recruiters.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Job filter */}
        {jobs.length > 0 && (
          <div className="flex-shrink-0">
            <select
              value={jobId ?? ''}
              onChange={(e) => setJobId(e.target.value ? Number(e.target.value) : null)}
              className="text-xs rounded-lg border border-gray-200 dark:border-[#444] bg-white dark:bg-[#1e293b] text-gray-700 dark:text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 max-w-[180px]"
            >
              <option value="">All Jobs</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
          </div>
        )}

        {/* Department filter */}
        {departments.length > 0 && (
          <div className="flex-shrink-0">
            <select
              value={department ?? ''}
              onChange={(e) => setDepartment(e.target.value || null)}
              className="text-xs rounded-lg border border-gray-200 dark:border-[#444] bg-white dark:bg-[#1e293b] text-gray-700 dark:text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Custom date range inputs */}
      {showCustom && (
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-slate-400">From</label>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs rounded-lg border border-gray-200 dark:border-[#444] bg-white dark:bg-[#1e293b] text-gray-700 dark:text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 dark:text-slate-400">To</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={today()}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs rounded-lg border border-gray-200 dark:border-[#444] bg-white dark:bg-[#1e293b] text-gray-700 dark:text-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>
      )}

      {/* ── Interactive Legend ────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {datasets.map((ds) => {
          const hidden = hiddenKeys.has(ds.key as DatasetKey);
          return (
            <button
              key={ds.key}
              onClick={() => toggleLine(ds.key as DatasetKey)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
                hidden
                  ? 'border-gray-200 dark:border-[#444] text-gray-400 dark:text-slate-500 opacity-50'
                  : 'border-transparent text-gray-700 dark:text-slate-200'
              }`}
              style={
                hidden
                  ? {}
                  : { backgroundColor: ds.color + '18', borderColor: ds.color + '55' }
              }
              title={hidden ? `Show ${ds.label}` : `Hide ${ds.label}`}
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: hidden ? '#9ca3af' : ds.color }}
              />
              {ds.label}
            </button>
          );
        })}
      </div>

      {/* ── Chart area ───────────────────────────────────────────────── */}
      <div className="min-h-[220px]">
        {loading && <ChartSkeleton />}
        {!loading && error && <ErrorState onRetry={fetchTrends} />}
        {!loading && !error && showEmpty && <EmptyState />}
        {showChart && (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 16, left: -12, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-gray-100 dark:text-slate-700/60"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'currentColor' }}
                className="text-gray-500 dark:text-slate-400"
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'currentColor' }}
                className="text-gray-500 dark:text-slate-400"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: 'currentColor',
                  strokeWidth: 1,
                  className: 'text-gray-200 dark:text-slate-700',
                }}
              />
              {/* Legend is replaced by interactive buttons above — hide recharts legend */}
              {datasets.map((ds) => {
                if (hiddenKeys.has(ds.key as DatasetKey)) return null;
                return (
                  <Line
                    key={ds.key}
                    type="monotone"
                    dataKey={ds.key}
                    name={ds.label}
                    stroke={ds.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    animationDuration={400}
                    animationEasing="ease-out"
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer date range note */}
      {showChart && (
        <p className="text-[10px] text-gray-400 dark:text-slate-500 text-right mt-2">
          {startDate} → {endDate} · grouped by {groupBy}
        </p>
      )}
    </div>
  );
}
