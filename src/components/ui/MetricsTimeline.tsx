import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, Calendar, Users, UserX, PhoneCall, RefreshCw } from 'lucide-react';
import { dashboardAPI } from '../../services/api';
import MetricItem from './MetricItem';

interface DailyMetric {
  date: string;
  uploadedCandidates: number;
  profileNotFound?: number;
  followUps?: number;
}

interface MetricsTimelineProps {
  onViewAll?: () => void;
}

export default function MetricsTimeline({ onViewAll }: MetricsTimelineProps) {
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchMetrics();
    
    // Auto-refresh metrics every 30 seconds
    const intervalId = setInterval(() => {
      fetchMetrics();
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getMetricsTimeline(7);
      if (response.success && response.data) {
        setMetrics(response.data);
      } else {
        setError('Failed to load metrics');
      }
    } catch (err) {
      setError('Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  // Placeholder metrics for future implementation
  const placeholderMetrics = [
    { title: 'Interviews Scheduled', icon: Calendar },
    { title: 'Offers Released', icon: TrendingUp },
    { title: 'Candidates Hired', icon: Users },
  ];

  // Calculate totals for the period
  const totalProfileNotFound = metrics.reduce((sum, m) => sum + (m.profileNotFound || 0), 0);
  const totalFollowUps = metrics.reduce((sum, m) => sum + (m.followUps || 0), 0);

  // Get current counts from daily metrics (will be fetched separately)
  const [currentMetrics, setCurrentMetrics] = useState<{ profileNotFound: number; followUps: number }>({
    profileNotFound: 0,
    followUps: 0
  });
  const [refreshing, setRefreshing] = useState(false);

  const fetchCurrentMetrics = async () => {
    try {
      const response = await dashboardAPI.getDailyMetrics();
      if (response.success && response.data) {
        setCurrentMetrics({
          profileNotFound: response.data.profileNotFound || 0,
          followUps: response.data.followUps || 0
        });
      }
    } catch (err) {
      console.error('Failed to fetch current metrics:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchMetrics(), fetchCurrentMetrics()]);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchCurrentMetrics();
    
    // Auto-refresh current metrics every 30 seconds
    const intervalId = setInterval(() => {
      fetchCurrentMetrics();
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <Activity size={32} className="mx-auto text-red-300 mb-2" />
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Refresh Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Recent Activity</h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Refresh metrics"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Metrics Timeline */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {metrics.length > 0 ? (
          <>
            {metrics.map((metric, index) => (
              <MetricItem
                key={`${metric.date}-${index}`}
                title="Candidates Uploaded"
                value={metric.uploadedCandidates}
                date={metric.date}
                icon={Users}
              />
            ))}

            {/* Profile Not Found Metric - Always show */}
            <div className="pt-2">
              <MetricItem
                title="Profile Not Found"
                value={currentMetrics.profileNotFound}
                date={new Date().toISOString().split('T')[0]}
                icon={UserX}
              />
            </div>

            {/* Follow Ups Metric - Always show */}
            <div className="pt-2">
              <MetricItem
                title="Follow Ups"
                value={currentMetrics.followUps}
                date={new Date().toISOString().split('T')[0]}
                icon={PhoneCall}
              />
            </div>

            {/* Placeholder Cards for Future Metrics */}
            <div className="pt-4 space-y-2 opacity-50">
              {placeholderMetrics.map((placeholder, index) => (
                <div
                  key={`placeholder-${index}`}
                  className="flex items-start space-x-3 p-3 rounded-xl bg-gray-50 cursor-not-allowed"
                  title="Will be available soon"
                >
                  <div className="w-2 h-2 bg-gray-300 rounded-full mt-2 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline space-x-2">
                      <span className="text-sm text-gray-500 font-medium">[Coming Soon] {placeholder.title}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Feature in development</p>
                  </div>
                  <placeholder.icon size={16} className="text-gray-300 mt-1 flex-shrink-0" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <Activity size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm font-medium">No metrics available yet</p>
            <p className="text-gray-400 text-xs mt-1">Metrics will appear as candidates are added</p>
          </div>
        )}
      </div>

      {/* View All Button */}
      {metrics.length > 0 && (
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={onViewAll}
            className="w-full text-center text-sm text-indigo-600 hover:text-indigo-800 font-semibold py-2 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            View All Metrics →
          </button>
        </div>
      )}
    </div>
  );
}
