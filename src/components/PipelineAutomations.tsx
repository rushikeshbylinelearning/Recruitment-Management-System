import { useState, useEffect } from 'react';
import { Plus, Power, Edit, Trash2, Activity, ChevronRight } from 'lucide-react';
import { automationsAPI, PipelineAutomation } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function PipelineAutomations() {
  const { hasPermission } = useAuth();
  const [automations, setAutomations] = useState<PipelineAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAutomations();
  }, []);

  const loadAutomations = async () => {
    try {
      setLoading(true);
      const response = await automationsAPI.getAutomations();
      
      if (response.success && response.data) {
        setAutomations(response.data.automations || []);
      } else {
        setError('Failed to load automations');
      }
    } catch (err) {
      console.error('Error loading automations:', err);
      setError('Failed to load automations');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      const response = await automationsAPI.toggleAutomation(id);
      
      if (response.success) {
        setAutomations(prev => prev.map(auto => 
          auto.id === id ? { ...auto, is_active: response.data.is_active } : auto
        ));
      }
    } catch (err) {
      console.error('Error toggling automation:', err);
      setError('Failed to toggle automation');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this automation?')) {
      return;
    }

    try {
      const response = await automationsAPI.deleteAutomation(id);
      
      if (response.success) {
        setAutomations(prev => prev.filter(auto => auto.id !== id));
      }
    } catch (err) {
      console.error('Error deleting automation:', err);
      setError('Failed to delete automation');
    }
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      Applied: 'bg-blue-100 text-blue-800',
      Screening: 'bg-yellow-100 text-yellow-800',
      Interview: 'bg-orange-100 text-orange-800',
      Offer: 'bg-purple-100 text-purple-800',
      Hired: 'bg-green-100 text-green-800',
      Rejected: 'bg-red-100 text-red-800',
      'On Hold': 'bg-gray-100 text-gray-800',
    };
    return colors[stage] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading automations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-end items-center">
        <div>
        {hasPermission('settings', 'edit') && (
          <button
            className="flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-3 rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Plus size={18} />
            <span className="font-semibold">New Automation</span>
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-sm">
          {error}
        </div>
      )}

      {/* Automations List */}
      <div className="grid grid-cols-1 gap-6">
        {automations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <Activity size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-lg font-medium">No automations configured</p>
            <p className="text-gray-400 text-sm mt-1">Create your first automation to get started</p>
          </div>
        ) : (
          automations.map((automation) => (
            <div
              key={automation.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{automation.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStageColor(automation.trigger_stage)}`}>
                      {automation.trigger_stage}
                    </span>
                    <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                      {automation.trigger_event === 'on_enter' ? 'On Enter' : 'On Exit'}
                    </span>
                  </div>
                  
                  {automation.description && (
                    <p className="text-gray-600 text-sm mb-3">{automation.description}</p>
                  )}
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="flex items-center space-x-1">
                      <Activity size={14} />
                      <span>{automation.action_count || 0} actions</span>
                    </span>
                    {automation.created_by_name && (
                      <span>Created by {automation.created_by_name}</span>
                    )}
                    <span>Priority: {automation.priority}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 ml-4">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(automation.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      automation.is_active
                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                    title={automation.is_active ? 'Disable' : 'Enable'}
                  >
                    <Power size={18} />
                  </button>

                  {/* Edit */}
                  {hasPermission('settings', 'edit') && (
                    <button
                      className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                      title="Edit"
                    >
                      <Edit size={18} />
                    </button>
                  )}

                  {/* Delete */}
                  {hasPermission('settings', 'delete') && (
                    <button
                      onClick={() => handleDelete(automation.id)}
                      className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}

                  {/* View Details */}
                  <button
                    className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors"
                    title="View Details"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info Box */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
        <h4 className="text-indigo-900 font-semibold mb-2">How Automations Work</h4>
        <ul className="text-indigo-800 text-sm space-y-1">
          <li>• Automations trigger when candidates enter or exit a stage</li>
          <li>• Actions execute in sequence (email, task, interview, etc.)</li>
          <li>• All activity is logged in the candidate timeline</li>
          <li>• Automations run asynchronously without blocking the UI</li>
        </ul>
      </div>
    </div>
  );
}
