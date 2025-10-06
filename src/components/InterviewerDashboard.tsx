import { useState, useEffect } from 'react';
import { Users, Clock, Calendar, Star, MessageSquare, UserCheck, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { candidatesAPI, interviewsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface InterviewerDashboardData {
  metrics: {
    assignedCandidates: { value: number; change: number; trend: string };
    interviewsScheduled: { value: number; change: number; trend: string };
    pendingReviews: { value: number; change: number; trend: string };
    completedInterviews: { value: number; change: number; trend: string };
  };
  assignedCandidates: Array<{
    id: number;
    name: string;
    position: string;
    stage: string;
    interviewDate?: string;
    interviewStatus?: string;
    hasNotes: boolean;
  }>;
  recentInterviews: Array<{
    id: number;
    candidateName: string;
    position: string;
    interviewDate: string;
    status: string;
    type: string;
  }>;
}

export default function InterviewerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<InterviewerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        
        // Get interviews assigned to this interviewer
        const interviewsResponse = await interviewsAPI.getInterviews({ 
          interviewerId: user.id,
          limit: 100 
        });
        
        if (interviewsResponse.success && interviewsResponse.data) {
          const interviews = interviewsResponse.data.interviews || [];
          
          // Get unique candidate IDs from interviews
          const candidateIds = [...new Set(interviews.map(i => i.candidate_id))];
          
          // Get candidate details for assigned candidates
          const candidatesResponse = await candidatesAPI.getCandidates({ limit: 100 });
          const allCandidates = candidatesResponse.success && candidatesResponse.data ? candidatesResponse.data.candidates || [] : [];
          const assignedCandidates = allCandidates.filter(c => candidateIds.includes(c.id));
          
          // Calculate metrics
          const assignedCandidatesCount = assignedCandidates.length;
          const scheduledInterviews = interviews.filter(i => i.status === 'Scheduled').length;
          const pendingReviews = assignedCandidates.filter(c => 
            c.stage === 'Interview' && (!c.notes || !Array.isArray(c.notes) || c.notes.length === 0)
          ).length;
          const completedInterviews = interviews.filter(i => i.status === 'Completed').length;
          
          // Prepare assigned candidates data
          const candidatesData = assignedCandidates.map(candidate => {
            const candidateInterviews = interviews.filter(i => i.candidate_id === candidate.id);
            const latestInterview = candidateInterviews.sort((a, b) => 
              new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime()
            )[0];
            
            return {
              id: candidate.id,
              name: candidate.name,
              position: candidate.position,
              stage: candidate.stage,
              interviewDate: latestInterview?.scheduled_date,
              interviewStatus: latestInterview?.status,
              hasNotes: Boolean(candidate.notes && Array.isArray(candidate.notes) && candidate.notes.length > 0)
            };
          });
          
          // Prepare recent interviews data
          const recentInterviewsData = interviews
            .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime())
            .slice(0, 5)
            .map(interview => ({
              id: interview.id,
              candidateName: interview.candidate_name || 'Unknown Candidate',
              position: interview.candidate_position || 'Unknown Position',
              interviewDate: interview.scheduled_date,
              status: interview.status,
              type: interview.type
            }));
          
          const interviewerData: InterviewerDashboardData = {
            metrics: {
              assignedCandidates: { value: assignedCandidatesCount, change: 0, trend: 'stable' },
              interviewsScheduled: { value: scheduledInterviews, change: 0, trend: 'stable' },
              pendingReviews: { value: pendingReviews, change: 0, trend: 'stable' },
              completedInterviews: { value: completedInterviews, change: 0, trend: 'stable' }
            },
            assignedCandidates: candidatesData,
            recentInterviews: recentInterviewsData
          };
          
          setDashboardData(interviewerData);
        } else {
          setError('Failed to load interviewer data');
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user?.id]);


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading interviewer dashboard...</p>
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
      title: 'Assigned Candidates',
      value: dashboardData.metrics.assignedCandidates.value,
      change: `${dashboardData.metrics.assignedCandidates.change > 0 ? '+' : ''}${dashboardData.metrics.assignedCandidates.change}%`,
      positive: dashboardData.metrics.assignedCandidates.change > 0,
      icon: Users,
      color: 'bg-blue-500',
      section: 'interviewer-candidates',
    },
    {
      title: 'Interviews Scheduled',
      value: dashboardData.metrics.interviewsScheduled.value,
      change: `${dashboardData.metrics.interviewsScheduled.change > 0 ? '+' : ''}${dashboardData.metrics.interviewsScheduled.change}%`,
      positive: dashboardData.metrics.interviewsScheduled.change > 0,
      icon: Calendar,
      color: 'bg-orange-500',
      section: 'interviewer-candidates',
    },
    {
      title: 'Pending Reviews',
      value: dashboardData.metrics.pendingReviews.value,
      change: `${dashboardData.metrics.pendingReviews.change > 0 ? '+' : ''}${dashboardData.metrics.pendingReviews.change}%`,
      positive: dashboardData.metrics.pendingReviews.change > 0,
      icon: Star,
      color: 'bg-purple-500',
      section: 'interviewer-candidates',
    },
    {
      title: 'Completed Interviews',
      value: dashboardData.metrics.completedInterviews.value,
      change: `${dashboardData.metrics.completedInterviews.change > 0 ? '+' : ''}${dashboardData.metrics.completedInterviews.change}%`,
      positive: dashboardData.metrics.completedInterviews.change > 0,
      icon: UserCheck,
      color: 'bg-green-500',
      section: 'interviewer-candidates',
    },
  ];

  // Get status color for interview status
  const getInterviewStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-100 text-blue-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      case 'Rescheduled': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Interviewer Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome! Review candidates and manage your assigned interviews.</p>
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
                <Clock className={`w-4 h-4 ${stat.positive ? 'text-green-500' : 'text-red-500'}`} />
                <span className={`text-sm ml-1 ${stat.positive ? 'text-green-500' : 'text-red-500'}`}>
                  {stat.change} from last period
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assigned Candidates */}
        <div 
          className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all duration-200"
          onClick={() => navigate('/interviewer-candidates')}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Assigned Candidates</h3>
          <div className="space-y-4">
            {dashboardData.assignedCandidates.length > 0 ? (
              dashboardData.assignedCandidates.slice(0, 5).map((candidate) => (
                <div key={candidate.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {candidate.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{candidate.name}</p>
                      <p className="text-sm text-gray-600">{candidate.position}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getInterviewStatusColor(candidate.interviewStatus || 'Scheduled')}`}>
                      {candidate.interviewStatus || 'Scheduled'}
                    </span>
                    {candidate.hasNotes ? (
                      <MessageSquare className="text-green-600" size={16} />
                    ) : (
                      <AlertCircle className="text-orange-500" size={16} />
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Users className="mx-auto text-gray-400 mb-2" size={32} />
                <p className="text-gray-500 text-sm">No candidates assigned to you yet</p>
                <p className="text-gray-400 text-xs mt-1">Contact your HR team to get assigned interviews</p>
              </div>
            )}
          </div>
          {dashboardData.assignedCandidates.length > 5 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button 
                onClick={() => navigate('/interviewer-candidates')}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View All Assigned Candidates ({dashboardData.assignedCandidates.length}) →
              </button>
            </div>
          )}
        </div>

        {/* Recent Interviews */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Interviews</h3>
          <div className="space-y-4">
            {dashboardData.recentInterviews.length > 0 ? (
              dashboardData.recentInterviews.map((interview) => (
                <div 
                  key={interview.id} 
                  className="flex items-start space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                  onClick={() => navigate('/interviewer-candidates')}
                >
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 font-medium">{interview.candidateName}</p>
                    <p className="text-xs text-gray-600">{interview.position}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {interview.type} • {new Date(interview.interviewDate).toLocaleDateString()}
                    </p>
                    <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${getInterviewStatusColor(interview.status)}`}>
                      {interview.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Calendar className="mx-auto text-gray-400 mb-2" size={32} />
                <p className="text-gray-500 text-sm">No recent interviews</p>
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button 
              onClick={() => navigate('/interviewer-candidates')}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View All Interviews →
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={() => navigate('/interviewer-candidates')}
            className="flex items-center space-x-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <Users className="text-blue-600" size={24} />
            <div className="text-left">
              <p className="font-medium text-blue-900">Review Candidates</p>
              <p className="text-sm text-blue-700">View and evaluate your assigned candidates</p>
            </div>
          </button>
          
          <button 
            onClick={() => navigate('/interviewer-candidates')}
            className="flex items-center space-x-3 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
          >
            <MessageSquare className="text-green-600" size={24} />
            <div className="text-left">
              <p className="font-medium text-green-900">Add Interview Notes</p>
              <p className="text-sm text-green-700">Add notes and recommendations for candidates</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}