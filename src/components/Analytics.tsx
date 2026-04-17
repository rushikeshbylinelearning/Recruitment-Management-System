import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { TrendingUp, Users, Briefcase, Clock, Target, Calendar, Download, BarChart3, TrendingDown } from 'lucide-react';
import { analyticsAPI } from '../services/api';

// Simplified interfaces - only load what's needed
interface AnalyticsData {
  overview: {
    total_jobs: number;
    active_jobs: number;
    total_candidates: number;
    hired: number;
    interviews_completed: number;
    avg_time_to_hire: number;
    rejected: number;
    in_interview: number;
    with_offer: number;
    applications_last_30_days: number;
    hires_last_30_days: number;
  };
  sourceEffectiveness: Array<{ source: string; count: number; percentage: number }>;
  monthlyHires: Array<{ month: string; hires: number; applications: number }>;
}

interface FunnelData {
  conversionRates: Array<{ 
    stage: string; 
    converted: number; 
    total: number; 
    rate: number; 
  }>;
}

interface JobPerformanceData {
  jobStats: Array<{
    id: number;
    title: string;
    total_applications: number;
    hires: number;
    hire_rate: number;
  }>;
}

interface RecruiterPerformanceData {
  recruiterStats: Array<{
    id: number;
    name: string;
    candidates_assigned: number;
    hires: number;
    hire_rate: number;
  }>;
}

