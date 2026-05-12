import { useState, useEffect, useMemo, useRef } from 'react';
import { Users, Briefcase, Clock, Calendar, ArrowRight, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI } from '../services/api';
import ProtectedComponent from './ProtectedComponent';
import DashboardWidget from './ui/DashboardWidget';
import MetricsTimeline from './ui/MetricsTimeline';

interface DashboardData {
  metrics: {
    totalJobs: { value: number; change: number; trend: string };
    activeCandidates: { value: number; change: number; trend: string };
    interviewsScheduled: { value: number; change: number; trend: string };
    timeToHire: { value: number; change: number; trend: string };
  };
  pipeline: Record<string, number>;
  activities: Array<{
    id: number;
    type: string;
    description: string;
    timestamp: string;
    user: string | null;
    candidate_name: string | null;
    position: string | null;
  }>;
  dailyMetrics: {
    total: number;
    byStage: Array<{ stage: string; count: number }>;
    byRole: Array<{ role: string; count: number }>;
    profileNotFound?: number;
    followUps?: number;
  };
}

/**
 * Safely extracts DashboardData from any response shape the API service may return:
 *   Shape A: { success: true, data: DashboardData }         ← service unwrapped axios
 *   Shape B: { data: { success: true, data: DashboardData } } ← raw axios response
 *   Shape C: DashboardData directly                          ← service unwrapped everything
 */
function extractDashboardData(response: unknown): DashboardData | null {
  if (!response || typeof response !== 'object') return null;
  const r = response as Record<string, unknown>;

  const isDashboardData = (obj: unknown): obj is DashboardData =>
    !!obj &&
    typeof obj === 'object' &&
    'metrics' in (obj as object) &&
    'pipeline' in (obj as object);

  // Shape A: { success: true, data: DashboardData }
  if (r.success === true && isDashboardData(r.data)) return r.data;

  // Shape B: raw axios → { data: { success: true, data: DashboardData } }
  if (r.data && typeof r.data === 'object') {
    const inner = r.data as Record<string, unknown>;
    if (inner.success === true && isDashboardData(inner.data)) return inner.data as DashboardData;
    // Shape B2: axios .data IS DashboardData directly
    if (isDashboardData(inner)) return inner as unknown as DashboardData;
  }

  // Shape C: response IS DashboardData
  if (isDashboardData(r)) return r as unknown as DashboardData;

  return null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const isFetchingRef = useRef(false);

  useEffect(() => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    let cancelled = false;

    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setError('Dashboard loading timed out. Please refresh the page.');
      }
    }, 10000);

    const fetchDashboardData = async () => {
      try {
        console.log('🔄 Fetching dashboard data...');
        const response = await dashboardAPI.getOverview();
        console.log('✅ Dashboard response:', response);

        if (cancelled) return;

        const data = extractDashboardData(response);

        if (data) {
          setDashboardData(data);
          setError('');
          console.log('✅ Dashboard data loaded successfully');
        } else {
          console.error('❌ Unrecognised response shape:', response);
          setError('Failed to load dashboard data');
        }
      } catch (err) {
        console.error('❌ Dashboard API error:', err);
        if (!cancelled) {
          setError(
            `Failed to load dashboard data: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        }
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) {
          setLoading(false);
          isFetchingRef.current = false;
          console.log('✅ Dashboard loading complete');
        }
      }
    };

    fetchDashboardData();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      isFetchingRef.current = false;
    };
  }, []);

  const pipelineWithPercentages = useMemo(() => {
    const stages = [
      { stage: 'Applied',   count: dashboardData?.pipeline.Applied   ?? 0, color: 'bg-blue-500' },
      { stage: 'Screening', count: dashboardData?.pipeline.Screening ?? 0, color: 'bg-yellow-500' },
      { stage: 'Interview', count: dashboardData?.pipeline.Interview ?? 0, color: 'bg-orange-500' },
      { stage: 'Offer',     count: dashboardData?.pipeline.Offer     ?? 0, color: 'bg-purple-500' },
      { stage: 'Hired',     count: dashboardData?.pipeline.Hired     ?? 0, color: 'bg-green-500' },
    ];
    const maxCount = Math.max(...stages.map(s => s.count), 1);
    return stages.map(s => ({ ...s, percentage: (s.count / maxCount) * 100 }));
  }, [dashboardData]);

  const metrics = dashboardData?.metrics ?? {
    totalJobs:           { value: 0, change: 0, trend: 'up' },
    activeCandidates:    { value: 0, change: 0, trend: 'up' },
    interviewsScheduled: { value: 0, change: 0, trend: 'up' },
    timeToHire:          { value: 0, change: 0, trend: 'down' },
  };

  return (
    <ProtectedComponent module="dashboard" action="view">
      <div className="space-y-6 min-h-screen">
        {/* Error Banner — only after loading finishes */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-sm">
            {error}
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Loading dashboard...</p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className={loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}>
          {/* Welcome Section */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold mb-2">Welcome back! 👋</h2>
                <p className="text-indigo-100">
                  Here's what's happening with your recruitment today
                </p>
              </div>
              <Activity size={64} className="text-white/20" />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <DashboardWidget
              title="Total Jobs"
              value={metrics.totalJobs.value}
              icon={Briefcase}
              color="blue"
              trend={{
                value: `${metrics.totalJobs.change > 0 ? '+' : ''}${metrics.totalJobs.change}%`,
                positive: metrics.totalJobs.change > 0,
              }}
              onClick={() => navigate('/jobs')}
            />
            <DashboardWidget
              title="Active Candidates"
              value={metrics.activeCandidates.value}
              icon={Users}
              color="green"
              trend={{
                value: `${metrics.activeCandidates.change > 0 ? '+' : ''}${metrics.activeCandidates.change}%`,
                positive: metrics.activeCandidates.change > 0,
              }}
              onClick={() => navigate('/candidates')}
            />
            <DashboardWidget
              title="Interviews Scheduled"
              value={metrics.interviewsScheduled.value}
              icon={Calendar}
              color="orange"
              trend={{
                value: `${metrics.interviewsScheduled.change > 0 ? '+' : ''}${metrics.interviewsScheduled.change}%`,
                positive: metrics.interviewsScheduled.change > 0,
              }}
              onClick={() => navigate('/interviews')}
            />
            <DashboardWidget
              title="Time to Hire"
              value={`${metrics.timeToHire.value} days`}
              icon={Clock}
              color="purple"
              trend={{
                value: `${metrics.timeToHire.change > 0 ? '+' : ''}${metrics.timeToHire.change}%`,
                positive: metrics.timeToHire.change < 0,
              }}
              onClick={() => navigate('/analytics')}
            />
          </div>

          {/* Charts and Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Hiring Pipeline */}
            <div
              className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-xl hover:border-indigo-300 transition-all duration-200 transform hover:-translate-y-1"
              onClick={() => navigate('/candidates')}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Hiring Pipeline</h3>
                <ArrowRight size={20} className="text-gray-400" />
              </div>
              <div className="space-y-4">
                {pipelineWithPercentages.map(item => (
                  <div key={item.stage} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{item.stage}</span>
                      <span className="text-sm font-bold text-gray-900">{item.count}</span>
                    </div>
                    <div className="bg-gray-100 h-3 rounded-full overflow-hidden">
                      <div
                        className={`${item.color} h-full rounded-full transition-all duration-500 ease-out group-hover:opacity-90`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Metrics Timeline */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Metrics Activity</h3>
              <MetricsTimeline onViewAll={() => navigate('/analytics')} />
            </div>
          </div>
        </div>
      </div>
    </ProtectedComponent>
  );
}