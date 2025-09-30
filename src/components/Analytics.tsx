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
    rejected: number;
    in_interview: number;
    with_offer: number;
    applications_last_30_days: number;
    hires_last_30_days: number;
  };
  sourceEffectiveness: Array<{ source: string; count: number; percentage: number }>;
  monthlyHires: Array<{ month: string; hires: number; applications: number; rejections: number }>;
  stageDistribution: Array<{ stage: string; count: number; percentage: number }>;
  departmentStats: Array<{ 
    department: string; 
    job_count: number; 
    candidate_count: number; 
    hired_count: number; 
    hire_rate: number; 
  }>;
  recentTrends: Array<{ date: string; daily_updates: number }>;
  sourceConversion: Array<{ 
    source: string; 
    total_applications: number; 
    hires: number; 
    conversion_rate: number; 
  }>;
}

interface HiringFunnelData {
  funnelData: Array<{ 
    stage: string; 
    count: number; 
    percentage: number; 
    avg_days_in_stage: number; 
  }>;
  conversionRates: Array<{ 
    stage: string; 
    converted: number; 
    total: number; 
    rate: number; 
  }>;
  funnelTrends: Array<{ 
    month: string; 
    applications: number; 
    hires: number; 
    rejections: number; 
    hire_rate: number; 
  }>;
  stageTransitions: Array<{ 
    transition: string; 
    avg_days: number; 
  }>;
}

interface TimeToHireData {
  overallStats: {
    avg_time_to_hire: number;
    min_time_to_hire: number;
    max_time_to_hire: number;
    std_dev_time_to_hire: number;
    total_hires: number;
    median_time_to_hire: number;
    q1_time_to_hire: number;
    q3_time_to_hire: number;
  };
  byDepartment: Array<{ 
    department: string; 
    avg_time_to_hire: number; 
    min_time_to_hire: number; 
    max_time_to_hire: number; 
    hires_count: number; 
    percentage_of_hires: number; 
  }>;
  bySource: Array<{ 
    source: string; 
    avg_time_to_hire: number; 
    min_time_to_hire: number; 
    max_time_to_hire: number; 
    hires_count: number; 
    percentage_of_hires: number; 
  }>;
  timeTrends: Array<{ 
    month: string; 
    avg_time_to_hire: number; 
    hires_count: number; 
  }>;
  byPosition: Array<{ 
    position: string; 
    avg_time_to_hire: number; 
    hires_count: number; 
  }>;
  hiringVelocity: Array<{ 
    month: string; 
    hires: number; 
    avg_time_to_hire: number; 
  }>;
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
    rejections: number;
    in_interview: number;
    with_offer: number;
    avg_candidate_score: number;
    hire_rate: number;
    rejection_rate: number;
    days_to_fill: number;
    applications_last_30_days: number;
    avg_processing_time: number;
  }>;
  jobTrends: Array<{
    id: number;
    title: string;
    department: string;
    month: string;
    applications: number;
    hires: number;
    avg_score: number;
    hire_rate: number;
  }>;
  performanceBySource: Array<{
    id: number;
    title: string;
    source: string;
    applications_from_source: number;
    hires_from_source: number;
    source_hire_rate: number;
    avg_score: number;
  }>;
  pipelineHealth: Array<{
    id: number;
    title: string;
    stage: string;
    count: number;
    avg_days_in_stage: number;
  }>;
  departmentPerformance: Array<{
    department: string;
    total_jobs: number;
    total_applications: number;
    total_hires: number;
    department_hire_rate: number;
    avg_candidate_score: number;
    avg_processing_time: number;
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
    in_interview: number;
    with_offer: number;
    avg_candidate_score: number;
    hire_rate: number;
    rejection_rate: number;
    avg_processing_time: number;
    new_candidates_last_30_days: number;
  }>;
  recruiterTrends: Array<{
    id: number;
    name: string;
    month: string;
    candidates_processed: number;
    hires: number;
    avg_score: number;
    hire_rate: number;
  }>;
  performanceBySource: Array<{
    id: number;
    name: string;
    source: string;
    candidates_from_source: number;
    hires_from_source: number;
    source_hire_rate: number;
    avg_score: number;
  }>;
  workloadMetrics: Array<{
    id: number;
    name: string;
    total_candidates: number;
    successful_hires: number;
    rejections: number;
    avg_processing_time: number;
    new_this_week: number;
    updated_this_week: number;
  }>;
  pipelineHealth: Array<{
    id: number;
    name: string;
    stage: string;
    count: number;
    avg_days_in_stage: number;
  }>;
}

interface InterviewerPerformanceData {
  interviewerStats: Array<{
    id: number;
    name: string;
    role: string;
    total_interviews: number;
    completed_interviews: number;
    scheduled_interviews: number;
    cancelled_interviews: number;
    avg_rating: number;
    selections: number;
    rejections: number;
    selection_rate: number;
    completion_rate: number;
    avg_interview_duration_hours: number;
  }>;
  interviewerTrends: Array<{
    id: number;
    name: string;
    month: string;
    interviews_conducted: number;
    avg_rating: number;
    selections: number;
  }>;
  performanceByType: Array<{
    id: number;
    name: string;
    interview_type: string;
    total_interviews: number;
    avg_rating: number;
    selections: number;
    selection_rate: number;
  }>;
  workloadDistribution: Array<{
    id: number;
    name: string;
    total_interviews: number;
    interviews_last_30_days: number;
    interviews_last_7_days: number;
    avg_scheduling_lead_time: number;
  }>;
}

