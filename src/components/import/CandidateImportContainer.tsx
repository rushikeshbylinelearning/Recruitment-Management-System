import React, { useState } from 'react';
import { X, Upload, History, Settings } from 'lucide-react';
import FileUploadComponent from './FileUploadComponent';
import PreviewTableComponent from './PreviewTableComponent';
import ImportHistoryComponent from './ImportHistoryComponent';
import MappingManagementComponent from './MappingManagementComponent';
import ProgressIndicatorComponent from './ProgressIndicatorComponent';
import ImportResultsComponent from './ImportResultsComponent';

interface CandidateImportContainerProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
  jobId?: number | null;       // When opened from a specific job page
  jobTitle?: string | null;    // For display in the header banner
}

type ViewMode = 'upload' | 'preview' | 'processing' | 'success' | 'history' | 'mappings';

export default function CandidateImportContainer({
  isOpen,
  onClose,
  onImportComplete,
  jobId = null,
  jobTitle = null,
}: CandidateImportContainerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [uploadData, setUploadData] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [asyncJobId, setAsyncJobId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUploadSuccess = (data: any) => {
    setUploadData(data);
    setViewMode('preview');
  };

  const handleConfirmImport = (result: any) => {
    setImportResult(result);
    
    // Check if async processing
    if (result.processing && result.jobId) {
      setAsyncJobId(result.jobId);
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
    setAsyncJobId(null);
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
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Intelligent Candidate Import
              </h2>
              {jobId && jobTitle && (
                <p className="text-sm text-blue-600 font-medium mt-0.5">
                  📌 Importing for: <span className="font-semibold">{jobTitle}</span>
                  {' '}— candidates will be linked to this job
                </p>
              )}
            </div>
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
              jobId={jobId}
            />
          )}

          {viewMode === 'processing' && asyncJobId && (
            <ProgressIndicatorComponent
              jobId={asyncJobId}
              onComplete={handleProcessingComplete}
            />
          )}

          {viewMode === 'success' && importResult && (
            <ImportResultsComponent
              importResult={importResult}
              onImportAnother={() => setViewMode('upload')}
              onViewHistory={() => setViewMode('history')}
              onDone={handleFinish}
            />
          )}

          {viewMode === 'history' && <ImportHistoryComponent />}

          {viewMode === 'mappings' && <MappingManagementComponent />}
        </div>
      </div>
    </div>
  );
}
