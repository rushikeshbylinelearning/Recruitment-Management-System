import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Briefcase, Clock, Target, Calendar, Download, Filter, BarChart3, TrendingDown, Award, UserCheck } from 'lucide-react';
import { analyticsAPI } from '../services/api';

interface AnalyticsData {
  overview: {
    total_jobs: number;
    active_jobs: number;
    total_candidates: number;
    hired: number;
    interviews_completed: number;
    avg_time_to_hire: number;
  };
  sourceEffectiveness: Array<{ source: string; count: number }>;
  monthlyHires: Array<{ month: string; hires: number; applications: number }>;
  stageDistribution: Array<{ stage: string; count: number }>;
  departmentStats: Array<{ department: string; job_count: number; candidate_count: number }>;
}

interface HiringFunnelData {
  funnelData: Array<{ stage: string; count: number; percentage: number }>;
  conversionRates: Array<{ stage: string; rate: number }>;
}

interface TimeToHireData {
  overallStats: {
    avg_time_to_hire: number;
    min_time_to_hire: number;
    max_time_to_hire: number;
    std_dev_time_to_hire: number;
  };
  byDepartment: Array<{ department: string; avg_time_to_hire: number; hires_count: number }>;
  bySource: Array<{ source: string; avg_time_to_hire: number; hires_count: number }>;
}

interface JobPerformanceData {
  jobStats: Array<{
    id: number;
    title: string;
    department: string;
    status: string;
    posted_date: string;
    deadline: string;
    total_applications: number;
    hires: number;
    avg_candidate_score: number;
    hire_rate: number;
    days_to_fill: number;
  }>;
}

interface RecruiterPerformanceData {
  recruiterStats: Array<{
    id: number;
    name: string;
    role: string;
    candidates_assigned: number;
    hires: number;
    rejections: number;
    avg_candidate_score: number;
    hire_rate: number;
  }>;
}

export default function Analytics() {
  const [dateRange, setDateRange] = useState('last30days');
  const [selectedMetric, setSelectedMetric] = useState('hires');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [funnelData, setFunnelData] = useState<HiringFunnelData | null>(null);
  const [timeToHireData, setTimeToHireData] = useState<TimeToHireData | null>(null);
  const [jobPerformanceData, setJobPerformanceData] = useState<JobPerformanceData | null>(null);
  const [recruiterData, setRecruiterData] = useState<RecruiterPerformanceData | null>(null);

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setLoading(true);
        const [
          dashboardResponse,
          funnelResponse,
          timeToHireResponse,
          jobPerformanceResponse,
          recruiterResponse
        ] = await Promise.all([
          analyticsAPI.getDashboard(),
          analyticsAPI.getHiringFunnel(),
          analyticsAPI.getTimeToHire(),
          analyticsAPI.getJobPerformance(),
          analyticsAPI.getRecruiterPerformance()
        ]);

        if (dashboardResponse.success && dashboardResponse.data) {
          setAnalyticsData(dashboardResponse.data);
        }
        if (funnelResponse.success && funnelResponse.data) {
          setFunnelData(funnelResponse.data);
        }
        if (timeToHireResponse.success && timeToHireResponse.data) {
          setTimeToHireData(timeToHireResponse.data);
        }
        if (jobPerformanceResponse.success && jobPerformanceResponse.data) {
          setJobPerformanceData(jobPerformanceResponse.data);
        }
        if (recruiterResponse.success && recruiterResponse.data) {
          setRecruiterData(recruiterResponse.data);
        }
      } catch (err) {
        console.error('Error fetching analytics data:', err);
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, []);

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

  const kpiCards = [
    {
      title: 'Total Applications',
      value: analyticsData.overview.total_candidates,
      change: '+15%', // Mock change
      positive: true,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      title: 'Successful Hires',
      value: analyticsData.overview.hired,
      change: '+8%', // Mock change
      positive: true,
      icon: Target,
      color: 'bg-green-500',
    },
    {
      title: 'Average Time to Hire',
      value: `${Math.round(analyticsData.overview.avg_time_to_hire || 0)} days`,
      change: '-5%', // Mock change
      positive: true,
      icon: Clock,
      color: 'bg-orange-500',
    },
    {
      title: 'Active Job Openings',
      value: analyticsData.overview.active_jobs,
      change: '+3%', // Mock change
      positive: true,
      icon: Briefcase,
      color: 'bg-purple-500',
    },
  ];

  // Calculate source effectiveness percentages
  const totalSourceApplications = analyticsData.sourceEffectiveness.reduce((sum, source) => sum + source.count, 0);
  const sourceData = analyticsData.sourceEffectiveness.map(source => ({
    source: source.source,
    percentage: totalSourceApplications > 0 ? Math.round((source.count / totalSourceApplications) * 100) : 0,
    applications: source.count
  }));

  // Use real conversion rates from funnel data
  const conversionRates = funnelData?.conversionRates.map((rate, index) => {
    const colors = ['bg-blue-500', 'bg-yellow-500', 'bg-orange-500', 'bg-green-500'];
    return {
      stage: rate.stage,
      rate: rate.rate,
      color: colors[index] || 'bg-gray-500'
    };
  }) || [
    { stage: 'Application to Screening', rate: 0, color: 'bg-blue-500' },
    { stage: 'Screening to Interview', rate: 0, color: 'bg-yellow-500' },
    { stage: 'Interview to Offer', rate: 0, color: 'bg-orange-500' },
    { stage: 'Offer to Hire', rate: 0, color: 'bg-green-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Detailed insights and reporting on your hiring process</p>
        </div>
        <div className="flex space-x-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="last7days">Last 7 days</option>
            <option value="last30days">Last 30 days</option>
            <option value="last90days">Last 90 days</option>
            <option value="lastyear">Last year</option>
          </select>
          <button className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <Download size={20} />
            <span onClick={() => alert('Analytics report would be exported as PDF/Excel')}>
              Export Report
            </span>
          </button>
          <button className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
            <BarChart3 size={20} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  {kpi.change} from last period
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
              analyticsData.monthlyHires.map((month) => {
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
              sourceData.map((source) => (
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

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Jobs</h3>
          <div className="space-y-3">
            {jobPerformanceData && jobPerformanceData.jobStats.length > 0 ? (
              jobPerformanceData.jobStats.slice(0, 4).map((job) => (
                <div key={job.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{job.title}</p>
                    <p className="text-sm text-gray-600">{job.total_applications} applications</p>
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

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Performance</h3>
          <div className="space-y-3">
            {recruiterData && recruiterData.recruiterStats.length > 0 ? (
              recruiterData.recruiterStats.slice(0, 4).map((member) => (
                <div key={member.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{member.name}</p>
                    <p className="text-sm text-gray-600">{member.candidates_assigned} processed</p>
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

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Insights</h3>
          <div className="space-y-4">
            {sourceData.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900">{sourceData[0]?.source} is your top source</p>
                <p className="text-xs text-blue-700 mt-1">{sourceData[0]?.percentage}% of all applications come from {sourceData[0]?.source}</p>
              </div>
            )}
            {timeToHireData && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-900">Average time to hire</p>
                <p className="text-xs text-green-700 mt-1">{Math.round(timeToHireData.overallStats.avg_time_to_hire || 0)} days</p>
              </div>
            )}
            {conversionRates.length > 0 && conversionRates[2] && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm font-medium text-orange-900">Interview conversion rate</p>
                <p className="text-xs text-orange-700 mt-1">{conversionRates[2].rate}% of interviews result in offers</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}