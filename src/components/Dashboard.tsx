import React from 'react';
import { TrendingUp, Users, Briefcase, Clock, Target, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  
  // Temporary mock data - will be replaced with real API data later
  const analytics = {
    totalJobs: 24,
    activeJobs: 18,
    totalCandidates: 156,
    hired: 12,
    interviews: 8,
    timeToHire: 28,
    sourceEffectiveness: {
      'LinkedIn': 45,
      'Indeed': 30,
      'Company Website': 15,
      'Referrals': 10
    },
    monthlyHires: [
      { month: 'Jan', hires: 3, applications: 45 },
      { month: 'Feb', hires: 5, applications: 52 },
      { month: 'Mar', hires: 4, applications: 48 },
      { month: 'Apr', hires: 7, applications: 61 },
      { month: 'May', hires: 6, applications: 58 },
      { month: 'Jun', hires: 8, applications: 67 }
    ]
  };
  const stats = [
    {
      title: 'Total Jobs',
      value: analytics.totalJobs,
      change: '+5%',
      positive: true,
      icon: Briefcase,
      color: 'bg-blue-500',
      section: 'jobs',
    },
    {
      title: 'Active Candidates',
      value: analytics.totalCandidates,
      change: '+12%',
      positive: true,
      icon: Users,
      color: 'bg-green-500',
      section: 'candidates',
    },
    {
      title: 'Interviews Scheduled',
      value: analytics.interviews,
      change: '+8%',
      positive: true,
      icon: Calendar,
      color: 'bg-orange-500',
      section: 'candidates',
    },
    {
      title: 'Time to Hire',
      value: `${analytics.timeToHire} days`,
      change: '-3%',
      positive: true,
      icon: Clock,
      color: 'bg-purple-500',
      section: 'analytics',
    },
  ];

  const recentActivity = [
    { action: 'New application received', candidate: 'Sarah Johnson', job: 'Frontend Developer', time: '5 min ago', section: 'candidates' },
    { action: 'Interview scheduled', candidate: 'Mike Chen', job: 'Product Manager', time: '15 min ago', section: 'candidates' },
    { action: 'Candidate moved to offer stage', candidate: 'Emma Wilson', job: 'UX Designer', time: '1 hour ago', section: 'candidates' },
    { action: 'Job posted to LinkedIn', job: 'Backend Developer', time: '2 hours ago', section: 'jobs' },
  ];

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
            {[
              { stage: 'Applied', count: 145, color: 'bg-blue-500', percentage: 100 },
              { stage: 'Screening', count: 67, color: 'bg-yellow-500', percentage: 46 },
              { stage: 'Interview', count: 23, color: 'bg-orange-500', percentage: 16 },
              { stage: 'Offer', count: 8, color: 'bg-purple-500', percentage: 6 },
              { stage: 'Hired', count: 5, color: 'bg-green-500', percentage: 3 },
            ].map((item) => (
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
            {recentActivity.map((activity, index) => (
              <div 
                key={index} 
                className="flex items-start space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                onClick={() => navigate(`/${activity.section}`)}
              >
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{activity.action}</p>
                  {activity.candidate && (
                    <p className="text-xs text-gray-600">{activity.candidate} - {activity.job}</p>
                  )}
                  {!activity.candidate && activity.job && (
                    <p className="text-xs text-gray-600">{activity.job}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
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