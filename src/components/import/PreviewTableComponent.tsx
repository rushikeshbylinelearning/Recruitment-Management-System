import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  X,
  Save,
  Download,
  ChevronDown,
  ChevronUp,
  Info,
  Target,
  Briefcase,
} from 'lucide-react';
import { candidateImportAPI, FieldMapping, PreviewRow } from '../../services/api';

interface PreviewTableComponentProps {
  uploadData: any;
  onConfirm: (summary: any) => void;
  onCancel: () => void;
  jobId?: number | null;
}

const SYSTEM_FIELDS = [
  { value: 'name', label: 'Name', required: true },
  { value: 'email', label: 'Email', required: false },
  { value: 'phone', label: 'Phone', required: false },
  { value: 'position', label: 'Position', required: false },
  { value: 'experience', label: 'Experience', required: false },
  { value: 'location', label: 'Location', required: false },
  { value: 'source', label: 'Source', required: false },
  { value: 'skills', label: 'Skills', required: false },
  { value: 'salary_expected', label: 'Expected Salary', required: false },
  { value: 'salary_offered', label: 'Offered Salary', required: false },
  { value: 'salary_negotiable', label: 'Salary Negotiable', required: false },
  { value: 'joining_time', label: 'Joining Time', required: false },
  { value: 'notice_period', label: 'Notice Period', required: false },
  { value: 'immediate_joiner', label: 'Immediate Joiner', required: false },
  { value: 'work_preference', label: 'Work Preference', required: false },
  { value: 'current_ctc', label: 'Current CTC', required: false },
  { value: 'ctc_frequency', label: 'CTC Frequency', required: false },
  { value: 'notes', label: 'Notes', required: false },
  { value: 'resume', label: 'Resume', required: false },
  { value: 'stage', label: 'Stage', required: false },
  { value: 'applied_date', label: 'Applied Date', required: false },
  { value: 'hr_comment', label: 'HR Comment', required: false },
];

