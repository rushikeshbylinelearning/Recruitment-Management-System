import React, { useState } from 'react';
import { X, Upload, History, Settings, CheckCircle, AlertCircle } from 'lucide-react';
import FileUploadComponent from './FileUploadComponent';
import PreviewTableComponent from './PreviewTableComponent';
import ImportHistoryComponent from './ImportHistoryComponent';
import MappingManagementComponent from './MappingManagementComponent';
import ProgressIndicatorComponent from './ProgressIndicatorComponent';

interface CandidateImportContainerProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type ViewMode = 'upload' | 'preview' | 'processing' | 'success' | 'history' | 'mappings';

export default function CandidateImportContainer({
  isOpen,
  onClose,
  onImportComplete,
}: CandidateImportContainerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [uploadData, setUploadData] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUploadSuccess = (data: any) => {
    setUploadData(data);
    setViewMode('preview');
  };

  const handleConfirmImport = (result: any) => {
    setImportResult(result);
    
    // Check if async processing
    if (result.processing && result.jobId) {
      setJobId(result.jobId);
      setViewMode('processing');
    } else {
      setViewMode('success');
    }
  };

  const handleProcessingComplete = (result: any) => {
    setImportResult(result);
    setViewMode('success');
  };

  const handleClose = () => {
    setViewMode('upload');
    setUploadData(null);
    setImportResult(null);
    setJobId(null);
    onClose();
  };

  const handleFinish = () => {
    if (onImportComplete) {
      onImportComplete();
    }
    handleClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-4">
            <h2 className="text-2xl font-semibold text-gray-900">
              Intelligent Candidate Import
            </h2>
            {viewMode !== 'upload' && viewMode !== 'success' && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode('upload')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'upload' || viewMode === 'preview' || viewMode === 'processing'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Upload size={16} className="inline mr-1" />
                  Import
                </button>
                <button
                  onClick={() => setViewMode('history')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'history'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <History size={16} className="inline mr-1" />
                  History
                </button>
                <button
                  onClick={() => setViewMode('mappings')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'mappings'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Settings size={16} className="inline mr-1" />
                  Mappings
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === 'upload' && (
            <FileUploadComponent
              onUploadSuccess={handleUploadSuccess}
              onCancel={handleClose}
            />
          )}

          {viewMode === 'preview' && uploadData && (
            <PreviewTableComponent
              uploadData={uploadData}
              onConfirm={handleConfirmImport}
              onCancel={() => setViewMode('upload')}
            />
          )}

          {viewMode === 'processing' && jobId && (
            <ProgressIndicatorComponent
              jobId={jobId}
              onComplete={handleProcessingComplete}
            />
          )}

          {viewMode === 'success' && importResult && (
            <div className="max-w-3xl mx-auto">
              <div className="bg-white border border-gray-200 rounded-xl p-8">
                {/* Success Icon */}
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="text-green-600" size={32} />
                  </div>
                </div>

                {/* Success Message */}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                    Import Completed Successfully!
                  </h3>
                  <p className="text-gray-600">
                    Your candidates have been imported into the system
                  </p>
                </div>

                {/* Summary Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <p className="text-sm text-blue-600 font-medium mb-1">Total Rows</p>
                    <p className="text-3xl font-bold text-blue-900">
                      {importResult.summary.totalRows}
                    </p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <p className="text-sm text-green-600 font-medium mb-1">Successful</p>
                    <p className="text-3xl font-bold text-green-900">
                      {importResult.summary.successCount}
                    </p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <p className="text-sm text-red-600 font-medium mb-1">Failed</p>
                    <p className="text-3xl font-bold text-red-900">
                      {importResult.summary.failureCount}
                    </p>
                  </div>
                </div>

                {/* Quality Distribution */}
                {importResult.summary.qualityDistribution && (
                  <div className="mb-8">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      Data Quality Distribution
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                        <p className="text-xs text-green-600 font-medium mb-1">High</p>
                        <p className="text-xl font-bold text-green-900">
                          {importResult.summary.qualityDistribution.high}
                        </p>
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                        <p className="text-xs text-yellow-600 font-medium mb-1">Medium</p>
                        <p className="text-xl font-bold text-yellow-900">
                          {importResult.summary.qualityDistribution.medium}
                        </p>
                      </div>
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                        <p className="text-xs text-orange-600 font-medium mb-1">Low</p>
                        <p className="text-xl font-bold text-orange-900">
                          {importResult.summary.qualityDistribution.low}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Failed Rows */}
                {importResult.failedRows && importResult.failedRows.length > 0 && (
                  <div className="mb-8">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-900 mb-2">
                            {importResult.failedRows.length} rows failed to import
                          </p>
                          <p className="text-xs text-red-700 mb-3">
                            You can download the failed rows from the import history to fix and re-import them.
                          </p>
                          <button
                            onClick={() => setViewMode('history')}
                            className="text-sm text-red-600 hover:text-red-700 font-medium"
                          >
                            View Import History →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => setViewMode('upload')}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Import Another File
                  </button>
                  <button
                    onClick={handleFinish}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'history' && <ImportHistoryComponent />}

          {viewMode === 'mappings' && <MappingManagementComponent />}
        </div>
      </div>
    </div>
  );
}