interface MonthlyTrendsData {
  trends: Array<{
    month: string;
    applications: number;
    hires: number;
    rejections: number;
    interviews: number;
    offers: number;
    avg_score: number;
    hire_rate: number;
    rejection_rate: number;
    avg_processing_time: number;
  }>;
  trendsBySource: Array<{
    source: string;
    month: string;
    applications: number;
    hires: number;
    hire_rate: number;
  }>;
  trendsByDepartment: Array<{
    department: string;
    month: string;
    applications: number;
    hires: number;
    hire_rate: number;
  }>;
  velocityTrends: Array<{
    month: string;
    applications: number;
    hires: number;
    avg_time_to_decision: number;
    avg_time_to_hire: number;
  }>;
}

interface CandidateQualityData {
  qualityStats: Array<{
    quality_range: string;
    count: number;
    percentage: number;
    hires: number;
    hire_rate: number;
  }>;
  qualityTrends: Array<{
    month: string;
    avg_score: number;
    total_candidates: number;
    high_quality_candidates: number;
    high_quality_percentage: number;
    hires: number;
    hire_rate: number;
  }>;
  qualityBySource: Array<{
    source: string;
    avg_score: number;
    total_candidates: number;
    high_quality_candidates: number;
    high_quality_percentage: number;
    hires: number;
    hire_rate: number;
  }>;
  qualityByDepartment: Array<{
    department: string;
    avg_score: number;
    total_candidates: number;
    high_quality_candidates: number;
    high_quality_percentage: number;
    hires: number;
    hire_rate: number;
  }>;
  qualityByStage: Array<{
    stage: string;
    avg_score: number;
    count: number;
    min_score: number;
    max_score: number;
    high_quality_count: number;
  }>;
}

