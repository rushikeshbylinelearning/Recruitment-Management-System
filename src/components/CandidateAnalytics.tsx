import React, { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, Users, Calendar, Filter, Download, RefreshCw, X, Search } from 'lucide-react';
import { Candidate } from '../types';

interface CandidateAnalyticsProps {
  candidates: Candidate[];
  isOpen: boolean;
  onClose: () => void;
}

interface AnalyticsFilters {
  dateRange: {
    from: string;
    to: string;
  };
  stages: string[];
  sources: string[];
  positions: string[];
  departments: string[];
  scoreRange: {
    min: number;
    max: number;
  };
  experienceRange: {
    min: number;
    max: number;
  };
  salaryRange: {
    min: number;
    max: number;
  };
}

export default function CandidateAnalytics({ candidates, isOpen, onClose }: CandidateAnalyticsProps) {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    dateRange: {
      from: '',
      to: ''
    },
    stages: [],
    sources: [],
    positions: [],
    departments: [],
    scoreRange: { min: 0, max: 5 },
    experienceRange: { min: 0, max: 20 },
    salaryRange: { min: 0, max: 1000000 }
  });

  const [activeChart, setActiveChart] = useState<'stages' | 'sources' | 'timeline' | 'scores'>('stages');

  // Extract unique values for filters
  const uniqueSources = [...new Set(candidates.map(c => c.source))];
  const uniquePositions = [...new Set(candidates.map(c => c.position))];
  const uniqueDepartments = [...new Set(candidates.map(c => c.position.split(' ')[0]))]; // Simple department extraction
  const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

  // Apply filters to candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter(candidate => {
      // Date range filter
      if (filters.dateRange.from && new Date(candidate.appliedDate) < new Date(filters.dateRange.from)) return false;
      if (filters.dateRange.to && new Date(candidate.appliedDate) > new Date(filters.dateRange.to)) return false;
      
      // Stage filter
      if (filters.stages.length > 0 && !filters.stages.includes(candidate.stage)) return false;
      
      // Source filter
      if (filters.sources.length > 0 && !filters.sources.includes(candidate.source)) return false;
      
      // Position filter
      if (filters.positions.length > 0 && !filters.positions.includes(candidate.position)) return false;
      
      // Score range filter
      if (candidate.score < filters.scoreRange.min || candidate.score > filters.scoreRange.max) return false;
      
      // Experience filter (simplified)
      const expYears = parseInt(candidate.experience) || 0;
      if (expYears < filters.experienceRange.min || expYears > filters.experienceRange.max) return false;
      
      // Salary filter (if available)
      if (candidate.salary?.expected) {
        const salary = parseInt(candidate.salary.expected.replace(/[^\d]/g, '')) || 0;
        if (salary < filters.salaryRange.min || salary > filters.salaryRange.max) return false;
      }
      
      return true;
    });
  }, [candidates, filters]);

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    const stageDistribution = stages.map(stage => ({
      stage,
      count: filteredCandidates.filter(c => c.stage === stage).length,
      percentage: Math.round((filteredCandidates.filter(c => c.stage === stage).length / filteredCandidates.length) * 100) || 0
    }));

    const sourceDistribution = uniqueSources.map(source => ({
      source,
      count: filteredCandidates.filter(c => c.source === source).length,
      percentage: Math.round((filteredCandidates.filter(c => c.source === source).length / filteredCandidates.length) * 100) || 0
    })).sort((a, b) => b.count - a.count);

    const positionDistribution = uniquePositions.map(position => ({
      position,
      count: filteredCandidates.filter(c => c.position === position).length,
      percentage: Math.round((filteredCandidates.filter(c => c.position === position).length / filteredCandidates.length) * 100) || 0
    })).sort((a, b) => b.count - a.count);

    // Timeline data (monthly)
    const timelineData = [];
    const monthsBack = 12;
    for (let i = monthsBack - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().slice(0, 7); // YYYY-MM format
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      const monthCandidates = filteredCandidates.filter(c => 
        c.appliedDate.slice(0, 7) === monthKey
      );
      
      timelineData.push({
        month: monthName,
        applications: monthCandidates.length,
        hired: monthCandidates.filter(c => c.stage === 'Hired').length,
        rejected: monthCandidates.filter(c => c.stage === 'Rejected').length
      });
    }

    // Score distribution
    const scoreDistribution = [1, 2, 3, 4, 5].map(score => ({
      score,
      count: filteredCandidates.filter(c => Math.floor(c.score) === score).length
    }));

    // Conversion rates
    const conversionRates = {
      applicationToScreening: Math.round((stageDistribution.find(s => s.stage === 'Screening')?.count || 0) / filteredCandidates.length * 100) || 0,
      screeningToInterview: Math.round((stageDistribution.find(s => s.stage === 'Interview')?.count || 0) / (stageDistribution.find(s => s.stage === 'Screening')?.count || 1) * 100) || 0,
      interviewToOffer: Math.round((stageDistribution.find(s => s.stage === 'Offer')?.count || 0) / (stageDistribution.find(s => s.stage === 'Interview')?.count || 1) * 100) || 0,
      offerToHired: Math.round((stageDistribution.find(s => s.stage === 'Hired')?.count || 0) / (stageDistribution.find(s => s.stage === 'Offer')?.count || 1) * 100) || 0
    };

    return {
      stageDistribution,
      sourceDistribution,
      positionDistribution,
      timelineData,
      scoreDistribution,
      conversionRates,
      totalCandidates: filteredCandidates.length,
      averageScore: Math.round((filteredCandidates.reduce((sum, c) => sum + c.score, 0) / filteredCandidates.length) * 10) / 10 || 0
    };
  }, [filteredCandidates, uniqueSources, uniquePositions, stages]);

  if (!isOpen) return null;

  const handleFilterChange = (filterType: keyof AnalyticsFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleMultiSelectFilter = (filterType: 'stages' | 'sources' | 'positions' | 'departments', value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: prev[filterType].includes(value)
        ? prev[filterType].filter(item => item !== value)
        : [...prev[filterType], value]
    }));
  };

  const clearFilters = () => {
    setFilters({
      dateRange: { from: '', to: '' },
      stages: [],
      sources: [],
      positions: [],
      departments: [],
      scoreRange: { min: 0, max: 5 },
      experienceRange: { min: 0, max: 20 },
      salaryRange: { min: 0, max: 1000000 }
    });
  };

  const exportData = () => {
    const csvData = [
      ['Name', 'Position', 'Stage', 'Source', 'Applied Date', 'Score', 'Experience', 'Expected Salary'],
      ...filteredCandidates.map(c => [
        c.name,
        c.position,
        c.stage,
        c.source,
        new Date(c.appliedDate).toLocaleDateString(),
        c.score,
        c.experience,
        c.salary?.expected || 'N/A'
      ])
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `candidate-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Applied': return 'bg-blue-500';
      case 'Screening': return 'bg-yellow-500';
      case 'Interview': return 'bg-orange-500';
      case 'Offer': return 'bg-purple-500';
      case 'Hired': return 'bg-green-500';
      case 'Rejected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <BarChart3 className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">Candidate Analytics</h2>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={exportData}
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download size={16} />
              <span>Export CSV</span>
            </button>
            <button
              onClick={clearFilters}
              className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RefreshCw size={16} />
              <span>Clear Filters</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex h-[calc(95vh-80px)]">
          {/* Filters Sidebar */}
          <div className="w-80 border-r border-gray-200 p-6 overflow-y-auto">
            <div className="flex items-center space-x-2 mb-6">
              <Filter className="text-gray-600" size={20} />
              <h3 className="font-semibold text-gray-900">Filters</h3>
            </div>

            {/* Date Range */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={filters.dateRange.from}
                  onChange={(e) => handleFilterChange('dateRange', { ...filters.dateRange, from: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="From"
                />
                <input
                  type="date"
                  value={filters.dateRange.to}
                  onChange={(e) => handleFilterChange('dateRange', { ...filters.dateRange, to: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="To"
                />
              </div>
            </div>

            {/* Stages */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Stages</label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {stages.map(stage => (
                  <label key={stage} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.stages.includes(stage)}
                      onChange={() => handleMultiSelectFilter('stages', stage)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{stage}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Sources */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Sources</label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {uniqueSources.map(source => (
                  <label key={source} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.sources.includes(source)}
                      onChange={() => handleMultiSelectFilter('sources', source)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{source}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Positions */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Positions</label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {uniquePositions.map(position => (
                  <label key={position} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.positions.includes(position)}
                      onChange={() => handleMultiSelectFilter('positions', position)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 truncate">{position}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Score Range */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Score Range</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={filters.scoreRange.min}
                  onChange={(e) => handleFilterChange('scoreRange', { ...filters.scoreRange, min: parseFloat(e.target.value) })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Min"
                />
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={filters.scoreRange.max}
                  onChange={(e) => handleFilterChange('scoreRange', { ...filters.scoreRange, max: parseFloat(e.target.value) })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Max"
                />
              </div>
            </div>

            {/* Experience Range */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Experience (Years)</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  value={filters.experienceRange.min}
                  onChange={(e) => handleFilterChange('experienceRange', { ...filters.experienceRange, min: parseInt(e.target.value) })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Min"
                />
                <input
                  type="number"
                  min="0"
                  value={filters.experienceRange.max}
                  onChange={(e) => handleFilterChange('experienceRange', { ...filters.experienceRange, max: parseInt(e.target.value) })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Max"
                />
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600">Total Candidates</p>
                    <p className="text-2xl font-bold text-blue-900">{analyticsData.totalCandidates}</p>
                  </div>
                  <Users className="text-blue-600" size={24} />
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600">Hired</p>
                    <p className="text-2xl font-bold text-green-900">
                      {analyticsData.stageDistribution.find(s => s.stage === 'Hired')?.count || 0}
                    </p>
                  </div>
                  <TrendingUp className="text-green-600" size={24} />
                </div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600">Average Score</p>
                    <p className="text-2xl font-bold text-purple-900">{analyticsData.averageScore}/5</p>
                  </div>
                  <BarChart3 className="text-purple-600" size={24} />
                </div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-600">Conversion Rate</p>
                    <p className="text-2xl font-bold text-orange-900">{analyticsData.conversionRates.offerToHired}%</p>
                  </div>
                  <Calendar className="text-orange-600" size={24} />
                </div>
              </div>
            </div>

            {/* Filtered Candidates List */}
            <div className="mt-6 bg-white rounded-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Filtered Candidates ({filteredCandidates.length})
                  </h3>
                  <div className="flex items-center space-x-2">
                    <Search className="text-gray-400" size={16} />
                    <span className="text-sm text-gray-600">
                      Showing results based on current filters
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {filteredCandidates.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {filteredCandidates.map((candidate) => (
                      <div key={candidate.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                              <span className="text-white font-medium text-sm">
                                {candidate.name.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{candidate.name}</h4>
                              <p className="text-sm text-gray-600">{candidate.position}</p>
                              <div className="flex items-center space-x-3 mt-1">
                                <span className="text-xs text-gray-500">{candidate.source}</span>
                                <span className="text-xs text-gray-500">
                                  Applied: {new Date(candidate.appliedDate).toLocaleDateString()}
                                </span>
                                <span className="text-xs text-gray-500">
                                  Experience: {candidate.experience}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <div className="flex items-center space-x-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <div
                                    key={star}
                                    className={`w-3 h-3 rounded-full ${
                                      star <= candidate.score ? 'bg-yellow-400' : 'bg-gray-200'
                                    }`}
                                  />
                                ))}
                                <span className="text-sm text-gray-600 ml-2">{candidate.score}/5</span>
                              </div>
                              {candidate.salary?.expected && (
                                <p className="text-xs text-green-600 mt-1">₹{candidate.salary.expected}</p>
                              )}
                            </div>
                            
                            <div className="text-right">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                candidate.stage === 'Applied' ? 'bg-blue-100 text-blue-800' :
                                candidate.stage === 'Screening' ? 'bg-yellow-100 text-yellow-800' :
                                candidate.stage === 'Interview' ? 'bg-orange-100 text-orange-800' :
                                candidate.stage === 'Offer' ? 'bg-purple-100 text-purple-800' :
                                candidate.stage === 'Hired' ? 'bg-green-100 text-green-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {candidate.stage}
                              </span>
                              {candidate.interviews && candidate.interviews.length > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {candidate.interviews.length} interview(s)
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Skills */}
                        {candidate.skills && candidate.skills.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {candidate.skills.slice(0, 4).map((skill, index) => (
                              <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                {skill}
                              </span>
                            ))}
                            {candidate.skills.length > 4 && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">
                                +{candidate.skills.length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Users size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No candidates found</h3>
                    <p className="text-gray-600">Try adjusting your filters to see more candidates.</p>
                  </div>
                )}
              </div>
            </div>
            {/* Chart Navigation */}
            <div className="flex space-x-2 mb-6">
              {[
                { id: 'stages', label: 'Stage Distribution' },
                { id: 'sources', label: 'Source Analysis' },
                { id: 'timeline', label: 'Timeline View' },
                { id: 'scores', label: 'Score Distribution' }
              ].map(chart => (
                <button
                  key={chart.id}
                  onClick={() => setActiveChart(chart.id as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeChart === chart.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {chart.label}
                </button>
              ))}
            </div>

            {/* Charts */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              {activeChart === 'stages' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Stage Distribution</h3>
                  <div className="space-y-4">
                    {analyticsData.stageDistribution.map(item => (
                      <div key={item.stage} className="flex items-center">
                        <div className="w-24 text-sm text-gray-600">{item.stage}</div>
                        <div className="flex-1 mx-4">
                          <div className="bg-gray-200 h-8 rounded-full relative">
                            <div
                              className={`${getStageColor(item.stage)} h-full rounded-full flex items-center justify-end pr-3`}
                              style={{ width: `${Math.max(item.percentage, 5)}%` }}
                            >
                              <span className="text-white text-sm font-medium">{item.count}</span>
                            </div>
                          </div>
                        </div>
                        <div className="w-12 text-sm text-gray-600 text-right">{item.percentage}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeChart === 'sources' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Source Analysis</h3>
                  <div className="space-y-4">
                    {analyticsData.sourceDistribution.slice(0, 8).map((item, index) => (
                      <div key={item.source} className="flex items-center">
                        <div className="w-32 text-sm text-gray-600 truncate">{item.source}</div>
                        <div className="flex-1 mx-4">
                          <div className="bg-gray-200 h-6 rounded-full relative">
                            <div
                              className="bg-blue-500 h-full rounded-full flex items-center justify-end pr-2"
                              style={{ width: `${Math.max(item.percentage, 5)}%` }}
                            >
                              <span className="text-white text-xs font-medium">{item.count}</span>
                            </div>
                          </div>
                        </div>
                        <div className="w-12 text-sm text-gray-600 text-right">{item.percentage}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeChart === 'timeline' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Application Timeline</h3>
                  <div className="space-y-4">
                    {analyticsData.timelineData.map(item => (
                      <div key={item.month} className="flex items-center">
                        <div className="w-20 text-sm text-gray-600">{item.month}</div>
                        <div className="flex-1 mx-4">
                          <div className="flex space-x-1">
                            <div className="bg-blue-200 h-6 rounded flex-1 relative">
                              <div
                                className="bg-blue-500 h-full rounded flex items-center justify-center"
                                style={{ width: `${Math.max((item.applications / Math.max(...analyticsData.timelineData.map(t => t.applications))) * 100, 10)}%` }}
                              >
                                <span className="text-white text-xs font-medium">{item.applications}</span>
                              </div>
                            </div>
                            <div className="bg-green-200 h-6 rounded flex-1 relative">
                              <div
                                className="bg-green-500 h-full rounded flex items-center justify-center"
                                style={{ width: `${Math.max((item.hired / Math.max(...analyticsData.timelineData.map(t => t.hired))) * 100, 10)}%` }}
                              >
                                <span className="text-white text-xs font-medium">{item.hired}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-24 text-xs text-gray-500">
                          <div>Apps: {item.applications}</div>
                          <div>Hired: {item.hired}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-blue-500 rounded"></div>
                      <span>Applications</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span>Hired</span>
                    </div>
                  </div>
                </div>
              )}

              {activeChart === 'scores' && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Score Distribution</h3>
                  <div className="space-y-4">
                    {analyticsData.scoreDistribution.map(item => (
                      <div key={item.score} className="flex items-center">
                        <div className="w-16 text-sm text-gray-600">{item.score} Star</div>
                        <div className="flex-1 mx-4">
                          <div className="bg-gray-200 h-6 rounded-full relative">
                            <div
                              className="bg-yellow-500 h-full rounded-full flex items-center justify-end pr-2"
                              style={{ width: `${Math.max((item.count / Math.max(...analyticsData.scoreDistribution.map(s => s.count))) * 100, 5)}%` }}
                            >
                              <span className="text-white text-xs font-medium">{item.count}</span>
                            </div>
                          </div>
                        </div>
                        <div className="w-12 text-sm text-gray-600 text-right">{item.count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Conversion Funnel */}
            <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="bg-blue-100 p-4 rounded-lg">
                    <p className="text-2xl font-bold text-blue-900">{analyticsData.conversionRates.applicationToScreening}%</p>
                    <p className="text-sm text-blue-600">Application → Screening</p>
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-yellow-100 p-4 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-900">{analyticsData.conversionRates.screeningToInterview}%</p>
                    <p className="text-sm text-yellow-600">Screening → Interview</p>
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-purple-100 p-4 rounded-lg">
                    <p className="text-2xl font-bold text-purple-900">{analyticsData.conversionRates.interviewToOffer}%</p>
                    <p className="text-sm text-purple-600">Interview → Offer</p>
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-green-100 p-4 rounded-lg">
                    <p className="text-2xl font-bold text-green-900">{analyticsData.conversionRates.offerToHired}%</p>
                    <p className="text-sm text-green-600">Offer → Hired</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}