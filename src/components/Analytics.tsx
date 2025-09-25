import React, { useState } from 'react';
import { TrendingUp, Users, Briefcase, Clock, Target, Calendar, Download, Filter, BarChart3 } from 'lucide-react';
import { Analytics as AnalyticsType } from '../types';

interface AnalyticsProps {
  analytics: AnalyticsType;
  onShowCandidateAnalytics?: () => void;
}

export default function Analytics({ analytics, onShowCandidateAnalytics }: AnalyticsProps) {
  const [dateRange, setDateRange] = useState('last30days');
  const [selectedMetric, setSelectedMetric] = useState('hires');

  const kpiCards = [
    {
      title: 'Total Applications',
      value: analytics.totalCandidates,
      change: '+15%',
      positive: true,
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      title: 'Successful Hires',
      value: analytics.hired,
      change: '+8%',
      positive: true,
      icon: Target,
      color: 'bg-green-500',
    },
    {
      title: 'Average Time to Hire',
      value: `${analytics.timeToHire} days`,
      change: '-5%',
      positive: true,
      icon: Clock,
      color: 'bg-orange-500',
    },
    {
      title: 'Active Job Openings',
      value: analytics.activeJobs,
      change: '+3%',
      positive: true,
      icon: Briefcase,
      color: 'bg-purple-500',
    },
  ];

  const sourceData = Object.entries(analytics.sourceEffectiveness).map(([source, percentage]) => ({
    source,
    percentage,
    applications: Math.floor((percentage / 100) * analytics.totalCandidates)
  }));

  const conversionRates = [
    { stage: 'Application to Screening', rate: 46, color: 'bg-blue-500' },
    { stage: 'Screening to Interview', rate: 34, color: 'bg-yellow-500' },
    { stage: 'Interview to Offer', rate: 35, color: 'bg-orange-500' },
    { stage: 'Offer to Hire', rate: 63, color: 'bg-green-500' },
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
          <button 
            onClick={onShowCandidateAnalytics}
            className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <BarChart3 size={20} />
            <span>Candidate Analytics</span>
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
            {analytics.monthlyHires.map((month) => (
              <div key={month.month} className="flex items-center">
                <div className="w-12 text-sm text-gray-600">{month.month}</div>
                <div className="flex-1 mx-4">
                  <div className="bg-gray-200 h-8 rounded-full relative">
                    <div
                      className="bg-blue-500 h-full rounded-full flex items-center justify-end pr-3"
                      style={{ width: `${(month.hires / Math.max(...analytics.monthlyHires.map(m => m.hires))) * 100}%` }}
                    >
                      <span className="text-white text-sm font-medium">{month.hires}</span>
                    </div>
                  </div>
                </div>
                <div className="w-16 text-sm text-gray-500 text-right">{month.applications} apps</div>
              </div>
            ))}
          </div>
        </div>

        {/* Source Effectiveness */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Source Effectiveness</h3>
          <div className="space-y-4">
            {sourceData.map((source) => (
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
                </div>
              </div>
            ))}
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
            {[
              { title: 'Senior Frontend Developer', applications: 105, hires: 3 },
              { title: 'Product Manager', applications: 89, hires: 2 },
              { title: 'UX Designer', applications: 67, hires: 1 },
              { title: 'Backend Developer', applications: 45, hires: 2 },
            ].map((job) => (
              <div key={job.title} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{job.title}</p>
                  <p className="text-sm text-gray-600">{job.applications} applications</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">{job.hires}</p>
                  <p className="text-xs text-gray-500">hires</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Performance</h3>
          <div className="space-y-3">
            {[
              { name: 'Sarah Johnson', processed: 45, hired: 8 },
              { name: 'Emma Wilson', processed: 38, hired: 6 },
              { name: 'Mike Chen', processed: 32, hired: 5 },
              { name: 'David Kim', processed: 28, hired: 4 },
            ].map((member) => (
              <div key={member.name} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{member.name}</p>
                  <p className="text-sm text-gray-600">{member.processed} processed</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600">{member.hired}</p>
                  <p className="text-xs text-gray-500">hires</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Insights</h3>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900">LinkedIn is your top source</p>
              <p className="text-xs text-blue-700 mt-1">35% of all applications come from LinkedIn</p>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-900">Hiring speed improved</p>
              <p className="text-xs text-green-700 mt-1">Average time to hire decreased by 5 days</p>
            </div>
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm font-medium text-orange-900">Interview conversion up</p>
              <p className="text-xs text-orange-700 mt-1">35% of interviews result in offers</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}