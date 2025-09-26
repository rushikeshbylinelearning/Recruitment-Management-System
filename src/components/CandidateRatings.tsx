import React, { useState, useEffect } from 'react';
import { candidateRatingsAPI } from '../services/api';
import { CandidateRating, CreateCandidateRating, AggregatedScore } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit, Trash2, Star, TrendingUp, Search } from 'lucide-react';

interface CandidateRatingsProps {
  candidateId: number;
  candidateName: string;
}

const CandidateRatings: React.FC<CandidateRatingsProps> = ({ candidateId, candidateName }) => {
  const { user } = useAuth();
  const [ratings, setRatings] = useState<CandidateRating[]>([]);
  const [aggregatedScores, setAggregatedScores] = useState<AggregatedScore[]>([]);
  const [overallAverage, setOverallAverage] = useState<{ overall_average: number; total_ratings: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRating, setEditingRating] = useState<CandidateRating | null>(null);
  const [filters, setFilters] = useState({ ratingType: '', userRole: '' });
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState<CreateCandidateRating>({
    ratingType: 'Overall',
    score: 3,
    comments: ''
  });

  useEffect(() => {
    loadRatings();
    loadAggregatedScores();
  }, [candidateId, filters]);

  const loadRatings = async () => {
    try {
      setLoading(true);
      const response = await candidateRatingsAPI.getRatings(candidateId, filters);
      setRatings(response.data?.ratings || []);
    } catch (error) {
      console.error('Failed to load ratings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAggregatedScores = async () => {
    try {
      const response = await candidateRatingsAPI.getAggregatedScores(candidateId);
      setAggregatedScores(response.data?.aggregatedScores || []);
      setOverallAverage(response.data?.overallAverage || null);
    } catch (error) {
      console.error('Failed to load aggregated scores:', error);
    }
  };

  const handleAddRating = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await candidateRatingsAPI.addRating(candidateId, formData);
      setFormData({ ratingType: 'Overall', score: 3, comments: '' });
      setShowAddForm(false);
      loadRatings();
      loadAggregatedScores();
    } catch (error) {
      console.error('Failed to add rating:', error);
    }
  };

  const handleUpdateRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRating) return;

    try {
      await candidateRatingsAPI.updateRating(editingRating.id, {
        score: formData.score,
        comments: formData.comments
      });
      setEditingRating(null);
      setFormData({ ratingType: 'Overall', score: 3, comments: '' });
      loadRatings();
      loadAggregatedScores();
    } catch (error) {
      console.error('Failed to update rating:', error);
    }
  };

  const handleDeleteRating = async (ratingId: number) => {
    if (!window.confirm('Are you sure you want to delete this rating?')) return;

    try {
      await candidateRatingsAPI.deleteRating(ratingId);
      loadRatings();
      loadAggregatedScores();
    } catch (error) {
      console.error('Failed to delete rating:', error);
    }
  };

  const startEdit = (rating: CandidateRating) => {
    setEditingRating(rating);
    setFormData({
      ratingType: rating.rating_type,
      score: rating.score,
      comments: rating.comments || ''
    });
  };

  const cancelEdit = () => {
    setEditingRating(null);
    setFormData({ ratingType: 'Overall', score: 3, comments: '' });
  };

  const canEditRating = (rating: CandidateRating) => {
    return rating.user_id === user?.id || user?.role === 'Admin' || user?.role === 'HR Manager';
  };

  const filteredRatings = ratings.filter(rating => {
    const matchesSearch = rating.comments?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rating.user_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'bg-red-100 text-red-800';
      case 'HR Manager': return 'bg-purple-100 text-purple-800';
      case 'Interviewer': return 'bg-blue-100 text-blue-800';
      case 'Recruiter': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRatingTypeColor = (type: string) => {
    switch (type) {
      case 'Technical': return 'bg-blue-100 text-blue-800';
      case 'Communication': return 'bg-green-100 text-green-800';
      case 'Cultural Fit': return 'bg-yellow-100 text-yellow-800';
      case 'Overall': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 4.5) return 'text-green-600';
    if (score >= 3.5) return 'text-yellow-600';
    if (score >= 2.5) return 'text-orange-600';
    return 'text-red-600';
  };

  const renderStars = (score: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={16}
        className={`${i < Math.floor(score) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Ratings for {candidateName}</h3>
          <p className="text-sm text-gray-500">Multi-user ratings and feedback</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          <span>Add Rating</span>
        </button>
      </div>

      {/* Aggregated Scores */}
      {aggregatedScores.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="text-indigo-600" size={20} />
            <h4 className="text-lg font-semibold text-gray-900">Aggregated Scores</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {aggregatedScores.map((score) => (
              <div key={score.rating_type} className="bg-white rounded-lg p-4 border border-indigo-100">
                <div className="text-sm font-medium text-gray-600 mb-1">{score.rating_type}</div>
                <div className="flex items-center space-x-2">
                  <span className={`text-2xl font-bold ${getScoreColor(score.average_score)}`}>
                    {score.average_score.toFixed(1)}
                  </span>
                  <div className="flex">{renderStars(score.average_score)}</div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {score.total_ratings} rating{score.total_ratings !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
            {overallAverage && (
              <div className="bg-white rounded-lg p-4 border border-indigo-100">
                <div className="text-sm font-medium text-gray-600 mb-1">Overall Average</div>
                <div className="flex items-center space-x-2">
                  <span className={`text-2xl font-bold ${getScoreColor(overallAverage.overall_average)}`}>
                    {overallAverage.overall_average.toFixed(1)}
                  </span>
                  <div className="flex">{renderStars(overallAverage.overall_average)}</div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {overallAverage.total_ratings} total rating{overallAverage.total_ratings !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search ratings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={filters.ratingType}
            onChange={(e) => setFilters(prev => ({ ...prev, ratingType: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300"
          >
            <option value="">All Types</option>
            <option value="Technical">Technical</option>
            <option value="Communication">Communication</option>
            <option value="Cultural Fit">Cultural Fit</option>
            <option value="Overall">Overall</option>
          </select>
          <select
            value={filters.userRole}
            onChange={(e) => setFilters(prev => ({ ...prev, userRole: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300"
          >
            <option value="">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="HR Manager">HR Manager</option>
            <option value="Interviewer">Interviewer</option>
            <option value="Recruiter">Recruiter</option>
          </select>
        </div>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingRating) && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">
            {editingRating ? 'Edit Rating' : 'Add New Rating'}
          </h4>
          <form onSubmit={editingRating ? handleUpdateRating : handleAddRating} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rating Type</label>
                <select
                  value={formData.ratingType}
                  onChange={(e) => setFormData(prev => ({ ...prev, ratingType: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300"
                  required
                >
                  <option value="Overall">Overall</option>
                  <option value="Technical">Technical</option>
                  <option value="Communication">Communication</option>
                  <option value="Cultural Fit">Cultural Fit</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Score (1-5)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="0.1"
                    value={formData.score}
                    onChange={(e) => setFormData(prev => ({ ...prev, score: parseFloat(e.target.value) }))}
                    className="flex-1"
                  />
                  <span className={`text-lg font-semibold ${getScoreColor(formData.score)}`}>
                    {formData.score.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1.0</span>
                  <span>5.0</span>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comments (Optional)</label>
              <textarea
                value={formData.comments}
                onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300"
                placeholder="Add your comments about this rating..."
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={editingRating ? cancelEdit : () => setShowAddForm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {editingRating ? 'Update Rating' : 'Add Rating'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ratings List */}
      <div className="space-y-4">
        {filteredRatings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No ratings found for this candidate.</p>
          </div>
        ) : (
          filteredRatings.map((rating) => (
            <div key={rating.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRatingTypeColor(rating.rating_type)}`}>
                      {rating.rating_type}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(rating.user_role)}`}>
                      {rating.user_role}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    {new Date(rating.created_at).toLocaleDateString()}
                  </span>
                  {canEditRating(rating) && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => startEdit(rating)}
                        className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteRating(rating.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-4 mb-3">
                <div className="flex items-center space-x-2">
                  <span className={`text-2xl font-bold ${getScoreColor(rating.score)}`}>
                    {rating.score.toFixed(1)}
                  </span>
                  <div className="flex">{renderStars(rating.score)}</div>
                </div>
              </div>
              {rating.comments && (
                <div className="text-gray-700 mb-3">
                  <p className="whitespace-pre-wrap">{rating.comments}</p>
                </div>
              )}
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>By {rating.user_name || 'Unknown User'}</span>
                  {rating.updated_at !== rating.created_at && (
                    <span>Updated {new Date(rating.updated_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CandidateRatings;
