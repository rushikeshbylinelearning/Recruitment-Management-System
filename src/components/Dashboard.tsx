import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Briefcase, Clock, Target, Calendar, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI } from '../services/api';

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
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const response = await dashboardAPI.getOverview();
        if (response.success && response.data) {
          setDashboardData(response.data);
        } else {
          setError('Failed to load dashboard data');
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Format time ago
  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hour${Math.floor(diffInMinutes / 60) > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffInMinutes / 1440)} day${Math.floor(diffInMinutes / 1440) > 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
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

  if (!dashboardData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
        No dashboard data available
      </div>
    );
  }

  const stats = [
    {
      title: 'Total Jobs',
      value: dashboardData.metrics.totalJobs.value,
      change: `${dashboardData.metrics.totalJobs.change > 0 ? '+' : ''}${dashboardData.metrics.totalJobs.change}%`,
      positive: dashboardData.metrics.totalJobs.change > 0,
      icon: Briefcase,
      color: 'bg-blue-500',
      section: 'jobs',
    },
    {
      title: 'Active Candidates',
      value: dashboardData.metrics.activeCandidates.value,
      change: `${dashboardData.metrics.activeCandidates.change > 0 ? '+' : ''}${dashboardData.metrics.activeCandidates.change}%`,
      positive: dashboardData.metrics.activeCandidates.change > 0,
      icon: Users,
      color: 'bg-green-500',
      section: 'candidates',
    },
    {
      title: 'Interviews Scheduled',
      value: dashboardData.metrics.interviewsScheduled.value,
      change: `${dashboardData.metrics.interviewsScheduled.change > 0 ? '+' : ''}${dashboardData.metrics.interviewsScheduled.change}%`,
      positive: dashboardData.metrics.interviewsScheduled.change > 0,
      icon: Calendar,
      color: 'bg-orange-500',
      section: 'candidates',
    },
    {
      title: 'Time to Hire',
      value: `${dashboardData.metrics.timeToHire.value} days`,
      change: `${dashboardData.metrics.timeToHire.change > 0 ? '+' : ''}${dashboardData.metrics.timeToHire.change}%`,
      positive: dashboardData.metrics.timeToHire.change < 0, // Negative change is good for time to hire
      icon: Clock,
      color: 'bg-purple-500',
      section: 'analytics',
    },
  ];

  // Get pipeline stages with real data
  const pipelineStages = [
    { stage: 'Applied', count: dashboardData.pipeline.Applied || 0, color: 'bg-blue-500' },
    { stage: 'Screening', count: dashboardData.pipeline.Screening || 0, color: 'bg-yellow-500' },
    { stage: 'Interview', count: dashboardData.pipeline.Interview || 0, color: 'bg-orange-500' },
    { stage: 'Offer', count: dashboardData.pipeline.Offer || 0, color: 'bg-purple-500' },
    { stage: 'Hired', count: dashboardData.pipeline.Hired || 0, color: 'bg-green-500' },
  ];

  // Calculate percentages for pipeline visualization
  const maxCount = Math.max(...pipelineStages.map(stage => stage.count), 1);
  const pipelineWithPercentages = pipelineStages.map(stage => ({
    ...stage,
    percentage: (stage.count / maxCount) * 100
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back! Here's what's happening with your hiring process.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div 
              key={stat.title} 
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all duration-200"
              onClick={() => navigate(`/${stat.section}`)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                  <Icon className="text-white" size={24} />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <TrendingUp className={`w-4 h-4 ${stat.positive ? 'text-green-500' : 'text-red-500'}`} />
                <span className={`text-sm ml-1 ${stat.positive ? 'text-green-500' : 'text-red-500'}`}>
                  {stat.change} from last month
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hiring Pipeline */}
        <div 
          className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all duration-200"
          onClick={() => navigate('/candidates')}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Hiring Pipeline</h3>
          <div className="space-y-4">
            {pipelineWithPercentages.map((item) => (
              <div key={item.stage} className="flex items-center">
                <div className="w-20 text-sm text-gray-600">{item.stage}</div>
                <div className="flex-1 mx-4">
                  <div className="bg-gray-200 h-8 rounded-full relative">
                    <div
                      className={`${item.color} h-full rounded-full flex items-center justify-end pr-3`}
                      style={{ width: `${item.percentage}%` }}
                    >
                      <span className="text-white text-sm font-medium">{item.count}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {dashboardData.activities.length > 0 ? (
              dashboardData.activities.slice(0, 8).map((activity) => (
                <div 
                  key={activity.id} 
                  className="flex items-start space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                  onClick={() => {
                    if (activity.type === 'candidate_update' || activity.type === 'new_application') {
                      navigate('/candidates');
                    } else if (activity.type === 'task_update') {
                      navigate('/tasks');
                    } else if (activity.type === 'job_posted') {
                      navigate('/jobs');
                    }
                  }}
                >
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{activity.description}</p>
                    {activity.candidate_name && activity.position && (
                      <p className="text-xs text-gray-600">{activity.candidate_name} - {activity.position}</p>
                    )}
                    {activity.user && (
                      <p className="text-xs text-gray-600">by {activity.user}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{getTimeAgo(activity.timestamp)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No recent activity</p>
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button 
              onClick={() => navigate('/tasks')}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View All Activities →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}