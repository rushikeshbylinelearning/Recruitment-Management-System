import { useEffect, useState } from 'react';
import { Calendar, Mail, MessageSquare, FileText, CheckCircle, Clock, ArrowRight, User } from 'lucide-react';
import { activityLogsAPI, ActivityLog } from '../services/api';

interface CandidateActivityTimelineProps {
  candidateId: number;
}

export default function CandidateActivityTimeline({ candidateId }: CandidateActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadActivities();
  }, [candidateId]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const response = await activityLogsAPI.getActivitiesForEntity('candidate', candidateId, { limit: 50 });
      
      if (response.success && response.data) {
        setActivities(response.data.activities || []);
      } else {
        setError('Failed to load activities');
      }
    } catch (err) {
      console.error('Error loading activities:', err);
      setError('Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (actionType: string) => {
    switch (actionType) {
      case 'stage_change':
        return <ArrowRight size={16} className="text-blue-500" />;
      case 'email_sent':
        return <Mail size={16} className="text-green-500" />;
      case 'interview_scheduled':
        return <Calendar size={16} className="text-orange-500" />;
      case 'task_created':
        return <CheckCircle size={16} className="text-purple-500" />;
      case 'note_added':
        return <FileText size={16} className="text-gray-500" />;
      case 'notification_sent':
        return <MessageSquare size={16} className="text-indigo-500" />;
      default:
        return <User size={16} className="text-gray-400" />;
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock size={48} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm">No activity yet</p>
        <p className="text-gray-400 text-xs mt-1">Activity will appear here as actions are taken</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Activity Timeline</h3>
        <button
          onClick={loadActivities}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {activities.map((activity, index) => (
          <div key={activity.id} className="flex space-x-3">
            {/* Timeline Line */}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shadow-sm">
                {getIcon(activity.action_type)}
              </div>
              {index < activities.length - 1 && (
                <div className="w-0.5 h-full bg-gray-200 mt-2" />
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 pb-6">
              <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                <p className="text-sm text-gray-900 font-medium">{activity.description}</p>
                
                {/* Metadata */}
                {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    {activity.metadata.previousStage && activity.metadata.newStage && (
                      <span className="inline-flex items-center space-x-1">
                        <span className="px-2 py-0.5 bg-gray-200 rounded">{activity.metadata.previousStage}</span>
                        <ArrowRight size={12} />
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">{activity.metadata.newStage}</span>
                      </span>
                    )}
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-2">
                  {activity.user_name && (
                    <p className="text-xs text-gray-600">
                      by <span className="font-medium">{activity.user_name}</span>
                      {activity.user_role && <span className="text-gray-400"> ({activity.user_role})</span>}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">{getTimeAgo(activity.created_at)}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
