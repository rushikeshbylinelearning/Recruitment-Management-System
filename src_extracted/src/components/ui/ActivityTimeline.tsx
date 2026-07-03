import { Calendar, Mail, MessageSquare, User, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';

export interface TimelineActivity {
  id: number;
  type: 'stage_change' | 'email_sent' | 'interview_scheduled' | 'note_added' | 'status_update';
  description: string;
  timestamp: string;
  user?: string;
  metadata?: any;
}

interface ActivityTimelineProps {
  activities: TimelineActivity[];
}

export default function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'stage_change':
        return <CheckCircle size={16} className="text-blue-500" />;
      case 'email_sent':
        return <Mail size={16} className="text-green-500" />;
      case 'interview_scheduled':
        return <Calendar size={16} className="text-orange-500" />;
      case 'note_added':
        return <FileText size={16} className="text-purple-500" />;
      case 'status_update':
        return <Clock size={16} className="text-gray-500" />;
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

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock size={48} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => (
        <div key={activity.id} className="flex space-x-3">
          {/* Timeline Line */}
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shadow-sm">
              {getIcon(activity.type)}
            </div>
            {index < activities.length - 1 && (
              <div className="w-0.5 h-full bg-gray-200 mt-2" />
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 pb-6">
            <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
              <p className="text-sm text-gray-900 font-medium">{activity.description}</p>
              <div className="flex items-center justify-between mt-2">
                {activity.user && (
                  <p className="text-xs text-gray-600">by {activity.user}</p>
                )}
                <p className="text-xs text-gray-400">{getTimeAgo(activity.timestamp)}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