interface InterviewerPerformanceData {
  interviewerStats: Array<{
    id: number;
    name: string;
    total_interviews: number;
    selections: number;
    selection_rate: number;
  }>;
}

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const isMountedRef = useRef(true);
  
  // Only load essential data
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [jobPerformanceData, setJobPerformanceData] = useState<JobPerformanceData | null>(null);
  const [recruiterData, setRecruiterData] = useState<RecruiterPerformanceData | null>(null);
  const [interviewerData, setInterviewerData] = useState<InterviewerPerformanceData | null>(null);

  // Fetch analytics data - OPTIMIZED to load only essential data
  const fetchAnalyticsData = useCallback(async () => {
    const startTime = performance.now();
    try {
      setLoading(true);
      setError('');
      
      // Load only critical data - reduced from 8 to 5 API calls
      const [dashboardData, funnelData, jobData, recruiterData, interviewerData] = await Promise.all([
        analyticsAPI.getDashboard().catch(() => ({ success: false, data: null })),
        analyticsAPI.getHiringFunnel().catch(() => ({ success: false, data: null })),
        analyticsAPI.getJobPerformance().catch(() => ({ success: false, data: null })),
        analyticsAPI.getRecruiterPerformance().catch(() => ({ success: false, data: null })),
        analyticsAPI.getInterviewerPerformance().catch(() => ({ success: false, data: null }))
      ]);

      if (!isMountedRef.current) return;

      // Set data only if component is still mounted
      if (dashboardData.success && dashboardData.data) setAnalyticsData(dashboardData.data);
      if (funnelData.success && funnelData.data) setFunnelData(funnelData.data);
      if (jobData.success && jobData.data) setJobPerformanceData(jobData.data);
      if (recruiterData.success && recruiterData.data) setRecruiterData(recruiterData.data);
      if (interviewerData.success && interviewerData.data) setInterviewerData(interviewerData.data);
      
      setLastRefresh(new Date());
      
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
    } catch (err) {
      if (isMountedRef.current) {
        setError('Failed to load analytics data');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Load data on mount only
  useEffect(() => {
    isMountedRef.current = true;
    fetchAnalyticsData();
    
    // Cleanup function to prevent memory leaks
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchAnalyticsData]);

  // Memoized KPI cards
  const kpiCards = useMemo(() => {
    if (!analyticsData) return [];
    
    return [
      {
        title: 'Total Applications',
        value: analyticsData.overview.total_candidates,
        change: analyticsData.overview.applications_last_30_days > 0 ? `+${analyticsData.overview.applications_last_30_days} this month` : 'No recent applications',
        positive: analyticsData.overview.applications_last_30_days > 0,
        icon: Users,
        color: 'bg-blue-500',
      },
      {
        title: 'Successful Hires',
        value: analyticsData.overview.hired,
        change: analyticsData.overview.hires_last_30_days > 0 ? `+${analyticsData.overview.hires_last_30_days} this month` : 'No recent hires',
        positive: analyticsData.overview.hires_last_30_days > 0,
        icon: Target,
        color: 'bg-green-500',
      },
      {
        title: 'Average Time to Hire',
        value: `${Math.round(analyticsData.overview.avg_time_to_hire || 0)} days`,
        change: analyticsData.overview.avg_time_to_hire < 30 ? 'Fast hiring' : 'Needs improvement',
        positive: analyticsData.overview.avg_time_to_hire < 30,
        icon: Clock,
        color: 'bg-orange-500',
      },
      {
        title: 'Active Job Openings',
        value: analyticsData.overview.active_jobs,
        change: `${analyticsData.overview.total_jobs} total jobs`,
        positive: true,
        icon: Briefcase,
        color: 'bg-purple-500',
      },
      {
        title: 'In Interview',
        value: analyticsData.overview.in_interview,
        change: `${analyticsData.overview.with_offer} with offers`,
        positive: true,
        icon: Calendar,
        color: 'bg-yellow-500',
      },
      {
        title: 'Rejected',
        value: analyticsData.overview.rejected,
        change: `${Math.round((analyticsData.overview.rejected / analyticsData.overview.total_candidates) * 100)}% rejection rate`,
        positive: false,
        icon: TrendingDown,
        color: 'bg-red-500',
      },
    ];
  }, [analyticsData]);

  // Memoized source data
  const sourceData = useMemo(() => {
    if (!analyticsData) return [];
    return analyticsData.sourceEffectiveness.map(source => ({
      source: source.source,
      percentage: source.percentage,
      applications: source.count
    }));
  }, [analyticsData]);

  // Memoized conversion rates
  const conversionRates = useMemo(() => {
    if (!funnelData) return [];
    const colors = ['bg-blue-500', 'bg-yellow-500', 'bg-orange-500', 'bg-green-500'];
    return funnelData.conversionRates.map((rate, index) => ({
      stage: rate.stage,
      rate: rate.rate,
      converted: rate.converted,
      total: rate.total,
      color: colors[index] || 'bg-gray-500'
    }));
  }, [funnelData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
        No analytics data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Detailed insights and reporting on your hiring process</p>
          <p className="text-sm text-gray-500 mt-1">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={fetchAnalyticsData}
            disabled={loading}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <BarChart3 size={20} />
            <span>{loading ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>
          <button 
            onClick={() => alert('Analytics report would be exported as PDF/Excel')}
            className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Download size={20} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.title} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{kpi.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                </div>
                <div className={`w-12 h-12 ${kpi.color} rounded-lg flex items-center justify-center`}>
                  <Icon className="text-white" size={24} />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <TrendingUp className={`w-4 h-4 ${kpi.positive ? 'text-green-500' : 'text-red-500'}`} />
                <span className={`text-sm ml-1 ${kpi.positive ? 'text-green-500' : 'text-red-500'}`}>
                  {kpi.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Hiring Trends */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Hiring Trends</h3>
          <div className="space-y-4">
            {analyticsData.monthlyHires.length > 0 ? (
              analyticsData.monthlyHires.slice(0, 6).map((month) => {
                const maxHires = Math.max(...analyticsData.monthlyHires.map(m => m.hires), 1);
                return (
                  <div key={month.month} className="flex items-center">
                    <div className="w-16 text-sm text-gray-600">{month.month}</div>
                    <div className="flex-1 mx-4">
                      <div className="bg-gray-200 h-8 rounded-full relative">
                        <div
                          className="bg-blue-500 h-full rounded-full flex items-center justify-end pr-3"
                          style={{ width: `${(month.hires / maxHires) * 100}%` }}
                        >
                          <span className="text-white text-sm font-medium">{month.hires}</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-16 text-sm text-gray-500 text-right">{month.applications} apps</div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                No monthly hiring data available
              </div>
            )}
          </div>
        </div>

        {/* Source Effectiveness */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Source Effectiveness</h3>
          <div className="space-y-4">
            {sourceData.length > 0 ? (
              sourceData.slice(0, 6).map((source) => (
                <div key={source.source} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-900">{source.source}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-24 bg-gray-200 h-2 rounded-full">
                      <div
                        className="bg-blue-500 h-full rounded-full"
                        style={{ width: `${source.percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600 w-12 text-right">{source.percentage}%</span>
                    <span className="text-xs text-gray-500 w-8 text-right">({source.applications})</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                No source data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conversion Rates */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Rates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {conversionRates.map((conversion) => (
            <div key={conversion.stage} className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-3">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-blue-500"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${conversion.rate}, 100`}
                    strokeLinecap="round"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-gray-900">{conversion.rate}%</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">{conversion.stage}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Top Performing Jobs */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Jobs</h3>
          <div className="space-y-3">
            {jobPerformanceData && jobPerformanceData.jobStats.length > 0 ? (
              jobPerformanceData.jobStats.slice(0, 5).map((job) => (
                <div key={job.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{job.title}</p>
                    <p className="text-sm text-gray-600">{job.total_applications} applications • {job.hire_rate}% hire rate</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{job.hires}</p>
                    <p className="text-xs text-gray-500">hires</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                No job performance data available
              </div>
            )}
          </div>
        </div>

        {/* Team Performance */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recruiter Performance</h3>
          <div className="space-y-3">
            {recruiterData && recruiterData.recruiterStats.length > 0 ? (
              recruiterData.recruiterStats.slice(0, 5).map((member) => (
                <div key={member.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{member.name}</p>
                    <p className="text-sm text-gray-600">{member.candidates_assigned} processed • {member.hire_rate}% hire rate</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-600">{member.hires}</p>
                    <p className="text-xs text-gray-500">hires</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                No team performance data available
              </div>
            )}
          </div>
        </div>

        {/* Interviewer Performance */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Interviewer Performance</h3>
          <div className="space-y-3">
            {interviewerData && interviewerData.interviewerStats.length > 0 ? (
              interviewerData.interviewerStats.slice(0, 5).map((interviewer) => (
                <div key={interviewer.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{interviewer.name}</p>
                    <p className="text-sm text-gray-600">{interviewer.total_interviews} interviews • {interviewer.selection_rate}% selection rate</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-purple-600">{interviewer.selections}</p>
                    <p className="text-xs text-gray-500">selections</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                No interviewer performance data available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
