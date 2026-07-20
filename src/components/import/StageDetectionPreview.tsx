import React from 'react';
import {
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Target,
  ChevronRight,
  Info,
} from 'lucide-react';
import { StageMappingResult, getStageStatistics, validateStageMapping } from '../../services/stageMappingService';
import { DEFAULT_STAGE_CONFIG } from '../../types/umbrellaStage';

interface StageDetectionPreviewProps {
  stageMappings: StageMappingResult[];
  onReviewMapping?: (index: number) => void;
}

export default function StageDetectionPreview({
  stageMappings,
  onReviewMapping,
}: StageDetectionPreviewProps) {
  const stats = getStageStatistics(stageMappings);

  // Get stage config for colors
  const getStageColor = (mainStageId: string): string => {
    const stage = DEFAULT_STAGE_CONFIG.mainStages.find(s => s.id === mainStageId);
    return stage?.accentColor || '#dc2626';
  };

  // Get confidence badge
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle size={12} className="mr-1" />
          {Math.round(confidence * 100)}%
        </span>
      );
    } else if (confidence >= 0.7) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <AlertTriangle size={12} className="mr-1" />
          {Math.round(confidence * 100)}%
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertCircle size={12} className="mr-1" />
          {Math.round(confidence * 100)}%
        </span>
      );
    }
  };

  // Get method badge
  const getMethodBadge = (method: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      exact: { color: 'bg-blue-100 text-blue-800', label: 'Exact' },
      fuzzy: { color: 'bg-purple-100 text-purple-800', label: 'Fuzzy' },
      alias: { color: 'bg-indigo-100 text-indigo-800', label: 'Alias' },
      color: { color: 'bg-orange-100 text-orange-800', label: 'Color' },
      'color-exact': { color: 'bg-orange-100 text-orange-800', label: 'Color' },
      'color-tolerance': { color: 'bg-orange-100 text-orange-800', label: 'Color' },
      'remarks-keyword': { color: 'bg-amber-100 text-amber-800', label: 'Remarks' },
      row: { color: 'bg-orange-100 text-orange-800', label: 'Row Color' },
      name: { color: 'bg-orange-100 text-orange-800', label: 'Name Cell' },
      text: { color: 'bg-blue-100 text-blue-800', label: 'Text' },
      remarks: { color: 'bg-amber-100 text-amber-800', label: 'Remarks' },
      fallback: { color: 'bg-gray-100 text-gray-800', label: 'Fallback' },
    };

    const badge = badges[method] || badges.fallback;

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
          <Target size={20} className="text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Workflow Stage Detection</h3>
          <p className="text-sm text-gray-600">
            Intelligent mapping to hierarchical Kanban workflow
          </p>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-blue-900">Total Candidates</p>
            <TrendingUp size={16} className="text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-900">{stats.totalCandidates}</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-green-900">High Confidence</p>
            <CheckCircle size={16} className="text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-900">{stats.byConfidence.high}</p>
          <p className="text-xs text-green-700 mt-1">≥90% match</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-yellow-900">Medium Confidence</p>
            <AlertTriangle size={16} className="text-yellow-600" />
          </div>
          <p className="text-3xl font-bold text-yellow-900">{stats.byConfidence.medium}</p>
          <p className="text-xs text-yellow-700 mt-1">70-89% match</p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-red-900">Needs Review</p>
            <AlertCircle size={16} className="text-red-600" />
          </div>
          <p className="text-3xl font-bold text-red-900">{stats.byConfidence.low}</p>
          <p className="text-xs text-red-700 mt-1">&lt;70% match</p>
        </div>
      </div>

      {/* Stage Distribution */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Stage Distribution</h4>
        <div className="space-y-3">
          {Object.entries(stats.byMainStage)
            .sort((a, b) => b[1] - a[1])
            .map(([mainStage, count]) => {
              const stageColor = getStageColor(mainStage);
              const stageConfig = DEFAULT_STAGE_CONFIG.mainStages.find(s => s.id === mainStage);
              const percentage = Math.round((count / stats.totalCandidates) * 100);

              // Get sub-stage breakdown
              const subStages = Object.entries(stats.bySubStage)
                .filter(([key]) => key.startsWith(`${mainStage}/`))
                .map(([key, subCount]) => ({
                  subStageId: key.split('/')[1],
                  count: subCount,
                }));

              return (
                <div key={mainStage} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stageColor }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {stageConfig?.name || mainStage}
                        </span>
                        <span className="text-sm text-gray-600">
                          {count} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full transition-all duration-300"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: stageColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sub-stages */}
                  {subStages.length > 0 && (
                    <div className="ml-6 pl-4 border-l-2 border-gray-200 space-y-1.5">
                      {subStages.map(({ subStageId, count: subCount }) => {
                        const subStageConfig = stageConfig?.subStages?.find(s => s.id === subStageId);
                        const subPercentage = Math.round((subCount / count) * 100);

                        return (
                          <div key={subStageId} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <ChevronRight size={12} className="text-gray-400" />
                              <span className="text-gray-700">{subStageConfig?.name || subStageId}</span>
                            </div>
                            <span className="text-gray-600">
                              {subCount} ({subPercentage}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Detection Method Breakdown */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">Detection Methods Used</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(stats.byMethod).map(([method, count]) => {
            const percentage = Math.round((count / stats.totalCandidates) * 100);
            return (
              <div key={method} className="text-center">
                <div className="mb-2">{getMethodBadge(method)}</div>
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-600">{percentage}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Warnings */}
      {stats.unmapped > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">
              {stats.unmapped} candidates could not be mapped to a specific stage
            </p>
            <p className="text-xs text-amber-700 mt-1">
              These will be placed in "Applied" stage by default. You can review and correct them after import.
            </p>
          </div>
        </div>
      )}

      {/* Low confidence warnings */}
      {stats.byConfidence.low > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">
              {stats.byConfidence.low} candidates have low confidence mappings
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Review these mappings in the preview table below to ensure accuracy.
            </p>
          </div>
        </div>
      )}

      {/* Sample Mappings Preview */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-900">Sample Stage Mappings</h4>
          <p className="text-xs text-gray-600 mt-1">First 10 detected stages</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Original Value
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Main Stage
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Sub Stage
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Confidence
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Method
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stageMappings.slice(0, 10).map((mapping, index) => {
                const validation = validateStageMapping(mapping);
                const stageConfig = DEFAULT_STAGE_CONFIG.mainStages.find(s => s.id === mapping.mainStage);
                const subStageConfig = stageConfig?.subStages?.find(s => s.id === mapping.subStage);

                return (
                  <tr
                    key={index}
                    className={`hover:bg-gray-50 ${!validation.isValid ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {mapping.originalValue}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: stageConfig?.accentColor }}
                        />
                        <span className="font-medium text-gray-900">
                          {stageConfig?.name || mapping.mainStage}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {subStageConfig ? (
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {subStageConfig.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{getConfidenceBadge(mapping.confidence)}</td>
                    <td className="px-4 py-3">{getMethodBadge(mapping.matchMethod)}</td>
                    <td className="px-4 py-3">
                      {validation.isValid ? (
                        <CheckCircle size={16} className="text-green-600" />
                      ) : (
                        <AlertCircle size={16} className="text-red-600" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
