import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { TrendingUp, Users, Briefcase, Clock, Calendar, ArrowRight, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI } from '../services/api';
import ProtectedComponent from './ProtectedComponent';
import DashboardWidget from './ui/DashboardWidget';

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
  const isMountedRef = useRef(true);

  // Fetch dashboard data - MEMOIZED
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getOverview();
      if (isMountedRef.current) {
        if (response.success && response.data) {
          setDashboardData(response.data);
        } else {
          setError('Failed to load dashboard data');
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError('Failed to load dashboard data');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Fetch dashboard data on mount only
  useEffect(() => {
    isMountedRef.current = true;
    fetchDashboardData();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchDashboardData]);

  // Format time ago - MEMOIZED
  const getTimeAgo = useCallback((timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  }, []);

  // Get pipeline stages with real data - MEMOIZED (MUST be before early returns)
  const pipelineWithPercentages = useMemo(() => {
    if (!dashboardData) return [];
    
    const pipelineStages = [
      { stage: 'Applied', count: dashboardData.pipeline.Applied || 0, color: 'bg-blue-500' },
      { stage: 'Screening', count: dashboardData.pipeline.Screening || 0, color: 'bg-yellow-500' },
      { stage: 'Interview', count: dashboardData.pipeline.Interview || 0, color: 'bg-orange-500' },
      { stage: 'Offer', count: dashboardData.pipeline.Offer || 0, color: 'bg-purple-500' },
      { stage: 'Hired', count: dashboardData.pipeline.Hired || 0, color: 'bg-green-500' },
    ];

    const maxCount = Math.max(...pipelineStages.map(stage => stage.count), 1);
    return pipelineStages.map(stage => ({
      ...stage,
      percentage: (stage.count / maxCount) * 100
    }));
  }, [dashboardData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-sm">
        {error}
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-6 py-4 rounded-xl shadow-sm">
        No dashboard data available
      </div>
    );
  }

  return (
    <ProtectedComponent module="dashboard" action="view">
      <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">Welcome back! 👋</h2>
            <p className="text-indigo-100">Here's what's happening with your recruitment today</p>
          </div>
          <Activity size={64} className="text-white/20" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardWidget
          title="Total Jobs"
          value={dashboardData.metrics.totalJobs.value}
          icon={Briefcase}
          color="blue"
          trend={{
            value: `${dashboardData.metrics.totalJobs.change > 0 ? '+' : ''}${dashboardData.metrics.totalJobs.change}%`,
            positive: dashboardData.metrics.totalJobs.change > 0
          }}
          onClick={() => navigate('/jobs')}
        />
        
        <DashboardWidget
          title="Active Candidates"
          value={dashboardData.metrics.activeCandidates.value}
          icon={Users}
          color="green"
          trend={{
            value: `${dashboardData.metrics.activeCandidates.change > 0 ? '+' : ''}${dashboardData.metrics.activeCandidates.change}%`,
            positive: dashboardData.metrics.activeCandidates.change > 0
          }}
          onClick={() => navigate('/candidates')}
        />
        
        <DashboardWidget
          title="Interviews Scheduled"
          value={dashboardData.metrics.interviewsScheduled.value}
          icon={Calendar}
          color="orange"
          trend={{
            value: `${dashboardData.metrics.interviewsScheduled.change > 0 ? '+' : ''}${dashboardData.metrics.interviewsScheduled.change}%`,
            positive: dashboardData.metrics.interviewsScheduled.change > 0
          }}
          onClick={() => navigate('/interviews')}
        />
        
        <DashboardWidget
          title="Time to Hire"
          value={`${dashboardData.metrics.timeToHire.value} days`}
          icon={Clock}
          color="purple"
          trend={{
            value: `${dashboardData.metrics.timeToHire.change > 0 ? '+' : ''}${dashboardData.metrics.timeToHire.change}%`,
            positive: dashboardData.metrics.timeToHire.change < 0
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
            {pipelineWithPercentages.map((item) => (
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

        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Activity</h3>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {dashboardData.activities && dashboardData.activities.length > 0 ? (
              dashboardData.activities.slice(0, 8).map((activity, index) => (
                <div 
                  key={`activity-${activity.id || index}-${index}`} 
                  className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer group"
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
                  <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 group-hover:scale-125 transition-transform"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 font-medium">{activity.description}</p>
                    {activity.candidate_name && activity.position && (
                      <p className="text-xs text-gray-600 mt-1">{activity.candidate_name} - {activity.position}</p>
                    )}
                    {activity.user && (
                      <p className="text-xs text-gray-500 mt-1">by {activity.user}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{getTimeAgo(activity.timestamp)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Activity size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">No recent activity</p>
              </div>
            )}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button 
              onClick={() => navigate('/tasks')}
              className="w-full text-center text-sm text-indigo-600 hover:text-indigo-800 font-semibold py-2 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              View All Activities →
            </button>
          </div>
        </div>
      </div>
      </div>
    </ProtectedComponent>
  );
}