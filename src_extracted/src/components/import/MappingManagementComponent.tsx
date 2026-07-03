import React, { useState, useEffect } from 'react';
import { Trash2, Calendar, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { candidateImportAPI, SavedMapping } from '../../services/api';

export default function MappingManagementComponent() {
  const [mappings, setMappings] = useState<SavedMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await candidateImportAPI.getMappings();
      if (response.success && response.data) {
        setMappings(response.data.mappings);
      }
    } catch (err: any) {
      console.error('Failed to load mappings:', err);
      setError('Failed to load saved mappings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (mappingId: number) => {
    if (!confirm('Are you sure you want to delete this mapping? This action cannot be undone.')) {
      return;
    }

    setDeleting(mappingId);
    try {
      const response = await candidateImportAPI.deleteMapping(mappingId);
      if (response.success) {
        setMappings(prev => prev.filter(m => m.id !== mappingId));
      } else {
        throw new Error(response.message || 'Failed to delete mapping');
      }
    } catch (err: any) {
      console.error('Failed to delete mapping:', err);
      alert('Failed to delete mapping. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Saved Mappings</h2>
        <p className="text-sm text-gray-600 mt-1">
          Manage your saved field mappings for faster imports
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      )}

      {/* Empty State */}
      {!loading && mappings.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ArrowRight className="text-gray-400" size={32} />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No saved mappings</h3>
          <p className="text-gray-600">
            Save field mappings during import to reuse them for future uploads
          </p>
        </div>
      )}

      {/* Mappings List */}
      {!loading && mappings.length > 0 && (
        <div className="space-y-4">
          {mappings.map((mapping) => (
            <div
              key={mapping.id}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{mapping.name}</h3>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Calendar size={14} />
                      <span>Created: {formatDate(mapping.createdAt)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar size={14} />
                      <span>Last used: {formatDate(mapping.lastUsed)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(mapping.id)}
                  disabled={deleting === mapping.id}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete mapping"
                >
                  {deleting === mapping.id ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Trash2 size={18} />
                  )}
                </button>
              </div>

              {/* Mapping Details */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Field Mappings ({mapping.mappings.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {mapping.mappings.map((fieldMapping, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="text-sm text-gray-600 flex-1 truncate">
                        {fieldMapping.sourceColumn}
                      </span>
                      <ArrowRight size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900 flex-1 truncate">
                        {fieldMapping.targetField}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