export default function PreviewTableComponent({
  uploadData,
  onConfirm,
  onCancel,
  jobId = null,
}: PreviewTableComponentProps) {
  const [mappings, setMappings] = useState<FieldMapping[]>(uploadData.mappings || []);
  const [duplicateHandling, setDuplicateHandling] = useState<'skip' | 'allow_all' | 'merge'>('allow_all');
  const [saveMappings, setSaveMappings] = useState(false);
  const [mappingName, setMappingName] = useState('');
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    preview: true,
    mappings: false,
    duplicates: false,
    quality: true,
    jobSegregation: true,
  });

  // Job segregation preview state
  const [jobSegPreview, setJobSegPreview] = useState<{
    totalCandidates: number;
    mappedCount: number;
    unmappedCount: number;
    byJob: Array<{ jobId: number; jobTitle: string; count: number; matchMethod: string }>;
    unmappedCandidates?: Array<{ rowNumber: number; name: string; position: string; reason: string }>;
  } | null>(null);
  const [loadingSegPreview, setLoadingSegPreview] = useState(false);
  const [showUnassignedList, setShowUnassignedList] = useState(false);

  const preview = uploadData.preview;
  const duplicates = uploadData.duplicates;
  const fileInfo = uploadData.fileInfo;

  // Load job segregation preview — re-runs whenever mappings change so manual
  // field mapping choices (e.g. "Expertise → position") are reflected instantly.
  // Debounced 600ms so rapid dropdown changes don't fire multiple requests.
  const segPreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!uploadData.uploadId || jobId) return; // skip if job is already specified

    if (segPreviewTimer.current) clearTimeout(segPreviewTimer.current);

    segPreviewTimer.current = setTimeout(() => {
      setLoadingSegPreview(true);
      candidateImportAPI.getJobSegregationPreview(uploadData.uploadId, mappings)
        .then(res => {
          if (res.success && res.data) {
            setJobSegPreview(res.data);
          }
        })
        .catch(() => { /* non-critical, silently ignore */ })
        .finally(() => setLoadingSegPreview(false));
    }, 600);

    return () => {
      if (segPreviewTimer.current) clearTimeout(segPreviewTimer.current);
    };
  }, [uploadData.uploadId, jobId, mappings]);

  const handleMappingChange = (sourceColumn: string, targetField: string) => {
    setMappings(prev => {
      const existing = prev.find(m => m.sourceColumn === sourceColumn);
      if (existing) {
        return prev.map(m =>
          m.sourceColumn === sourceColumn
            ? { ...m, targetField, method: 'manual' as const, confidence: 1.0 }
            : m
        );
      } else {
        return [
          ...prev,
          {
            sourceColumn,
            targetField,
            confidence: 1.0,
            method: 'manual' as const,
          },
        ];
      }
    });
  };

  const toggleRowExclusion = (rowNumber: number) => {
    setExcludedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowNumber)) {
        newSet.delete(rowNumber);
      } else {
        newSet.add(rowNumber);
      }
      return newSet;
    });
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleConfirm = async () => {
    setProcessing(true);
    setError(null);

    try {
      const response = await candidateImportAPI.confirmImport({
        uploadId: uploadData.uploadId,
        mappings,
        options: {
          saveMappings,
          mappingName: saveMappings ? mappingName : undefined,
          duplicateHandling,
          removeRows: Array.from(excludedRows),
          jobId: jobId ?? undefined,
        },
      });

      if (response.success && response.data) {
        onConfirm(response.data);
      } else {
        throw new Error(response.message || 'Import failed');
      }
    } catch (err: any) {
      console.error('Import error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to import candidates');
      setProcessing(false);
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-50';
    if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getQualityColor = (quality: string): string => {
    if (quality === 'high') return 'text-green-600 bg-green-50';
    if (quality === 'medium') return 'text-yellow-600 bg-yellow-50';
    return 'text-orange-600 bg-orange-50';
  };

  /** Hide raw stage column — import uses smart detection shown in Kanban Column */
  const displayMappings = mappings.filter(m => m.targetField !== 'stage');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Import Preview</h2>
            <p className="text-sm text-gray-600 mt-1">
              {fileInfo.filename} • {fileInfo.totalRows} rows • {fileInfo.fileType.toUpperCase()}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onCancel}
              disabled={processing}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={processing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center space-x-2"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  <span>Confirm Import</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-medium text-red-900">Import Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Quality Statistics */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('quality')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <h3 className="font-medium text-gray-900">Data Quality Overview</h3>
          {expandedSections.quality ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        
        {expandedSections.quality && (
          <div className="p-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium mb-1">High Quality</p>
                <p className="text-2xl font-bold text-green-900">
                  {preview.statistics.estimatedQuality.high}
                </p>
                <p className="text-xs text-green-600 mt-1">All fields present</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-600 font-medium mb-1">Medium Quality</p>
                <p className="text-2xl font-bold text-yellow-900">
                  {preview.statistics.estimatedQuality.medium}
                </p>
                <p className="text-xs text-yellow-600 mt-1">50-99% fields present</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-600 font-medium mb-1">Low Quality</p>
                <p className="text-2xl font-bold text-orange-900">
                  {preview.statistics.estimatedQuality.low}
                </p>
                <p className="text-xs text-orange-600 mt-1">Only required fields</p>
              </div>
            </div>

            {preview.statistics.rowsWithMissingRequired > 0 && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-sm font-medium text-red-900">
                    {preview.statistics.rowsWithMissingRequired} rows missing required fields
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    These rows will fail import unless corrected
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Job Segregation Preview */}
      {!jobId && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('jobSegregation')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Target size={16} className="text-purple-600" />
              <h3 className="font-medium text-gray-900">Auto Job Segregation Preview</h3>
              {jobSegPreview && !loadingSegPreview && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                  {jobSegPreview.mappedCount}/{jobSegPreview.totalCandidates} will be mapped
                </span>
              )}
              {loadingSegPreview && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  Recalculating...
                </span>
              )}
            </div>
            {expandedSections.jobSegregation ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {expandedSections.jobSegregation && (
            <div className="p-6 border-t border-gray-200">
              {loadingSegPreview ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500" />
                  Analyzing roles for job matching...
                </div>
              ) : jobSegPreview ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Based on candidate roles and skills, here's how they'll be distributed across jobs:
                  </p>
                  {jobSegPreview.byJob.map(entry => (
                    <div key={entry.jobId} className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Briefcase size={13} className="text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 truncate">{entry.jobTitle}</span>
                          <span className="text-sm text-gray-600 ml-2 flex-shrink-0">{entry.count} candidates</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {jobSegPreview.unmappedCount > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowUnassignedList(v => !v)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-amber-50 transition-colors text-left"
                      >
                        <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <AlertTriangle size={13} className="text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-amber-800">Unassigned Pool</span>
                            <span className="text-sm text-amber-700 ml-2 flex-shrink-0">
                              {jobSegPreview.unmappedCount} candidates
                            </span>
                          </div>
                          <p className="text-xs text-amber-700/80 mt-0.5">
                            No matching job card — click to preview who and why
                          </p>
                        </div>
                        {showUnassignedList ? <ChevronUp size={18} className="text-amber-600" /> : <ChevronDown size={18} className="text-amber-600" />}
                      </button>
                      {showUnassignedList && jobSegPreview.unmappedCandidates && jobSegPreview.unmappedCandidates.length > 0 && (
                        <div className="border-t border-amber-200 max-h-64 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-amber-100/60 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-amber-900">Row</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-amber-900">Name</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-amber-900">Position</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-amber-900">Reason</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-100">
                              {jobSegPreview.unmappedCandidates.map((c, i) => (
                                <tr key={i} className="bg-white/80">
                                  <td className="px-3 py-2 text-gray-600">{c.rowNumber}</td>
                                  <td className="px-3 py-2 font-medium text-gray-900">{c.name}</td>
                                  <td className="px-3 py-2 text-gray-700">{c.position}</td>
                                  <td className="px-3 py-2 text-amber-800 text-xs">{c.reason}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {jobSegPreview.unmappedCount > (jobSegPreview.unmappedCandidates?.length ?? 0) && (
                            <p className="px-3 py-2 text-xs text-amber-700 border-t border-amber-200">
                              Showing first {jobSegPreview.unmappedCandidates.length} of {jobSegPreview.unmappedCount} unassigned
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Job segregation preview unavailable. Candidates will be auto-matched after import.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Field Mappings */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">        <button
          onClick={() => toggleSection('mappings')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <h3 className="font-medium text-gray-900">Field Mappings</h3>
          {expandedSections.mappings ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        
        {expandedSections.mappings && (
          <div className="p-6 border-t border-gray-200">
            <div className="space-y-3">
              {mappings.map((mapping, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{mapping.sourceColumn}</p>
                  </div>
                  <div className="text-gray-400">→</div>
                  <div className="flex-1">
                    <select
                      value={mapping.targetField}
                      onChange={(e) => handleMappingChange(mapping.sourceColumn, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select field...</option>
                      {SYSTEM_FIELDS.map(field => (
                        <option key={field.value} value={field.value}>
                          {field.label} {field.required && '*'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(
                        mapping.confidence
                      )}`}
                    >
                      {Math.round(mapping.confidence * 100)}% {mapping.method}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Save Mappings Option */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={saveMappings}
                  onChange={(e) => setSaveMappings(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Save these mappings for future imports</span>
              </label>
              {saveMappings && (
                <input
                  type="text"
                  value={mappingName}
                  onChange={(e) => setMappingName(e.target.value)}
                  placeholder="Enter mapping name..."
                  className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Duplicates */}
      {(duplicates.duplicatesInFile.length > 0 || duplicates.duplicatesInDatabase.length > 0) && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('duplicates')}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <h3 className="font-medium text-gray-900">Duplicate Candidates</h3>
              <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">
                {duplicates.duplicatesInFile.length + duplicates.duplicatesInDatabase.length} found
              </span>
            </div>
            {expandedSections.duplicates ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          
          {expandedSections.duplicates && (
            <div className="p-6 border-t border-gray-200">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duplicate Handling Strategy
                </label>
                <select
                  value={duplicateHandling}
                  onChange={(e) => setDuplicateHandling(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="allow_all">Import all candidates (recommended)</option>
                  <option value="skip">Skip duplicates (same email/phone already in DB)</option>
                  <option value="merge">Merge with existing data</option>
                </select>
              </div>

              {duplicates.duplicatesInFile.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Duplicates within file ({duplicates.duplicatesInFile.length})
                  </h4>
                  <div className="space-y-2">
                    {duplicates.duplicatesInFile.map((group, index) => (
                      <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-sm text-yellow-900">
                          Rows {group.rows.join(', ')} • Match: {group.matchCriteria}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {duplicates.duplicatesInDatabase.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Duplicates in database ({duplicates.duplicatesInDatabase.length})
                  </h4>
                  <div className="space-y-2">
                    {duplicates.duplicatesInDatabase.map((match: any, index: number) => (
                      <div key={index} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <p className="text-sm text-orange-900">
                          Row {match.uploadRow} matches existing candidate • Match: {match.matchCriteria}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Preview Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('preview')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <h3 className="font-medium text-gray-900">Data Preview (first 10 rows)</h3>
          {expandedSections.preview ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        
        {expandedSections.preview && (
          <div className="overflow-x-auto">
            <p className="px-4 py-2 text-xs text-gray-600 bg-blue-50 border-b border-blue-100">
              <strong>Kanban Column</strong> = workflow stage after import (from color + status + remarks).
              Job card assignment is shown in <strong>Auto Job Segregation Preview</strong> above.
              Sheet &quot;Selected&quot; → <strong>Selected</strong> column (shortlisted), not Offer.
            </p>
            <table className="w-full">
              <thead className="bg-gray-50 border-t border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Row
                  </th>
                  {displayMappings.map((mapping, index) => (
                    <th
                      key={index}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {mapping.targetField || mapping.sourceColumn}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kanban Column
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {preview.previewRows.map((row: PreviewRow, rowIndex: number) => {
                  const isExcluded = excludedRows.has(row.rowNumber);
                  const hasErrors = row.missingRequired.length > 0;
                  const hasWarnings = row.missingOptional.length > 0 || row.validationIssues.length > 0;
                  const stageDetection = (row as any).stageDetection;
                  const lowConfidence = stageDetection && stageDetection.confidence < 0.6;

                  return (
                    <tr
                      key={rowIndex}
                      className={`${isExcluded ? 'bg-gray-100 opacity-50' : ''} ${
                        hasErrors ? 'bg-red-50' : hasWarnings ? 'bg-yellow-50' : lowConfidence ? 'border-l-4 border-amber-400' : ''
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={isExcluded}
                            onChange={() => toggleRowExclusion(row.rowNumber)}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span>{row.rowNumber}</span>
                        </label>
                      </td>
                      {displayMappings.map((mapping, colIndex) => {
                        const value = row.mappedData[mapping.targetField];
                        const isMissingRequired = row.missingRequired.includes(mapping.targetField);
                        const isMissingOptional = row.missingOptional.includes(mapping.targetField);

                        return (
                          <td
                            key={colIndex}
                            className={`px-4 py-3 text-sm ${
                              isMissingRequired
                                ? 'text-red-600 font-medium'
                                : isMissingOptional
                                ? 'text-yellow-600'
                                : 'text-gray-900'
                            }`}
                          >
                            {value || (
                              <span className="text-gray-400 italic">
                                {isMissingRequired ? 'Required!' : 'Empty'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {stageDetection ? (
                          <div className="flex flex-col gap-0.5">
                            <span className={`font-semibold ${
                              stageDetection.confidence >= 0.9 ? 'text-green-700' :
                              stageDetection.confidence >= 0.6 ? 'text-blue-700' :
                              'text-amber-700'
                            }`}>
                              {(stageDetection as any).kanbanColumn || stageDetection.detectedStage}
                            </span>
                            <div className="flex items-center flex-wrap gap-1">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                stageDetection.confidence >= 0.9 ? 'bg-green-100 text-green-600' :
                                stageDetection.confidence >= 0.6 ? 'bg-blue-100 text-blue-600' :
                                'bg-amber-100 text-amber-600'
                              }`}>
                                {Math.round(stageDetection.confidence * 100)}%
                              </span>
                              {stageDetection.colorSource && stageDetection.colorSource !== 'fallback' && (
                                <span className="text-xs text-gray-500">
                                  via {stageDetection.colorSource === 'row' ? 'row color' :
                                    stageDetection.colorSource === 'name' ? 'name cell' :
                                    stageDetection.colorSource === 'remarks' ? 'remarks' :
                                    stageDetection.colorSource}
                                </span>
                              )}
                            </div>
                            {stageDetection.detectedStage !== (stageDetection as any).kanbanColumn && (
                              <span className="text-xs text-gray-400">
                                stage: {stageDetection.detectedStage}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">Applied (default)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {hasErrors ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <AlertCircle size={12} className="mr-1" />
                            Error
                          </span>
                        ) : hasWarnings ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <AlertTriangle size={12} className="mr-1" />
                            Warning
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle size={12} className="mr-1" />
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