export default function Analytics() {
  const [dateRange, setDateRange] = useState('last30days');
  const [selectedMetric, setSelectedMetric] = useState('hires');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<{
    loadTime: number;
    dataSize: number;
    lastUpdate: Date;
  } | null>(null);
  
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [funnelData, setFunnelData] = useState<HiringFunnelData | null>(null);
  const [timeToHireData, setTimeToHireData] = useState<TimeToHireData | null>(null);
  const [jobPerformanceData, setJobPerformanceData] = useState<JobPerformanceData | null>(null);
  const [recruiterData, setRecruiterData] = useState<RecruiterPerformanceData | null>(null);
  const [interviewerData, setInterviewerData] = useState<InterviewerPerformanceData | null>(null);
  const [monthlyTrendsData, setMonthlyTrendsData] = useState<MonthlyTrendsData | null>(null);
  const [candidateQualityData, setCandidateQualityData] = useState<CandidateQualityData | null>(null);

  // Data validation helper
  const validateAnalyticsData = (data: any, type: string) => {
    if (!data) return false;
    
    switch (type) {
      case 'dashboard':
        return data.overallStats && typeof data.overallStats.total_candidates === 'number';
      case 'funnel':
        return data.funnelData && Array.isArray(data.funnelData);
      case 'timeToHire':
        return data.timeToHireStats && typeof data.timeToHireStats.avg_time_to_hire === 'number';
      case 'jobPerformance':
        return data.jobStats && Array.isArray(data.jobStats);
      case 'recruiter':
        return data.recruiterStats && Array.isArray(data.recruiterStats);
      case 'interviewer':
        return data.interviewerStats && Array.isArray(data.interviewerStats);
      case 'monthlyTrends':
        return data.trends && Array.isArray(data.trends);
      case 'candidateQuality':
        return data.qualityStats && Array.isArray(data.qualityStats);
      default:
        return true;
    }
  };

  // Fetch analytics data with error recovery
  const fetchAnalyticsData = async () => {
    const startTime = performance.now();
    try {
      setLoading(true);
      setError('');
      
      // Fetch data with individual error handling for each endpoint
      const fetchWithFallback = async (apiCall: () => Promise<any>, fallbackData: any = null) => {
        try {
          const response = await apiCall();
          return response.success ? response.data : fallbackData;
        } catch (error) {
          console.warn('Analytics endpoint failed, using fallback:', error);
          return fallbackData;
        }
      };

      const [
        dashboardData,
        funnelData,
        timeToHireData,
        jobPerformanceData,
        recruiterData,
        interviewerData,
        monthlyTrendsData,
        candidateQualityData
      ] = await Promise.all([
        fetchWithFallback(analyticsAPI.getDashboard),
        fetchWithFallback(analyticsAPI.getHiringFunnel),
        fetchWithFallback(analyticsAPI.getTimeToHire),
        fetchWithFallback(analyticsAPI.getJobPerformance),
        fetchWithFallback(analyticsAPI.getRecruiterPerformance),
        fetchWithFallback(analyticsAPI.getInterviewerPerformance),
        fetchWithFallback(() => analyticsAPI.getMonthlyTrends(12)),
        fetchWithFallback(analyticsAPI.getCandidateQuality)
      ]);

      // Set data only if we have valid responses
      if (validateAnalyticsData(dashboardData, 'dashboard')) setAnalyticsData(dashboardData);
      if (validateAnalyticsData(funnelData, 'funnel')) setFunnelData(funnelData);
      if (validateAnalyticsData(timeToHireData, 'timeToHire')) setTimeToHireData(timeToHireData);
      if (validateAnalyticsData(jobPerformanceData, 'jobPerformance')) setJobPerformanceData(jobPerformanceData);
      if (validateAnalyticsData(recruiterData, 'recruiter')) setRecruiterData(recruiterData);
      if (validateAnalyticsData(interviewerData, 'interviewer')) setInterviewerData(interviewerData);
      if (validateAnalyticsData(monthlyTrendsData, 'monthlyTrends')) setMonthlyTrendsData(monthlyTrendsData);
      if (validateAnalyticsData(candidateQualityData, 'candidateQuality')) setCandidateQualityData(candidateQualityData);
      
      setLastRefresh(new Date());
      
      // Track performance metrics
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      const dataSize = JSON.stringify({
        analyticsData,
        funnelData,
        timeToHireData,
        jobPerformanceData,
        recruiterData,
        interviewerData,
        monthlyTrendsData,
        candidateQualityData
      }).length;
      
      setPerformanceMetrics({
        loadTime,
        dataSize,
        lastUpdate: new Date()
      });
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Failed to load analytics data. Some features may be limited.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchAnalyticsData();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

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

  // Use live source effectiveness data with percentages
  const sourceData = analyticsData.sourceEffectiveness.map(source => ({
    source: source.source,
    percentage: source.percentage,
    applications: source.count
  }));

  // Use real conversion rates from funnel data
  const conversionRates = funnelData?.conversionRates.map((rate, index) => {
    const colors = ['bg-blue-500', 'bg-yellow-500', 'bg-orange-500', 'bg-green-500'];
    return {
      stage: rate.stage,
      rate: rate.rate,
      converted: rate.converted,
      total: rate.total,
      color: colors[index] || 'bg-gray-500'
    };
  }) || [
    { stage: 'Application to Screening', rate: 0, converted: 0, total: 0, color: 'bg-blue-500' },
    { stage: 'Screening to Interview', rate: 0, converted: 0, total: 0, color: 'bg-yellow-500' },
    { stage: 'Interview to Offer', rate: 0, converted: 0, total: 0, color: 'bg-orange-500' },
    { stage: 'Offer to Hire', rate: 0, converted: 0, total: 0, color: 'bg-green-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Detailed insights and reporting on your hiring process</p>
          <p className="text-sm text-gray-500 mt-1">
            Last updated: {lastRefresh.toLocaleTimeString()} {autoRefresh && '(Auto-refresh enabled)'}
            {performanceMetrics && (
              <span className="ml-2 text-xs">
                | Load: {performanceMetrics.loadTime}ms | Data: {(performanceMetrics.dataSize / 1024).toFixed(1)}KB
              </span>
            )}
          </p>
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
          <button 
            onClick={() => fetchAnalyticsData()}
            disabled={loading}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <BarChart3 size={20} />
            <span>{loading ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>
          <button 
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              autoRefresh 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-600 text-white hover:bg-gray-700'
            }`}
          >
            <Clock size={20} />
            <span>{autoRefresh ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}</span>
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

      {/* Enhanced Analytics Sections */}
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

        {/* Department Performance */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Performance</h3>
          <div className="space-y-3">
            {jobPerformanceData && jobPerformanceData.departmentPerformance.length > 0 ? (
              jobPerformanceData.departmentPerformance.slice(0, 5).map((dept) => (
                <div key={dept.department} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{dept.department}</p>
                    <p className="text-sm text-gray-600">{dept.total_applications} applications • {dept.department_hire_rate}% hire rate</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{dept.total_hires}</p>
                    <p className="text-xs text-gray-500">hires</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                No department performance data available
              </div>
            )}
          </div>
        </div>

        {/* Source Conversion Rates */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Source Conversion Rates</h3>
          <div className="space-y-3">
            {analyticsData.sourceConversion.length > 0 ? (
              analyticsData.sourceConversion.slice(0, 5).map((source) => (
                <div key={source.source} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{source.source}</p>
                    <p className="text-sm text-gray-600">{source.total_applications} applications</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-600">{source.conversion_rate}%</p>
                    <p className="text-xs text-gray-500">conversion</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                No source conversion data available
              </div>
            )}
          </div>
        </div>

        {/* Recent Insights */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h3>
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
            {candidateQualityData && candidateQualityData.qualityStats.length > 0 && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm font-medium text-purple-900">Candidate Quality</p>
                <p className="text-xs text-purple-700 mt-1">{candidateQualityData.qualityStats[0]?.percentage}% are {candidateQualityData.qualityStats[0]?.quality_range}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}